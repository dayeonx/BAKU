"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, categoryColor } from "@/lib/eventCategories";
import { inputClass } from "@/components/FormField";
import { BAKU_ACCOUNT } from "@/lib/bakuAccount";
import { isEventOver } from "@/lib/eventTime";
import { safeFileName } from "@/lib/storagePath";

type EventLite = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  items: string | null;
  price_range: string | null;
  host_name: string | null;
  status: string;
};

type MyEvent = EventLite & { isHost: boolean; isParticipant: boolean };

type Settlement = {
  id: string;
  event_id: string;
  host_id: string | null;
  studio_receipt_url: string | null;
  studio_amount: number | null;
  materials_receipt_url: string | null;
  materials_amount: number | null;
  participant_count: number | null;
  status: "submitted" | "assigned" | "completed";
};

type ReceiptLinks = { studio: string | null; materials: string | null };

type SettlementHost = { id: string; name: string; account: string; reward_amount: number; status: "pending" | "paid" | "not_needed" };

// 정산 시스템이 적용되는 활동: 주최자가 영수증을 등록하는 베이킹 활동 + 주최자 없이 임원진이 바로 금액을 배정하는 활동
const BAKING_HOST_CATEGORIES = ["regular", "free", "monthly_special"];
const HOSTLESS_SETTLEMENT_CATEGORIES = ["welcome", "mt", "bread_tour"];
const SETTLEMENT_CATEGORIES = [...BAKING_HOST_CATEGORIES, ...HOSTLESS_SETTLEMENT_CATEGORIES];

function formatTimeRange(e: EventLite): string {
  if (!e.start_time) return "";
  if (!e.end_time) return e.start_time.slice(0, 5);
  return `${e.start_time.slice(0, 5)}~${e.end_time.slice(0, 5)}`;
}

function cardTitle(e: EventLite): string {
  const [, m, d] = e.event_date.split("-");
  const label = e.items || categoryLabel(e.category);
  return `${Number(m)}/${Number(d)} ${label}`;
}

export default function MyPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [settlements, setSettlements] = useState<Map<string, Settlement>>(new Map());
  const [receiptLinks, setReceiptLinks] = useState<Map<string, ReceiptLinks>>(new Map());
  const [reviewedEventIds, setReviewedEventIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    if (!uid) {
      setLoading(false);
      return;
    }

    const [{ data: participantRows }, { data: hostedRows }] = await Promise.all([
      supabase
        .from("event_participants")
        .select(
          "events(id, category, event_date, end_date, start_time, end_time, location, items, price_range, host_name, status)",
        )
        .eq("profile_id", uid),
      supabase
        .from("events")
        .select(
          "id, category, event_date, end_date, start_time, end_time, location, items, price_range, host_name, status",
        )
        .eq("created_by", uid),
    ]);

    const merged = new Map<string, MyEvent>();
    for (const row of (participantRows as unknown as { events: EventLite | null }[]) ?? []) {
      if (!row.events || row.events.status !== "approved") continue;
      merged.set(row.events.id, { ...row.events, isHost: false, isParticipant: true });
    }
    for (const e of (hostedRows as EventLite[]) ?? []) {
      if (e.status !== "approved") continue;
      const prev = merged.get(e.id);
      merged.set(e.id, { ...e, isHost: true, isParticipant: prev?.isParticipant ?? false });
    }
    const allEvents = Array.from(merged.values());
    setMyEvents(allEvents);

    const completedIds = allEvents.filter((e) => isEventOver(e)).map((e) => e.id);

    if (completedIds.length > 0) {
      const [{ data: settlementRows }, { data: reviewRows }] = await Promise.all([
        supabase.from("settlements").select("*").in("event_id", completedIds),
        supabase.from("album_reviews").select("event_id").eq("profile_id", uid).in("event_id", completedIds),
      ]);

      const settlementMap = new Map<string, Settlement>();
      for (const s of settlementRows ?? []) settlementMap.set(s.event_id, s);
      setSettlements(settlementMap);

      setReviewedEventIds(new Set((reviewRows ?? []).map((r) => r.event_id)));

      const linkEntries = await Promise.all(
        (settlementRows ?? []).map(async (s) => {
          const [studioSigned, materialsSigned] = await Promise.all([
            s.studio_receipt_url
              ? supabase.storage.from("settlements").createSignedUrl(s.studio_receipt_url, 3600)
              : Promise.resolve({ data: null }),
            s.materials_receipt_url
              ? supabase.storage.from("settlements").createSignedUrl(s.materials_receipt_url, 3600)
              : Promise.resolve({ data: null }),
          ]);
          return [
            s.event_id,
            { studio: studioSigned.data?.signedUrl ?? null, materials: materialsSigned.data?.signedUrl ?? null },
          ] as const;
        }),
      );
      setReceiptLinks(new Map(linkEntries));
    } else {
      setSettlements(new Map());
      setReviewedEventIds(new Set());
      setReceiptLinks(new Map());
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-brand-500">
        로그인 후 이용할 수 있습니다.
      </div>
    );
  }

  const completed = myEvents.filter((e) => isEventOver(e)).sort((a, b) => b.event_date.localeCompare(a.event_date));
  const needsAttention = completed.filter(
    (e) => SETTLEMENT_CATEGORIES.includes(e.category) && settlements.get(e.id)?.status !== "completed",
  );
  const finished = completed.filter(
    (e) => !SETTLEMENT_CATEGORIES.includes(e.category) || settlements.get(e.id)?.status === "completed",
  );

  const upcoming = myEvents
    .filter((e) => SETTLEMENT_CATEGORIES.includes(e.category) && !isEventOver(e))
    .filter((e) => (BAKING_HOST_CATEGORIES.includes(e.category) ? e.isHost || e.isParticipant : e.isParticipant))
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">마이페이지</h1>
      <p className="mt-2 text-sm text-brand-500">내가 주최하거나 참여한 활동의 정산을 처리하고 후기를 남겨보세요.</p>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-brand-700">예정된 활동</h2>
          {upcoming.map((e) => (
            <UpcomingActivityCard key={e.id} event={e} supabase={supabase} />
          ))}
        </section>
      )}

      <section className="mt-8">
        {needsAttention.length === 0 ? (
          <p className="text-sm text-brand-300">정산이 필요한 활동이 없어요.</p>
        ) : (
          needsAttention.map((e) => (
            <SettlementBigCard
              key={e.id}
              event={e}
              settlement={settlements.get(e.id)}
              receiptLinks={receiptLinks.get(e.id)}
              isHost={e.isHost}
              isParticipant={e.isParticipant}
              userId={userId}
              supabase={supabase}
              onDone={load}
            />
          ))
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-brand-700">내가 한 활동</h2>
        <FinishedActivityList events={finished} reviewedEventIds={reviewedEventIds} />
      </section>
    </div>
  );
}

function UpcomingActivityCard({
  event,
  supabase,
}: {
  event: MyEvent;
  supabase: ReturnType<typeof createClient>;
}) {
  const [participantNames, setParticipantNames] = useState<string[] | null>(null);
  const isBaking = BAKING_HOST_CATEGORIES.includes(event.category);
  const showAsHost = isBaking && event.isHost;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("album_participants", { p_event_id: event.id });
      setParticipantNames(((data ?? []) as { name: string }[]).map((p) => p.name));
    })();
  }, [event.id, supabase]);

  return (
    <div className="mb-4 rounded-2xl border border-accent-200 bg-accent-50/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-extrabold text-brand-700">&lt;{cardTitle(event)}&gt;</span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-accent-700">예정된 활동</span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-brand-700">
        <p>
          날짜: {event.event_date}
          {event.end_date && event.end_date !== event.event_date ? ` ~ ${event.end_date}` : ""}
        </p>
        {formatTimeRange(event) && <p>시간: {formatTimeRange(event)}</p>}
        {isBaking && event.host_name && <p>주최자: {event.host_name}</p>}
        {event.items && <p>품목: {event.items}</p>}
        {event.price_range && <p>예상 가격대: {event.price_range}</p>}
        <p className="font-semibold text-accent-700">
          {showAsHost ? "본인이 주최자입니다" : "본인이 참여자입니다"}
        </p>
      </div>

      <div className="mt-3 border-t border-accent-100 pt-3 text-xs text-brand-500">
        <p className="font-semibold text-brand-700">참여자 명단</p>
        {participantNames === null ? (
          <p className="mt-1 text-brand-300">불러오는 중...</p>
        ) : participantNames.length === 0 ? (
          <p className="mt-1 text-brand-300">아직 참여자가 없어요.</p>
        ) : (
          <p className="mt-1">{participantNames.join(", ")}</p>
        )}
      </div>
    </div>
  );
}

function SettlementBigCard({
  event,
  settlement,
  receiptLinks,
  isHost,
  isParticipant,
  userId,
  supabase,
  onDone,
}: {
  event: MyEvent;
  settlement: Settlement | undefined;
  receiptLinks: ReceiptLinks | undefined;
  isHost: boolean;
  isParticipant: boolean;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const showHostSection = isHost && BAKING_HOST_CATEGORIES.includes(event.category);
  const title = cardTitle(event);
  const statusTag = !settlement
    ? showHostSection
      ? "정산 등록"
      : "정산 대기중"
    : settlement.status === "submitted"
      ? "정산 등록됨"
      : "정산 진행";

  return (
    <div className="mb-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-extrabold text-brand-700">&lt;{title}&gt;</span>
        <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">{statusTag}</span>
      </div>
      <p className="mt-1 text-xs text-brand-500">
        {event.event_date}
        {event.end_date && event.end_date !== event.event_date ? ` ~ ${event.end_date}` : ""} · {event.location}
      </p>

      <div className="mt-4 space-y-4">
        {showHostSection && (
          <HostSettlementSection
            eventId={event.id}
            settlement={settlement}
            receiptLinks={receiptLinks}
            userId={userId}
            supabase={supabase}
            onDone={onDone}
          />
        )}
        {isParticipant && (
          <div className={showHostSection ? "border-t border-brand-100 pt-4" : ""}>
            <ParticipantSettlementSection settlement={settlement} userId={userId} supabase={supabase} onDone={onDone} />
          </div>
        )}
      </div>
    </div>
  );
}

const HOST_REWARD_STATUS_LABEL: Record<SettlementHost["status"], string> = {
  pending: "입금 대기중",
  paid: "입금 완료",
  not_needed: "입금할 필요 없음",
};

function HostSettlementSection({
  eventId,
  settlement,
  receiptLinks,
  userId,
  supabase,
  onDone,
}: {
  eventId: string;
  settlement: Settlement | undefined;
  receiptLinks: ReceiptLinks | undefined;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [participants, setParticipants] = useState<
    { id: string; name: string; amount: number; paid: boolean; selfReportedPaid: boolean }[] | null
  >(null);
  const [hosts, setHosts] = useState<SettlementHost[] | null>(null);

  useEffect(() => {
    if (!settlement) return;
    (async () => {
      const { data } = await supabase
        .from("settlement_hosts")
        .select("id, name, account, reward_amount, status")
        .eq("settlement_id", settlement.id);
      setHosts(data ?? []);
    })();
  }, [settlement, supabase]);

  useEffect(() => {
    if (!settlement || settlement.status !== "assigned") return;
    (async () => {
      const { data } = await supabase
        .from("settlement_participants")
        .select("id, amount, paid, self_reported_paid, profiles(name)")
        .eq("settlement_id", settlement.id);
      setParticipants(
        (data ?? []).map((r) => {
          const p = r.profiles as unknown as { name: string } | null;
          return { id: r.id, amount: r.amount, paid: r.paid, selfReportedPaid: r.self_reported_paid, name: p?.name ?? "-" };
        }),
      );
    })();
  }, [settlement, supabase]);

  if (!settlement) {
    return <SettlementForm eventId={eventId} userId={userId} supabase={supabase} onDone={onDone} />;
  }

  if (settlement.status === "submitted") {
    return (
      <div className="space-y-1 text-sm text-brand-500">
        <p>임원진 확인을 기다리고 있어요.</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {receiptLinks?.studio && (
            <a href={receiptLinks.studio} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
              스튜디오 영수증 보기
            </a>
          )}
          {receiptLinks?.materials && (
            <a href={receiptLinks.materials} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
              재료 영수증 보기
            </a>
          )}
        </div>
        <p className="text-xs text-brand-300">
          스튜디오 {settlement.studio_amount?.toLocaleString() ?? 0}원
          {settlement.materials_amount ? ` · 재료 ${settlement.materials_amount.toLocaleString()}원` : ""} · 참여자{" "}
          {settlement.participant_count ?? 0}명
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-brand-700">참여자 정산 현황</p>
        <div className="mt-1 space-y-1">
          {participants === null ? (
            <p className="text-xs text-brand-300">불러오는 중...</p>
          ) : participants.length === 0 ? (
            <p className="text-xs text-brand-300">참여자가 없어요.</p>
          ) : (
            participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-brand-700">
                <span>
                  {p.name} · {p.amount.toLocaleString()}원
                </span>
                <span className={p.paid ? "font-semibold text-accent-700" : "text-brand-300"}>
                  {p.paid ? "입금 완료" : p.selfReportedPaid ? "입금 확인중" : "입금 대기중"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-brand-700">주최자 보상금</p>
        <div className="mt-1 space-y-1">
          {hosts === null ? (
            <p className="text-xs text-brand-300">불러오는 중...</p>
          ) : (
            hosts.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs text-brand-700">
                <span>
                  {h.name} · {h.reward_amount.toLocaleString()}원 입금
                </span>
                <span className={h.status === "paid" ? "font-semibold text-accent-700" : "text-brand-300"}>
                  {HOST_REWARD_STATUS_LABEL[h.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ParticipantSettlementSection({
  settlement,
  userId,
  supabase,
  onDone,
}: {
  settlement: Settlement | undefined;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [mine, setMine] = useState<
    | { id: string; amount: number; paid: boolean; selfReportedPaid: boolean; couponReason: string | null }
    | null
    | undefined
  >(undefined);
  const [confirming, setConfirming] = useState(false);
  const [myCoupons, setMyCoupons] = useState<{ id: string; reason: string; max_amount: number | null }[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    if (!settlement || settlement.status !== "assigned") {
      setMine(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("settlement_participants")
        .select("id, amount, paid, self_reported_paid, coupons(reason)")
        .eq("settlement_id", settlement.id)
        .eq("profile_id", userId)
        .maybeSingle();
      if (!data) {
        setMine(null);
        return;
      }
      const coupon = data.coupons as unknown as { reason: string } | null;
      setMine({
        id: data.id,
        amount: data.amount,
        paid: data.paid,
        selfReportedPaid: data.self_reported_paid,
        couponReason: coupon?.reason ?? null,
      });

      const { data: couponRows } = await supabase
        .from("coupons")
        .select("id, reason, max_amount")
        .eq("profile_id", userId)
        .eq("used", false);
      setMyCoupons(couponRows ?? []);
    })();
  }, [settlement, supabase, userId]);

  async function handleConfirmPaid() {
    if (!mine) return;
    await supabase.rpc("mark_settlement_participant_paid", { p_id: mine.id });
    setConfirming(false);
    onDone();
  }

  async function handleApplyCoupon() {
    if (!mine || !selectedCouponId) return;
    setApplyingCoupon(true);
    await supabase.rpc("apply_settlement_coupon", { p_participant_id: mine.id, p_coupon_id: selectedCouponId });
    setApplyingCoupon(false);
    onDone();
  }

  if (!settlement) {
    return <p className="text-sm text-brand-300">주최자의 정산 등록을 기다리고 있어요.</p>;
  }
  if (settlement.status === "submitted") {
    return <p className="text-sm text-brand-300">임원진의 금액 배정을 기다리고 있어요.</p>;
  }
  if (mine === undefined) {
    return <p className="text-xs text-brand-300">불러오는 중...</p>;
  }
  if (mine === null) {
    return <p className="text-sm text-brand-300">배정된 정산 금액이 없어요.</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-brand-700">
          납부할 금액 {mine.amount.toLocaleString()}원
          <span className="ml-2 text-xs text-accent-700">지원금 10,000원 적용됨</span>
          {mine.couponReason && <span className="ml-2 text-xs text-accent-700">쿠폰 적용됨 ({mine.couponReason})</span>}
        </span>
        {mine.paid ? (
          <span className="rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white">입금 완료</span>
        ) : mine.selfReportedPaid ? (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
            입금 확인중 · 임원진 확인 대기중
          </span>
        ) : confirming ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-brand-700">정산 완료하셨나요?</span>
            <button
              onClick={handleConfirmPaid}
              className="rounded-full bg-accent-500 px-2.5 py-1 font-semibold text-white hover:bg-accent-700"
            >
              예
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full bg-brand-100 px-2.5 py-1 font-semibold text-brand-700 hover:bg-brand-200"
            >
              아니오
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white hover:bg-accent-700"
          >
            정산완료
          </button>
        )}
      </div>
      {!mine.paid && !mine.couponReason && myCoupons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2">
          <select
            value={selectedCouponId}
            onChange={(e) => setSelectedCouponId(e.target.value)}
            className="rounded-lg border border-brand-100 px-2 py-1.5 text-xs"
          >
            <option value="">보유 쿠폰 선택</option>
            {myCoupons.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reason}
                {c.max_amount != null ? ` (최대 ${c.max_amount.toLocaleString()}원)` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleApplyCoupon}
            disabled={!selectedCouponId || applyingCoupon}
            className="rounded-full bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {applyingCoupon ? "적용 중..." : "쿠폰 적용하기"}
          </button>
        </div>
      )}
      {!mine.paid && <p className="text-xs text-brand-300">입금 계좌: {BAKU_ACCOUNT}</p>}
    </div>
  );
}

function SettlementForm({
  eventId,
  userId,
  supabase,
  onDone,
}: {
  eventId: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [studioAmount, setStudioAmount] = useState("");
  const [materialsAmount, setMaterialsAmount] = useState("");
  const [participantCount, setParticipantCount] = useState("");
  const [host1Name, setHost1Name] = useState("");
  const [host1Account, setHost1Account] = useState("");
  const [coHosted, setCoHosted] = useState(false);
  const [host2Name, setHost2Name] = useState("");
  const [host2Account, setHost2Account] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studioFileRef = useRef<HTMLInputElement>(null);
  const materialsFileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const studioFile = studioFileRef.current?.files?.[0];
    const materialsFile = materialsFileRef.current?.files?.[0];

    if (!studioFile || !studioAmount || !participantCount || !host1Name.trim() || !host1Account.trim()) {
      setError("필수 항목(스튜디오 영수증·비용, 참여자 인원수, 주최자 이름·계좌)을 모두 입력해주세요.");
      return;
    }
    if (coHosted && (!host2Name.trim() || !host2Account.trim())) {
      setError("공동주최자의 이름과 계좌를 입력해주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    const studioPath = `studio/${eventId}/${Date.now()}-${safeFileName(studioFile.name)}`;
    const { error: studioUploadError } = await supabase.storage.from("settlements").upload(studioPath, studioFile);
    if (studioUploadError) {
      setError(`스튜디오 영수증 업로드에 실패했어요: ${studioUploadError.message}`);
      setSaving(false);
      return;
    }

    let materialsPath: string | null = null;
    if (materialsFile) {
      materialsPath = `materials/${eventId}/${Date.now()}-${safeFileName(materialsFile.name)}`;
      const { error: materialsUploadError } = await supabase.storage
        .from("settlements")
        .upload(materialsPath, materialsFile);
      if (materialsUploadError) {
        setError(`재료 영수증 업로드에 실패했어요: ${materialsUploadError.message}`);
        setSaving(false);
        return;
      }
    }

    const { data: created, error: insertError } = await supabase
      .from("settlements")
      .insert({
        event_id: eventId,
        host_id: userId,
        studio_receipt_url: studioPath,
        studio_amount: Number(studioAmount),
        materials_receipt_url: materialsPath,
        materials_amount: materialsAmount ? Number(materialsAmount) : null,
        participant_count: Number(participantCount),
      })
      .select("id")
      .single();

    if (insertError || !created) {
      setSaving(false);
      setError(`정산 등록에 실패했어요: ${insertError?.message ?? "알 수 없는 오류"}`);
      return;
    }

    const hostRows = [{ settlement_id: created.id, name: host1Name.trim(), account: host1Account.trim() }];
    if (coHosted) {
      hostRows.push({ settlement_id: created.id, name: host2Name.trim(), account: host2Account.trim() });
    }
    const { error: hostsError } = await supabase.from("settlement_hosts").insert(hostRows);

    setSaving(false);
    if (hostsError) {
      setError(`주최자 정보 등록에 실패했어요: ${hostsError.message}`);
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
      <p className="text-xs font-bold text-brand-700">정산 등록</p>
      <div className="mt-2 space-y-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-brand-700">스튜디오 영수증 사진</p>
          <input ref={studioFileRef} type="file" accept="image/*,.pdf" className="text-xs" />
        </div>
        <input
          value={studioAmount}
          onChange={(e) => setStudioAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="스튜디오 비용 (원)"
          className={inputClass}
        />
        <div>
          <p className="mb-1 text-xs font-semibold text-brand-700">재료 영수증 사진 (따로 구매한 경우)</p>
          <input ref={materialsFileRef} type="file" accept="image/*,.pdf" className="text-xs" />
        </div>
        <input
          value={materialsAmount}
          onChange={(e) => setMaterialsAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="재료 비용 (원, 선택)"
          className={inputClass}
        />
        <input
          value={participantCount}
          onChange={(e) => setParticipantCount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="베이킹 참여자 (주최자 제외) 총 인원수"
          className={inputClass}
        />

        <div className="rounded-lg border border-brand-100 bg-white p-3">
          <p className="text-xs font-semibold text-brand-700">주최자 정보</p>
          <div className="mt-2 flex gap-2">
            <input
              value={host1Name}
              onChange={(e) => setHost1Name(e.target.value)}
              placeholder="주최자 이름"
              className={inputClass}
            />
            <input
              value={host1Account}
              onChange={(e) => setHost1Account(e.target.value)}
              placeholder="환급받을 계좌"
              className={inputClass}
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-brand-500">
            <input type="checkbox" checked={coHosted} onChange={(e) => setCoHosted(e.target.checked)} />
            공동주최인가요?
          </label>
          {coHosted && (
            <div className="mt-2 flex gap-2">
              <input
                value={host2Name}
                onChange={(e) => setHost2Name(e.target.value)}
                placeholder="공동주최자 이름"
                className={inputClass}
              />
              <input
                value={host2Account}
                onChange={(e) => setHost2Account(e.target.value)}
                placeholder="공동주최자 계좌"
                className={inputClass}
              />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {saving ? "등록 중..." : "정산 등록하기"}
        </button>
      </div>
    </div>
  );
}

function FinishedActivityList({
  events,
  reviewedEventIds,
}: {
  events: MyEvent[];
  reviewedEventIds: Set<string>;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-brand-300">아직 완료한 활동이 없어요.</p>;
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => {
        const reviewed = reviewedEventIds.has(e.id);
        return (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(e.category) }} />
              <span className="font-semibold text-brand-700">{categoryLabel(e.category)}</span>
              <span className="text-brand-500">
                {e.event_date}
                {e.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {e.location}
                {e.items ? ` · ${e.items}` : ""}
              </span>
            </span>
            <Link
              href={`/album/${e.id}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                reviewed ? "bg-brand-50 text-brand-500" : "bg-accent-500 text-white hover:bg-accent-700"
              }`}
            >
              {reviewed ? "후기 작성 완료" : "후기 작성하러 가기 →"}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
