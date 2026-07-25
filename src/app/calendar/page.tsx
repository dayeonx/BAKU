"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES, categoryLabel, categoryColor } from "@/lib/eventCategories";

type EventRow = {
  id: string;
  category: string;
  event_date: string;
  event_time: string;
  location: string;
  items: string;
  capacity: number;
  price_range: string;
  signup_open_at: string;
  status: "pending" | "approved" | "rejected";
  created_by: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - firstDay.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPage() {
  const supabase = useMemo(() => createClient(), []);

  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [events, setEvents] = useState<EventRow[]>([]);
  const [remaining, setRemaining] = useState<Record<string, number>>({});
  const [hostNames, setHostNames] = useState<Record<string, string[]>>({});
  const [myParticipations, setMyParticipations] = useState<Set<string>>(new Set());
  const [isOfficer, setIsOfficer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    if (uid) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("department, status")
        .eq("id", uid)
        .single();
      setIsOfficer(!!myProfile && myProfile.department !== "member" && myProfile.status === "active");
    }

    const { data } = await supabase
      .from("events")
      .select(
        "id, category, event_date, event_time, location, items, capacity, price_range, signup_open_at, status, created_by",
      )
      .order("event_date", { ascending: true });

    const rows = (data as unknown as EventRow[]) ?? [];
    setEvents(rows);

    const remainingEntries = await Promise.all(
      rows.map(async (e) => {
        const { data: count } = await supabase.rpc("event_remaining_spots", { p_event_id: e.id });
        return [e.id, count ?? 0] as const;
      }),
    );
    setRemaining(Object.fromEntries(remainingEntries));

    const hostEntries = await Promise.all(
      rows.map(async (e) => {
        const { data: names } = await supabase.rpc("event_host_names", { p_event_id: e.id });
        return [e.id, (names as string[]) ?? []] as const;
      }),
    );
    setHostNames(Object.fromEntries(hostEntries));

    if (uid) {
      const { data: mine } = await supabase
        .from("event_participants")
        .select("event_id")
        .eq("profile_id", uid);
      setMyParticipations(new Set((mine ?? []).map((r) => r.event_id)));
    }
  }, [supabase]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    for (const e of events) {
      if (e.status !== "approved" && !isOfficer) continue;
      (map[e.event_date] ??= []).push(e);
    }
    return map;
  }, [events, isOfficer]);

  const upcoming = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return events
      .filter((e) => e.status === "approved" && e.event_date >= todayKey)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 5);
  }, [events]);

  const pending = useMemo(() => events.filter((e) => e.status === "pending"), [events]);

  async function handleApprove(id: string, status: "approved" | "rejected") {
    await supabase.from("events").update({ status }).eq("id", id);
    loadEvents();
  }

  async function handleJoin(id: string) {
    const { error } = await supabase.rpc("join_event", { p_event_id: id });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("참여 신청이 완료됐습니다.");
    loadEvents();
  }

  async function handleCancel(id: string) {
    if (!userId) return;
    await supabase.from("event_participants").delete().eq("event_id", id).eq("profile_id", userId);
    setMessage("참여 신청을 취소했습니다.");
    loadEvents();
  }

  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const selectedEvents = eventsByDate[selectedDate] ?? [];

  const todayKey = toDateKey(new Date());
  const waitingEvents = useMemo(
    () =>
      events
        .filter(
          (e) => e.status === "approved" && e.event_date >= todayKey && new Date(e.signup_open_at) > new Date(),
        )
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events, todayKey],
  );
  const openEvents = useMemo(
    () =>
      events
        .filter(
          (e) =>
            e.status === "approved" &&
            e.event_date >= todayKey &&
            new Date(e.signup_open_at) <= new Date() &&
            (remaining[e.id] ?? 0) > 0,
        )
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events, remaining, todayKey],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">캘린더</h1>

      {message && (
        <p className="mt-4 rounded-lg bg-accent-100 px-4 py-3 text-sm text-accent-700">{message}</p>
      )}

      {isOfficer && pending.length > 0 && (
        <section className="mt-6 rounded-xl border border-brand-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-brand-700">승인 대기 일정 ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm"
              >
                <span>
                  {e.event_date} {e.event_time} · {categoryLabel(e.category)} · {e.items} · {e.location}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(e.id, "approved")}
                    className="rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white hover:bg-accent-700"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleApprove(e.id, "rejected")}
                    className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-red-50 hover:text-red-600"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* 달력 */}
        <div className="rounded-2xl border border-brand-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="rounded-full px-3 py-1 text-brand-700 hover:bg-brand-50"
            >
              ◀
            </button>
            <span className="font-bold text-brand-700">
              {monthDate.getFullYear()}. {String(monthDate.getMonth() + 1).padStart(2, "0")}
            </span>
            <button
              onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="rounded-full px-3 py-1 text-brand-700 hover:bg-brand-50"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-brand-300">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = toDateKey(d);
              const inMonth = d.getMonth() === monthDate.getMonth();
              const dayEvents = eventsByDate[key] ?? [];
              const isSelected = key === selectedDate;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`flex min-h-16 flex-col items-start rounded-lg border p-1 text-left text-xs transition-colors ${
                    isSelected ? "border-accent-500" : "border-transparent"
                  } ${inMonth ? "" : "opacity-30"} hover:bg-brand-50`}
                >
                  <span className="font-semibold text-brand-700">{d.getDate()}</span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: categoryColor(e.category) }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 사이드바: 다가오는 일정 + 선택한 날짜 상세 */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-brand-700">다가오는 일정</h2>
            {upcoming.length === 0 && <p className="text-xs text-brand-300">예정된 일정이 없어요.</p>}
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li key={e.id} className="text-xs text-brand-500">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: categoryColor(e.category) }}
                  />
                  {e.event_date} · {categoryLabel(e.category)} · {e.items}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-brand-700">{selectedDate}</h2>
            {selectedEvents.length === 0 && (
              <p className="text-xs text-brand-300">이 날짜에 등록된 일정이 없어요.</p>
            )}
            <div className="space-y-4">
              {selectedEvents.map((e) => {
                const joined = myParticipations.has(e.id);
                const spots = remaining[e.id] ?? 0;
                const opensSoon = new Date(e.signup_open_at) > new Date();
                return (
                  <div key={e.id} className="rounded-lg border border-brand-100 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: categoryColor(e.category) }}
                      />
                      <span className="text-sm font-bold text-brand-700">{categoryLabel(e.category)}</span>
                      {e.status === "pending" && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-500">
                          승인 대기
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-brand-500">
                      주최자: {(hostNames[e.id] ?? []).join(", ") || "-"}
                    </p>
                    <p className="text-xs text-brand-500">장소: {e.location}</p>
                    <p className="text-xs text-brand-500">시간: {e.event_time}</p>
                    <p className="text-xs text-brand-500">품목: {e.items}</p>
                    <p className="text-xs text-brand-500">예상 가격대: {e.price_range}</p>
                    <p className="mt-1 text-xs font-semibold text-accent-700">
                      정원 {e.capacity}명 · 잔여 {Math.max(spots, 0)}자리
                    </p>

                    {e.status === "approved" && userId && (
                      <div className="mt-2">
                        {joined ? (
                          <button
                            onClick={() => handleCancel(e.id)}
                            className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-red-50 hover:text-red-600"
                          >
                            참여 취소
                          </button>
                        ) : opensSoon ? (
                          <p className="text-xs text-brand-300">
                            {new Date(e.signup_open_at).toLocaleString("ko-KR")}부터 신청 가능
                          </p>
                        ) : spots <= 0 ? (
                          <p className="text-xs text-red-500">마감되었습니다</p>
                        ) : (
                          <button
                            onClick={() => handleJoin(e.id)}
                            className="rounded-full bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                          >
                            참여 신청
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 일정 등록 */}
      <div className="mt-8 rounded-2xl border border-brand-100 bg-white p-5">
        {userId ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-brand-700">주최 일정 등록</h2>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
              >
                {showForm ? "닫기" : "주최 일정 등록"}
              </button>
            </div>
            {showForm && (
              <RegisterForm
                isOfficer={isOfficer}
                onClose={() => setShowForm(false)}
                onCreated={() => {
                  setShowForm(false);
                  setMessage("일정이 등록됐습니다. 임원진 승인 후 캘린더에 노출됩니다.");
                  loadEvents();
                }}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-brand-500">로그인 후 일정을 등록할 수 있어요.</p>
        )}
      </div>

      {/* 참여 신청 가능 일정 모음 */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-brand-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-brand-700">
            지금 참여 신청 가능한 일정
          </h2>
          {openEvents.length === 0 && (
            <p className="text-xs text-brand-300">지금 신청 가능한 일정이 없어요.</p>
          )}
          <ul className="space-y-2">
            {openEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-xs text-brand-500">
                <span>
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: categoryColor(e.category) }}
                  />
                  {e.event_date} · {categoryLabel(e.category)} · {e.items} · 잔여{" "}
                  {remaining[e.id] ?? 0}자리
                </span>
                {userId && !myParticipations.has(e.id) && (
                  <button
                    onClick={() => handleJoin(e.id)}
                    className="shrink-0 rounded-full bg-accent-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-700"
                  >
                    참여 신청
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-brand-700">
            앞으로 참여 신청 가능한 일정 (대기중)
          </h2>
          {waitingEvents.length === 0 && (
            <p className="text-xs text-brand-300">대기 중인 일정이 없어요.</p>
          )}
          <ul className="space-y-2">
            {waitingEvents.map((e) => (
              <li key={e.id} className="text-xs text-brand-500">
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: categoryColor(e.category) }}
                />
                {e.event_date} · {categoryLabel(e.category)} · {e.items} ·{" "}
                {new Date(e.signup_open_at).toLocaleString("ko-KR")}부터 신청 가능
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RegisterForm({
  isOfficer,
  onClose,
  onCreated,
}: {
  isOfficer: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<string>(EVENT_CATEGORIES[1].value);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [items, setItems] = useState("");
  const [capacity, setCapacity] = useState("6");
  const [priceRange, setPriceRange] = useState("");
  const [signupOpenAt, setSignupOpenAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("로그인이 필요합니다.");
      return;
    }

    setLoading(true);
    const { data: created, error: insertError } = await supabase
      .from("events")
      .insert({
        category,
        event_date: eventDate,
        event_time: eventTime,
        location,
        items,
        capacity: Number(capacity),
        price_range: priceRange,
        signup_open_at: new Date(signupOpenAt).toISOString(),
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertError || !created) {
      setLoading(false);
      setError("일정 등록에 실패했습니다.");
      return;
    }

    await supabase.from("event_hosts").insert({ event_id: created.id, profile_id: userData.user.id });

    setLoading(false);
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-brand-100 bg-white p-5 sm:grid-cols-2"
    >
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-brand-700">종류</span>
        {isOfficer ? (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-500">
            자유주최 (일반 회원은 자유주최만 등록할 수 있어요)
          </p>
        )}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">날짜</span>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">시간</span>
        <input
          type="time"
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">장소</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">베이킹 품목</span>
        <input
          value={items}
          onChange={(e) => setItems(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">정원</span>
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">예상 가격대</span>
        <input
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          placeholder="예: 5,000~8,000원"
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-brand-700">신청 오픈 일시</span>
        <input
          type="datetime-local"
          value={signupOpenAt}
          onChange={(e) => setSignupOpenAt(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 sm:col-span-2">{error}</p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {loading ? "등록 중..." : "등록"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100/70"
        >
          취소
        </button>
      </div>
    </form>
  );
}
