"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel } from "@/lib/eventCategories";
import { inputClass } from "@/components/FormField";

const SETTLEMENT_SUBSIDY = 10000;

type AdminSettlement = {
  id: string;
  event_id: string;
  studio_receipt_url: string | null;
  studio_amount: number | null;
  materials_receipt_url: string | null;
  materials_amount: number | null;
  participant_count: number | null;
  status: "submitted" | "assigned" | "completed";
  events: { category: string; event_date: string; end_date: string | null; location: string } | null;
};

type SettlementHost = { id: string; name: string; account: string; reward_amount: number; status: "pending" | "paid" | "not_needed" };

const HOST_REWARD_STATUS_ORDER: SettlementHost["status"][] = ["pending", "paid", "not_needed"];
const HOST_REWARD_STATUS_LABEL: Record<SettlementHost["status"], string> = {
  pending: "입금 대기중",
  paid: "입금 완료",
  not_needed: "입금할 필요 없음",
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

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-brand-700">정산 처리가 필요한 활동</h2>
        <OfficerSettlementSection supabase={supabase} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-brand-700">정산 완료된 활동</h2>
        <CompletedSettlementSection supabase={supabase} />
      </section>
    </div>
  );
}

type ReceiptLinks = { studio: string | null; materials: string | null };

function OfficerSettlementSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminSettlement[]>([]);
  const [receiptLinks, setReceiptLinks] = useState<Map<string, ReceiptLinks>>(new Map());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("settlements")
      .select(
        "id, event_id, studio_receipt_url, studio_amount, materials_receipt_url, materials_amount, participant_count, status, events(category, event_date, end_date, location)",
      )
      .in("status", ["submitted", "assigned"])
      .order("created_at", { ascending: true });

    const rows = (data as unknown as AdminSettlement[]) ?? [];
    setItems(rows);

    const links = await Promise.all(
      rows.map(async (s) => {
        const [studioSigned, materialsSigned] = await Promise.all([
          s.studio_receipt_url
            ? supabase.storage.from("settlements").createSignedUrl(s.studio_receipt_url, 3600)
            : Promise.resolve({ data: null }),
          s.materials_receipt_url
            ? supabase.storage.from("settlements").createSignedUrl(s.materials_receipt_url, 3600)
            : Promise.resolve({ data: null }),
        ]);
        return [
          s.id,
          { studio: studioSigned.data?.signedUrl ?? null, materials: materialsSigned.data?.signedUrl ?? null },
        ] as const;
      }),
    );
    setReceiptLinks(new Map(links));
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
          receiptLinks={receiptLinks.get(s.id)}
          supabase={supabase}
          onDone={load}
        />
      ))}
    </ul>
  );
}

type CompletedSummary = {
  id: string;
  event_id: string;
  events: { category: string; event_date: string; end_date: string | null; location: string } | null;
};

function CompletedSettlementSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CompletedSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("settlements")
        .select("id, event_id, events(category, event_date, end_date, location)")
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      setItems((data as unknown as CompletedSummary[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  if (loading) {
    return <p className="text-sm text-brand-300">불러오는 중...</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-brand-300">정산 완료된 활동이 없어요.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => {
        const e = s.events;
        const expanded = expandedId === s.id;
        return (
          <li key={s.id} className="rounded-xl border border-brand-100 bg-white text-sm">
            <button
              onClick={() => setExpandedId(expanded ? null : s.id)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span>
                <span className="font-semibold text-brand-700">{e ? categoryLabel(e.category) : "-"}</span>
                <span className="ml-2 text-brand-500">
                  {e?.event_date}
                  {e?.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {e?.location}
                </span>
              </span>
              <span className="text-brand-300">{expanded ? "▲" : "▼"}</span>
            </button>
            {expanded && <CompletedSettlementDetail settlementId={s.id} supabase={supabase} />}
          </li>
        );
      })}
    </ul>
  );
}

function CompletedSettlementDetail({
  settlementId,
  supabase,
}: {
  settlementId: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const [detail, setDetail] = useState<AdminSettlement | null>(null);
  const [receiptLinks, setReceiptLinks] = useState<ReceiptLinks>({ studio: null, materials: null });
  const [participants, setParticipants] = useState<
    { id: string; name: string; amount: number; paid: boolean; couponReason: string | null }[]
  >([]);
  const [hosts, setHosts] = useState<SettlementHost[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: participantRows }, { data: hostRows }] = await Promise.all([
        supabase
          .from("settlements")
          .select(
            "id, event_id, studio_receipt_url, studio_amount, materials_receipt_url, materials_amount, participant_count, status, events(category, event_date, end_date, location)",
          )
          .eq("id", settlementId)
          .single(),
        supabase
          .from("settlement_participants")
          .select("id, amount, paid, profiles(name), coupons(reason)")
          .eq("settlement_id", settlementId),
        supabase
          .from("settlement_hosts")
          .select("id, name, account, reward_amount, status")
          .eq("settlement_id", settlementId),
      ]);

      setDetail(s as unknown as AdminSettlement);
      setParticipants(
        (participantRows ?? []).map((r) => {
          const p = r.profiles as unknown as { name: string } | null;
          const coupon = r.coupons as unknown as { reason: string } | null;
          return { id: r.id, name: p?.name ?? "-", amount: r.amount, paid: r.paid, couponReason: coupon?.reason ?? null };
        }),
      );
      setHosts(hostRows ?? []);

      const settlementRow = s as unknown as AdminSettlement | null;
      const [studioSigned, materialsSigned] = await Promise.all([
        settlementRow?.studio_receipt_url
          ? supabase.storage.from("settlements").createSignedUrl(settlementRow.studio_receipt_url, 3600)
          : Promise.resolve({ data: null }),
        settlementRow?.materials_receipt_url
          ? supabase.storage.from("settlements").createSignedUrl(settlementRow.materials_receipt_url, 3600)
          : Promise.resolve({ data: null }),
      ]);
      setReceiptLinks({
        studio: studioSigned.data?.signedUrl ?? null,
        materials: materialsSigned.data?.signedUrl ?? null,
      });
    })();
  }, [settlementId, supabase]);

  if (!detail) {
    return <p className="px-4 pb-3 text-xs text-brand-300">불러오는 중...</p>;
  }

  const totalSpent = (detail.studio_amount ?? 0) + (detail.materials_amount ?? 0);

  return (
    <div className="space-y-2 border-t border-brand-50 px-4 pb-4 pt-3 text-xs text-brand-500">
      <div className="flex flex-wrap items-center gap-3">
        <span>스튜디오 {detail.studio_amount?.toLocaleString() ?? 0}원</span>
        {receiptLinks.studio && (
          <a href={receiptLinks.studio} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
            스튜디오 영수증
          </a>
        )}
        {detail.materials_amount != null && <span>재료 {detail.materials_amount.toLocaleString()}원</span>}
        {receiptLinks.materials && (
          <a href={receiptLinks.materials} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
            재료 영수증
          </a>
        )}
        <span>총 지출 {totalSpent.toLocaleString()}원</span>
        <span>참여 인원 {detail.participant_count ?? 0}명</span>
      </div>

      <div>
        <p className="font-bold text-brand-700">참여자 정산</p>
        {participants.length === 0 ? (
          <p>참여자가 없어요.</p>
        ) : (
          participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-0.5">
              <span>
                {p.name} · {p.amount.toLocaleString()}원
                {p.couponReason && <span className="ml-1 text-accent-700">(쿠폰 적용: {p.couponReason})</span>}
              </span>
              <span className={p.paid ? "font-semibold text-accent-700" : ""}>{p.paid ? "입금 완료" : "입금 대기중"}</span>
            </div>
          ))
        )}
      </div>

      <div>
        <p className="font-bold text-brand-700">주최자 보상금</p>
        {hosts.map((h) => (
          <div key={h.id} className="flex items-center justify-between py-0.5">
            <span>
              {h.name} ({h.account}) · {h.reward_amount.toLocaleString()}원
            </span>
            <span className={h.status === "paid" ? "font-semibold text-accent-700" : ""}>
              {HOST_REWARD_STATUS_LABEL[h.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettlementAdminCard({
  settlement,
  receiptLinks,
  supabase,
  onDone,
}: {
  settlement: AdminSettlement;
  receiptLinks: ReceiptLinks | undefined;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [participants, setParticipants] = useState<{ profile_id: string; name: string; student_id: string }[]>([]);
  const [assigned, setAssigned] = useState<
    { id: string; profile_id: string; name: string; amount: number; paid: boolean; couponReason: string | null }[]
  >([]);
  const [hosts, setHosts] = useState<SettlementHost[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: hostRows } = await supabase
        .from("settlement_hosts")
        .select("id, name, account, reward_amount, status")
        .eq("settlement_id", settlement.id);
      setHosts(hostRows ?? []);

      if (settlement.status === "submitted") {
        const { data } = await supabase
          .from("event_participants")
          .select("profile_id, profiles(name, student_id)")
          .eq("event_id", settlement.event_id);
        const rows = (data ?? []).map((r) => {
          const p = r.profiles as unknown as { name: string; student_id: string } | null;
          return { profile_id: r.profile_id, name: p?.name ?? "-", student_id: p?.student_id ?? "-" };
        });
        setParticipants(rows);
      } else {
        const { data } = await supabase
          .from("settlement_participants")
          .select("id, profile_id, amount, paid, profiles(name), coupons(reason)")
          .eq("settlement_id", settlement.id);
        setAssigned(
          (data ?? []).map((r) => {
            const p = r.profiles as unknown as { name: string } | null;
            const coupon = r.coupons as unknown as { reason: string } | null;
            return {
              id: r.id,
              profile_id: r.profile_id,
              name: p?.name ?? "-",
              amount: r.amount,
              paid: r.paid,
              couponReason: coupon?.reason ?? null,
            };
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
        amount: Math.max(Number(amounts[p.profile_id]) - SETTLEMENT_SUBSIDY, 0),
      }));
    if (rows.length > 0) {
      await supabase.from("settlement_participants").insert(rows);
    }
    await supabase.from("settlements").update({ status: "assigned" }).eq("id", settlement.id);
    setSaving(false);
    onDone();
  }

  async function togglePaid(participantRowId: string, current: boolean) {
    await supabase.from("settlement_participants").update({ paid: !current }).eq("id", participantRowId);
    onDone();
  }

  async function cycleHostStatus(hostId: string, current: SettlementHost["status"]) {
    const nextIndex = (HOST_REWARD_STATUS_ORDER.indexOf(current) + 1) % HOST_REWARD_STATUS_ORDER.length;
    await supabase
      .from("settlement_hosts")
      .update({ status: HOST_REWARD_STATUS_ORDER[nextIndex] })
      .eq("id", hostId);
    onDone();
  }

  async function markComplete() {
    await supabase.from("settlements").update({ status: "completed" }).eq("id", settlement.id);
    onDone();
  }

  const e = settlement.events;
  const totalSpent = (settlement.studio_amount ?? 0) + (settlement.materials_amount ?? 0);

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
        <span>스튜디오 {settlement.studio_amount?.toLocaleString() ?? 0}원</span>
        {receiptLinks?.studio && (
          <a href={receiptLinks.studio} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
            스튜디오 영수증
          </a>
        )}
        {settlement.materials_amount != null && <span>재료 {settlement.materials_amount.toLocaleString()}원</span>}
        {receiptLinks?.materials && (
          <a href={receiptLinks.materials} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
            재료 영수증
          </a>
        )}
        <span>총 지출 {totalSpent.toLocaleString()}원</span>
        <span>참여 인원 {settlement.participant_count ?? 0}명</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-brand-500">
        {hosts.map((h) => (
          <span key={h.id}>
            주최자 {h.name} ({h.account})
          </span>
        ))}
      </div>

      {settlement.status === "submitted" && (
        <div className="mt-3 space-y-2 rounded-xl bg-brand-50 p-3">
          <p className="text-xs font-bold text-brand-700">참여자별 정산금액 배정</p>
          {participants.length === 0 ? (
            <p className="text-xs text-brand-300">참여자가 없어요.</p>
          ) : (
            participants.map((p) => {
              const raw = Number(amounts[p.profile_id] ?? 0);
              const finalAmount = Math.max(raw - SETTLEMENT_SUBSIDY, 0);
              return (
                <div key={p.profile_id} className="flex flex-wrap items-center gap-2">
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
                  {raw > 0 && (
                    <span className="text-xs text-brand-300">
                      → 지원금 10,000원 적용 후 실 입금액 {finalAmount.toLocaleString()}원
                    </span>
                  )}
                </div>
              );
            })
          )}
          <button
            onClick={handleAssign}
            disabled={saving}
            className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "등록완료"}
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
                {p.couponReason && <span className="ml-1 text-accent-700">(쿠폰 적용: {p.couponReason})</span>}
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
          {hosts.map((h) => (
            <div key={h.id} className="flex items-center justify-between text-xs text-brand-700">
              <span>
                {h.name} 보상금 {h.reward_amount.toLocaleString()}원 입금
              </span>
              <button
                onClick={() => cycleHostStatus(h.id, h.status)}
                className={`rounded-full px-3 py-1 font-semibold ${
                  h.status === "paid" ? "bg-accent-500 text-white" : "bg-white text-brand-500"
                }`}
              >
                {HOST_REWARD_STATUS_LABEL[h.status]}
              </button>
            </div>
          ))}
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
