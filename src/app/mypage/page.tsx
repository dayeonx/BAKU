"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, categoryColor } from "@/lib/eventCategories";
import { departmentLabel } from "@/lib/departments";
import { isValidPassword, CREDENTIAL_FORMAT_HINT } from "@/lib/validation";
import { Field, inputClass } from "@/components/FormField";

type Profile = {
  name: string;
  student_id: string;
  department: string;
  status: string;
  college: string | null;
  major: string | null;
};

type EventLite = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  items: string | null;
  status: string;
};

type MyEvent = EventLite & { isHost: boolean; isParticipant: boolean };

type Settlement = {
  id: string;
  event_id: string;
  host_id: string;
  receipt_url: string;
  bank_account: string;
  total_amount: number;
  host_reward_amount: number | null;
  host_reward_paid: boolean;
  status: "submitted" | "assigned" | "completed";
};

type SettlementParticipant = { amount: number; paid: boolean };

type Coupon = { id: string; reason: string; used: boolean; created_at: string };

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MyPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [settlements, setSettlements] = useState<Map<string, Settlement>>(new Map());
  const [receiptLinks, setReceiptLinks] = useState<Map<string, string>>(new Map());
  const [mySettlementAmounts, setMySettlementAmounts] = useState<Map<string, SettlementParticipant>>(new Map());
  const [reviewedEventIds, setReviewedEventIds] = useState<Set<string>>(new Set());
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);
    setUserEmail(userData.user?.email ?? null);

    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("name, student_id, department, status, college, major")
      .eq("id", uid)
      .single();
    setProfile(profileData);

    const [{ data: participantRows }, { data: hostedRows }] = await Promise.all([
      supabase
        .from("event_participants")
        .select("events(id, category, event_date, end_date, start_time, end_time, location, items, status)")
        .eq("profile_id", uid),
      supabase
        .from("events")
        .select("id, category, event_date, end_date, start_time, end_time, location, items, status")
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

    const todayKey = toDateKey(new Date());
    const completedIds = allEvents
      .filter((e) => (e.end_date ?? e.event_date) < todayKey)
      .map((e) => e.id);

    if (completedIds.length > 0) {
      const [{ data: settlementRows }, { data: reviewRows }] = await Promise.all([
        supabase.from("settlements").select("*").in("event_id", completedIds),
        supabase.from("album_reviews").select("event_id").eq("profile_id", uid).in("event_id", completedIds),
      ]);

      const settlementMap = new Map<string, Settlement>();
      for (const s of settlementRows ?? []) settlementMap.set(s.event_id, s);
      setSettlements(settlementMap);

      setReviewedEventIds(new Set((reviewRows ?? []).map((r) => r.event_id)));

      const settlementIds = (settlementRows ?? []).map((s) => s.id);
      if (settlementIds.length > 0) {
        const { data: partRows } = await supabase
          .from("settlement_participants")
          .select("settlement_id, amount, paid")
          .eq("profile_id", uid)
          .in("settlement_id", settlementIds);

        const idToEvent = new Map((settlementRows ?? []).map((s) => [s.id, s.event_id]));
        const amountMap = new Map<string, SettlementParticipant>();
        for (const p of partRows ?? []) {
          const eventId = idToEvent.get(p.settlement_id);
          if (eventId) amountMap.set(eventId, { amount: p.amount, paid: p.paid });
        }
        setMySettlementAmounts(amountMap);
      } else {
        setMySettlementAmounts(new Map());
      }

      const linkEntries = await Promise.all(
        (settlementRows ?? []).map(async (s) => {
          const { data } = await supabase.storage.from("settlements").createSignedUrl(s.receipt_url, 3600);
          return [s.event_id, data?.signedUrl ?? null] as const;
        }),
      );
      setReceiptLinks(new Map(linkEntries.filter(([, url]) => !!url) as [string, string][]));
    } else {
      setSettlements(new Map());
      setReviewedEventIds(new Set());
      setMySettlementAmounts(new Map());
      setReceiptLinks(new Map());
    }

    const { data: couponRows } = await supabase
      .from("coupons")
      .select("id, reason, used, created_at")
      .eq("profile_id", uid)
      .order("created_at", { ascending: false });
    setCoupons(couponRows ?? []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const todayKey = toDateKey(new Date());
  const upcoming = myEvents
    .filter((e) => (e.end_date ?? e.event_date) >= todayKey)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const completed = myEvents
    .filter((e) => (e.end_date ?? e.event_date) < todayKey)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!userId || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-brand-500">
        로그인 후 이용할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">마이페이지</h1>

      <ProfileSection profile={profile} userId={userId} userEmail={userEmail} supabase={supabase} onDone={load} />

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-brand-700">나의 일정</h2>

        <h3 className="mb-2 text-sm font-bold text-accent-700">앞으로 참여할 일정</h3>
        <UpcomingList events={upcoming} />

        <h3 className="mb-2 mt-6 text-sm font-bold text-accent-700">참여 완료한 일정</h3>
        <CompletedList
          events={completed}
          settlements={settlements}
          receiptLinks={receiptLinks}
          mySettlementAmounts={mySettlementAmounts}
          reviewedEventIds={reviewedEventIds}
          userId={userId}
          supabase={supabase}
          onDone={load}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-brand-700">내 쿠폰</h2>
        <CouponList coupons={coupons} />
      </section>
    </div>
  );
}

function UpcomingList({ events }: { events: MyEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-brand-300">앞으로 참여할 일정이 없어요.</p>;
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex items-center gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm text-brand-700"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(e.category) }} />
          <span className="font-semibold">{categoryLabel(e.category)}</span>
          <span className="text-brand-500">
            {e.event_date}
            {e.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {e.location}
            {e.items ? ` · ${e.items}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CompletedList({
  events,
  settlements,
  receiptLinks,
  mySettlementAmounts,
  reviewedEventIds,
  userId,
  supabase,
  onDone,
}: {
  events: MyEvent[];
  settlements: Map<string, Settlement>;
  receiptLinks: Map<string, string>;
  mySettlementAmounts: Map<string, SettlementParticipant>;
  reviewedEventIds: Set<string>;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-brand-300">아직 완료한 활동이 없어요.</p>;
  }

  return (
    <ul className="space-y-3">
      {events.map((e) => {
        const settlement = settlements.get(e.id);
        const reviewed = reviewedEventIds.has(e.id);
        const myAmount = mySettlementAmounts.get(e.id);

        return (
          <li key={e.id} className="rounded-lg border border-brand-100 bg-white px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(e.category) }} />
              <span className="font-semibold text-brand-700">{categoryLabel(e.category)}</span>
              <span className="text-brand-500">
                {e.event_date}
                {e.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {e.location}
                {e.items ? ` · ${e.items}` : ""}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {e.isHost && (
                <SettlementHostBadge
                  eventId={e.id}
                  settlement={settlement}
                  receiptLink={settlement ? receiptLinks.get(e.id) : undefined}
                  userId={userId}
                  supabase={supabase}
                  onDone={onDone}
                />
              )}
              {!e.isHost && e.isParticipant && <SettlementParticipantBadge settlement={settlement} myAmount={myAmount} />}

              <Link
                href={`/album/${e.id}`}
                className={`rounded-full px-3 py-1 font-semibold ${
                  reviewed ? "bg-brand-50 text-brand-500" : "bg-accent-500 text-white hover:bg-accent-700"
                }`}
              >
                {reviewed ? "후기 작성 완료" : "후기 작성하러 가기 →"}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SettlementHostBadge({
  eventId,
  settlement,
  receiptLink,
  userId,
  supabase,
  onDone,
}: {
  eventId: string;
  settlement: Settlement | undefined;
  receiptLink: string | undefined;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!settlement) {
    return (
      <>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-700 hover:bg-brand-200"
        >
          정산 등록하기
        </button>
        {open && (
          <div className="mt-2 w-full">
            <SettlementForm eventId={eventId} userId={userId} supabase={supabase} onDone={onDone} />
          </div>
        )}
      </>
    );
  }

  const statusLabel =
    settlement.status === "submitted"
      ? "정산 접수됨 · 임원진 확인 대기중"
      : settlement.status === "assigned"
        ? "정산 처리중"
        : "정산 완료";

  return (
    <span className="flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
      {statusLabel}
      {receiptLink && (
        <a href={receiptLink} target="_blank" rel="noreferrer" className="text-accent-700 hover:underline">
          영수증 보기
        </a>
      )}
    </span>
  );
}

function SettlementParticipantBadge({
  settlement,
  myAmount,
}: {
  settlement: Settlement | undefined;
  myAmount: SettlementParticipant | undefined;
}) {
  if (!settlement) {
    return <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-300">정산 대기중</span>;
  }
  if (!myAmount) {
    return (
      <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-300">
        정산 금액 배정 대기중
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-3 py-1 font-semibold ${
        myAmount.paid ? "bg-brand-50 text-brand-700" : "bg-accent-50 text-accent-700"
      }`}
    >
      납부할 금액 {myAmount.amount.toLocaleString()}원 · {myAmount.paid ? "입금 확인됨" : "입금 대기중"}
    </span>
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
  const [bankAccount, setBankAccount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !bankAccount.trim() || !totalAmount) {
      setError("영수증, 계좌정보, 총 지출금액을 모두 입력해주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    const path = `receipts/${eventId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("settlements").upload(path, file);
    if (uploadError) {
      setError("영수증 업로드에 실패했어요.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("settlements").insert({
      event_id: eventId,
      host_id: userId,
      receipt_url: path,
      bank_account: bankAccount.trim(),
      total_amount: Number(totalAmount),
    });

    setSaving(false);
    if (insertError) {
      setError("정산 등록에 실패했어요.");
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
      <p className="text-xs font-bold text-brand-700">정산 등록</p>
      <div className="mt-2 space-y-2">
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="text-xs" />
        <input
          value={bankAccount}
          onChange={(e) => setBankAccount(e.target.value)}
          placeholder="계좌정보 (예: 카카오뱅크 3333-01-1234567 홍길동)"
          className={inputClass}
        />
        <input
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="총 지출금액 (원)"
          className={inputClass}
        />
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

function CouponList({ coupons }: { coupons: Coupon[] }) {
  if (coupons.length === 0) {
    return <p className="text-sm text-brand-300">아직 발급된 쿠폰이 없어요.</p>;
  }
  return (
    <ul className="space-y-2">
      {coupons.map((c) => (
        <li
          key={c.id}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
            c.used ? "border-brand-100 bg-brand-50 text-brand-300" : "border-accent-500/30 bg-white text-brand-700"
          }`}
        >
          <span>{c.reason}</span>
          <span className="text-xs font-semibold">{c.used ? "사용완료" : "사용가능"}</span>
        </li>
      ))}
    </ul>
  );
}

function ProfileSection({
  profile,
  userId,
  userEmail,
  supabase,
  onDone,
}: {
  profile: Profile;
  userId: string;
  userEmail: string | null;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [college, setCollege] = useState(profile.college ?? "");
  const [major, setMajor] = useState(profile.major ?? "");
  const [saving, setSaving] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  async function handleProfileSave() {
    setSaving(true);
    await supabase.from("profiles").update({ college: college.trim(), major: major.trim() }).eq("id", userId);
    setSaving(false);
    setEditing(false);
    onDone();
  }

  async function handlePasswordSave() {
    setPasswordError(null);
    if (!isValidPassword(newPassword)) {
      setPasswordError(CREDENTIAL_FORMAT_HINT);
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("새 비밀번호가 서로 일치하지 않아요.");
      return;
    }
    if (!userEmail) return;

    setPasswordSaving(true);
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (reauthError) {
      setPasswordSaving(false);
      setPasswordError("현재 비밀번호가 일치하지 않아요.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (updateError) {
      setPasswordError("비밀번호 변경에 실패했어요.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setChangingPassword(false);
    setPasswordDone(true);
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-brand-700">{profile.name}</p>
          <p className="text-xs text-brand-500">
            {profile.student_id} · {departmentLabel(profile.department)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-200"
          >
            프로필 수정
          </button>
          <button
            onClick={() => {
              setChangingPassword((v) => !v);
              setPasswordDone(false);
            }}
            className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-200"
          >
            비밀번호 변경
          </button>
        </div>
      </div>

      {!editing && (
        <p className="mt-3 text-sm text-brand-500">
          {profile.college || "단과대 미입력"} · {profile.major || "학과 미입력"}
        </p>
      )}

      {editing && (
        <div className="mt-4 space-y-3">
          <Field label="단과대">
            <input value={college} onChange={(e) => setCollege(e.target.value)} className={inputClass} />
          </Field>
          <Field label="학과">
            <input value={major} onChange={(e) => setMajor(e.target.value)} className={inputClass} />
          </Field>
          <button
            onClick={handleProfileSave}
            disabled={saving}
            className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      )}

      {changingPassword && (
        <div className="mt-4 space-y-3 border-t border-brand-100 pt-4">
          <Field label="현재 비밀번호">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="새 비밀번호">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={CREDENTIAL_FORMAT_HINT}
              className={inputClass}
            />
          </Field>
          <Field label="새 비밀번호 확인">
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className={inputClass}
            />
          </Field>
          {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
          <button
            onClick={handlePasswordSave}
            disabled={passwordSaving}
            className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {passwordSaving ? "변경 중..." : "비밀번호 변경하기"}
          </button>
        </div>
      )}
      {passwordDone && <p className="mt-3 text-xs text-accent-700">비밀번호가 변경됐어요.</p>}
    </section>
  );
}
