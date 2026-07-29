"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryMeta, categoryLabel, categoryColor } from "@/lib/eventCategories";
import EventRegisterForm from "@/components/EventRegisterForm";

type EventRow = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  location_2: string | null;
  items: string | null;
  capacity: number | null;
  price_range: string | null;
  signup_open_at: string | null;
  google_form_url: string | null;
  signup_method: "in_app_auto" | "manual" | "none";
  status: "pending" | "approved" | "rejected";
  created_by: string;
  host_name: string | null;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const BAKING_CATEGORIES = ["regular", "free", "monthly_special"];
const GOOGLE_FORM_CATEGORIES = ["welcome", "mt", "bread_tour", "pub"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatOpenAt(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}시 ${mm}분부터 참여 신청 가능합니다.`;
}

function formatDateRange(e: EventRow): string {
  if (e.end_date && e.end_date !== e.event_date) return `${e.event_date} ~ ${e.end_date}`;
  return e.event_date;
}

function formatTimeRange(e: EventRow): string {
  if (!e.start_time) return "";
  if (!e.end_time) return e.start_time;
  return `${e.start_time}~${e.end_time}`;
}

function expandDateKeys(start: string, end: string | null): string[] {
  if (!end || end <= start) return [start];
  const keys: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    keys.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
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
        "id, category, event_date, end_date, start_time, end_time, location, location_2, items, capacity, price_range, signup_open_at, google_form_url, signup_method, status, created_by, host_name",
      )
      .order("event_date", { ascending: true });

    const rows = (data as unknown as EventRow[]) ?? [];
    setEvents(rows);

    const autoRows = rows.filter((e) => e.signup_method === "in_app_auto");
    const remainingEntries = await Promise.all(
      autoRows.map(async (e) => {
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
      for (const key of expandDateKeys(e.event_date, e.end_date)) {
        (map[key] ??= []).push(e);
      }
    }
    return map;
  }, [events, isOfficer]);

  const thisWeekEvents = useMemo(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const weekStart = toDateKey(sunday);
    const weekEnd = toDateKey(saturday);
    return events
      .filter(
        (e) =>
          e.status === "approved" && e.event_date <= weekEnd && (e.end_date ?? e.event_date) >= weekStart,
      )
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
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
  const signupEvents = useMemo(
    () =>
      events
        .filter(
          (e) =>
            e.status === "approved" &&
            e.signup_method === "in_app_auto" &&
            (e.end_date ?? e.event_date) >= todayKey,
        )
        .sort(
          (a, b) =>
            a.event_date.localeCompare(b.event_date) ||
            (a.signup_open_at ?? "").localeCompare(b.signup_open_at ?? ""),
        ),
    [events, todayKey],
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
                  {formatDateRange(e)} {formatTimeRange(e)} · {categoryLabel(e.category)}
                  {e.items ? ` · ${e.items}` : ""} · {e.location}
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
            <h2 className="mb-3 text-sm font-bold text-brand-700">이번주 일정</h2>
            {thisWeekEvents.length === 0 && <p className="text-xs text-brand-300">이번주 일정이 없어요.</p>}
            <ul className="space-y-2">
              {thisWeekEvents.map((e) => (
                <li key={e.id} className="text-xs text-brand-500">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: categoryColor(e.category) }}
                  />
                  {formatDateRange(e)} · {categoryLabel(e.category)}
                  {e.items ? ` · ${e.items}` : ""}
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
                const meta = categoryMeta(e.category);
                const joined = myParticipations.has(e.id);
                const spots = remaining[e.id] ?? 0;
                const opensSoon = e.signup_open_at ? new Date(e.signup_open_at) > new Date() : false;
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
                    {BAKING_CATEGORIES.includes(e.category) && (
                      <>
                        <p className="mt-1 text-xs text-brand-500">
                          주최자: {e.host_name || (hostNames[e.id] ?? []).join(", ") || "-"}
                        </p>
                        {e.items && (
                          <p className="text-xs text-brand-500">
                            {meta.itemsLabel}: {e.items}
                          </p>
                        )}
                        <p className="text-xs text-brand-500">장소: {e.location}</p>
                        {formatTimeRange(e) && (
                          <p className="text-xs text-brand-500">시간: {formatTimeRange(e)}</p>
                        )}
                      </>
                    )}

                    {GOOGLE_FORM_CATEGORIES.includes(e.category) && (
                      <>
                        <p className="mt-1 text-xs text-brand-500">장소: {e.location}</p>
                        {formatTimeRange(e) && (
                          <p className="text-xs text-brand-500">시간: {formatTimeRange(e)}</p>
                        )}
                      </>
                    )}

                    {e.category === "snack" && (
                      <>
                        <p className="mt-1 text-xs text-brand-500">
                          배부 장소: {e.location}
                          {e.location_2 ? ` / ${e.location_2}` : ""}
                        </p>
                        {formatTimeRange(e) && (
                          <p className="text-xs text-brand-500">시간: {formatTimeRange(e)}</p>
                        )}
                      </>
                    )}

                    {meta.signup === "in_app_auto" && (
                      <>
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
                                {new Date(e.signup_open_at!).toLocaleString("ko-KR")}부터 신청 가능
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
                      </>
                    )}

                    {meta.needsGoogleForm && e.google_form_url && (
                      <a
                        href={e.google_form_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block rounded-full bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                      >
                        {meta.googleFormLabel}
                      </a>
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
              <h2 className="text-sm font-bold text-brand-700">자유주최 등록</h2>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
              >
                {showForm ? "닫기" : "자유주최 등록"}
              </button>
            </div>
            {showForm && (
              <EventRegisterForm
                categories={[categoryMeta("free")]}
                autoApprove={isOfficer}
                onClose={() => setShowForm(false)}
                onCreated={() => {
                  setShowForm(false);
                  setMessage(
                    isOfficer
                      ? "일정이 등록됐습니다."
                      : "일정이 등록됐습니다. 임원진 승인 후 캘린더에 노출됩니다.",
                  );
                  loadEvents();
                }}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-brand-500">로그인 후 일정을 등록할 수 있어요.</p>
        )}
      </div>

      {/* 베이킹 참여 신청 */}
      <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-brand-700">베이킹 참여 신청</h2>
        {signupEvents.length === 0 && (
          <p className="text-xs text-brand-300">신청 가능한 일정이 없어요.</p>
        )}
        <ul className="space-y-3">
          {signupEvents.map((e) => {
            const isOpen = e.signup_open_at ? new Date(e.signup_open_at) <= new Date() : false;
            const spots = remaining[e.id] ?? 0;
            const joined = myParticipations.has(e.id);
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-100 px-3 py-2"
              >
                <div className="text-xs text-brand-500">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: categoryColor(e.category) }}
                  />
                  {e.event_date} · {categoryLabel(e.category)}
                  {e.items ? ` · ${e.items}` : ""} · 잔여 {Math.max(spots, 0)}자리
                  {!isOpen && (
                    <div className="mt-1 text-brand-300">{formatOpenAt(e.signup_open_at!)}</div>
                  )}
                </div>

                {userId &&
                  (joined ? (
                    <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-500">
                      신청 완료
                    </span>
                  ) : !isOpen ? (
                    <button
                      disabled
                      className="shrink-0 cursor-not-allowed rounded-full bg-brand-100 px-3 py-1 text-[11px] font-semibold text-brand-300"
                    >
                      대기중
                    </button>
                  ) : spots <= 0 ? (
                    <button
                      disabled
                      className="shrink-0 cursor-not-allowed rounded-full bg-brand-100 px-3 py-1 text-[11px] font-semibold text-brand-300"
                    >
                      마감
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJoin(e.id)}
                      className="shrink-0 rounded-full bg-accent-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-700"
                    >
                      참여 신청
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}


