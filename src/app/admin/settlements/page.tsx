"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel } from "@/lib/eventCategories";
import { inputClass } from "@/components/FormField";

type AdminSettlement = {
  id: string;
  event_id: string;
  receipt_url: string;
  bank_account: string;
  total_amount: number;
  host_reward_amount: number | null;
  host_reward_paid: boolean;
  status: "submitted" | "assigned" | "completed";
  events: { category: string; event_date: string; end_date: string | null; location: string } | null;
};

export default function AdminSettlementsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("department, status")
        .eq("id", userData.user.id)
        .single();
      setIsOfficer(!!myProfile && myProfile.department !== "member" && myProfile.status === "active");
      setLoading(false);
    })();
  }, [supabase]);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">정산 관리</h1>
      <p className="mt-2 text-sm text-brand-500">
        주최자가 접수한 정산 건에 참여자별 금액을 배정하고, 입금 확인 후 완료 처리해요.
      </p>

      <div className="mt-6">
        <OfficerSettlementSection supabase={supabase} />
      </div>
    </div>
  );
}

function OfficerSettlementSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminSettlement[]>([]);
  const [receiptLinks, setReceiptLinks] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("settlements")
      .select(
        "id, event_id, receipt_url, bank_account, total_amount, host_reward_amount, host_reward_paid, status, events(category, event_date, end_date, location)",
      )
      .in("status", ["submitted", "assigned"])
      .order("created_at", { ascending: true });

    const rows = (data as unknown as AdminSettlement[]) ?? [];
    setItems(rows);

    const links = await Promise.all(
      rows.map(async (s) => {
        const { data: signed } = await supabase.storage.from("settlements").createSignedUrl(s.receipt_url, 3600);
        return [s.id, signed?.signedUrl ?? null] as const;
      }),
    );
    setReceiptLinks(new Map(links.filter(([, url]) => !!url) as [string, string][]));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-brand-300">불러오는 중...</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-brand-300">처리할 정산 건이 없어요.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((s) => (
        <SettlementAdminCard
          key={s.id}
          settlement={s}
          receiptLink={receiptLinks.get(s.id)}
          supabase={supabase}
          onDone={load}
        />
      ))}
    </ul>
  );
}

function SettlementAdminCard({
  settlement,
  receiptLink,
  supabase,
  onDone,
}: {
  settlement: AdminSettlement;
  receiptLink: string | undefined;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [participants, setParticipants] = useState<{ profile_id: string; name: string; student_id: string }[]>([]);
  const [assigned, setAssigned] = useState<
    { id: string; profile_id: string; name: string; amount: number; paid: boolean }[]
  >([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [hostReward, setHostReward] = useState(String(settlement.host_reward_amount ?? ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (settlement.status === "submitted") {
        const { data } = await supabase
          .from("event_participants")
          .select("profile_id, profiles(name, student_id)")
          .eq("event_id", settlement.event_id);
        setParticipants(
          (data ?? []).map((r) => {
            const p = r.profiles as unknown as { name: string; student_id: string } | null;
            return { profile_id: r.profile_id, name: p?.name ?? "-", student_id: p?.student_id ?? "-" };
          }),
        );
      } else {
        const { data } = await supabase
          .from("settlement_participants")
          .select("id, profile_id, amount, paid, profiles(name)")
          .eq("settlement_id", settlement.id);
        setAssigned(
          (data ?? []).map((r) => {
            const p = r.profiles as unknown as { name: string } | null;
            return { id: r.id, profile_id: r.profile_id, name: p?.name ?? "-", amount: r.amount, paid: r.paid };
          }),
        );
      }
    })();
  }, [settlement, supabase]);

  async function handleAssign() {
    setSaving(true);
    const rows = participants
      .filter((p) => Number(amounts[p.profile_id] ?? 0) > 0)
      .map((p) => ({
        settlement_id: settlement.id,
        profile_id: p.profile_id,
        amount: Number(amounts[p.profile_id]),
      }));
    if (rows.length > 0) {
      await supabase.from("settlement_participants").insert(rows);
    }
    await supabase
      .from("settlements")
      .update({ status: "assigned", host_reward_amount: hostReward ? Number(hostReward) : null })
      .eq("id", settlement.id);
    setSaving(false);
    onDone();
  }

  async function togglePaid(participantRowId: string, current: boolean) {
    await supabase.from("settlement_participants").update({ paid: !current }).eq("id", participantRowId);
    onDone();
  }

  async function toggleHostRewardPaid() {
    await supabase.from("settlements").update({ host_reward_paid: !settlement.host_reward_paid }).eq("id", settlement.id);
    onDone();
  }

  async function markComplete() {
    await supabase.from("settlements").update({ status: "completed" }).eq("id", settlement.id);
    onDone();
  }

  const e = settlement.events;

  return (
    <li className="rounded-2xl border border-brand-100 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-brand-700">{e ? categoryLabel(e.category) : "-"}</span>
        <span className="text-brand-500">
          {e?.event_date}
          {e?.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {e?.location}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-brand-500">
        <span>계좌: {settlement.bank_account}</span>
        <span>총 지출: {settlement.total_amount.toLocaleString()}원</span>
        {receiptLink && (
          <a href={receiptLink} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
            영수증 보기
          </a>
        )}
      </div>

      {settlement.status === "submitted" && (
        <div className="mt-3 space-y-2 rounded-xl bg-brand-50 p-3">
          <p className="text-xs font-bold text-brand-700">참여자별 정산금액 배정</p>
          {participants.length === 0 ? (
            <p className="text-xs text-brand-300">참여자가 없어요.</p>
          ) : (
            participants.map((p) => (
              <div key={p.profile_id} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-brand-700">
                  {p.name} ({p.student_id})
                </span>
                <input
                  value={amounts[p.profile_id] ?? ""}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [p.profile_id]: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  placeholder="금액(원)"
                  className={inputClass}
                />
              </div>
            ))
          )}
          <div className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs text-brand-700">주최자 보상금</span>
            <input
              value={hostReward}
              onChange={(e) => setHostReward(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="금액(원)"
              className={inputClass}
            />
          </div>
          <button
            onClick={handleAssign}
            disabled={saving}
            className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "배정하기"}
          </button>
        </div>
      )}

      {settlement.status === "assigned" && (
        <div className="mt-3 space-y-2 rounded-xl bg-brand-50 p-3">
          <p className="text-xs font-bold text-brand-700">입금 확인</p>
          {assigned.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs text-brand-700">
              <span>
                {p.name} · {p.amount.toLocaleString()}원
              </span>
              <button
                onClick={() => togglePaid(p.id, p.paid)}
                className={`rounded-full px-3 py-1 font-semibold ${
                  p.paid ? "bg-accent-500 text-white" : "bg-white text-brand-500"
                }`}
              >
                {p.paid ? "입금 확인됨" : "입금 대기중"}
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs text-brand-700">
            <span>주최자 보상금 {settlement.host_reward_amount?.toLocaleString() ?? 0}원</span>
            <button
              onClick={toggleHostRewardPaid}
              className={`rounded-full px-3 py-1 font-semibold ${
                settlement.host_reward_paid ? "bg-accent-500 text-white" : "bg-white text-brand-500"
              }`}
            >
              {settlement.host_reward_paid ? "지급 완료" : "지급 대기중"}
            </button>
          </div>
          <button
            onClick={markComplete}
            className="rounded-full bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-900"
          >
            정산 완료 처리
          </button>
        </div>
      )}
    </li>
  );
}
