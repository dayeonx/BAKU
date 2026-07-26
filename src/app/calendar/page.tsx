"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES, categoryMeta, categoryLabel, categoryColor } from "@/lib/eventCategories";
import { BAKING_PLACE } from "@/lib/bakingPlace";

// 스튜디오 예약이 필요한 활동 종류 (직접 스튜디오에서 굽는 활동)
const STUDIO_REQUIRED_CATEGORIES = ["free", "regular", "monthly_special"];

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
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
        "id, category, event_date, end_date, start_time, end_time, location, location_2, items, capacity, price_range, signup_open_at, google_form_url, signup_method, status, created_by",
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

  const upcoming = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return events
      .filter((e) => e.status === "approved" && (e.end_date ?? e.event_date) >= todayKey)
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
            <h2 className="mb-3 text-sm font-bold text-brand-700">다가오는 일정</h2>
            {upcoming.length === 0 && <p className="text-xs text-brand-300">예정된 일정이 없어요.</p>}
            <ul className="space-y-2">
              {upcoming.map((e) => (
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
                    <p className="mt-1 text-xs text-brand-500">
                      주최자: {(hostNames[e.id] ?? []).join(", ") || "-"}
                    </p>
                    <p className="text-xs text-brand-500">기간: {formatDateRange(e)}</p>
                    {formatTimeRange(e) && (
                      <p className="text-xs text-brand-500">시간: {formatTimeRange(e)}</p>
                    )}
                    <p className="text-xs text-brand-500">
                      장소: {e.location}
                      {e.location_2 ? ` / ${e.location_2}` : ""}
                    </p>
                    {meta.needsItems && e.items && (
                      <p className="text-xs text-brand-500">
                        {meta.itemsLabel}: {e.items}
                      </p>
                    )}
                    {meta.needsPrice && e.price_range && (
                      <p className="text-xs text-brand-500">예상 가격대: {e.price_range}</p>
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
                        구글폼으로 신청하기
                      </a>
                    )}

                    {isOfficer && meta.signup === "manual" && (
                      <ManualParticipants eventId={e.id} supabase={supabase} />
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

function ManualParticipants({
  eventId,
  supabase,
}: {
  eventId: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const [participants, setParticipants] = useState<
    { profile_id: string; name: string; student_id: string }[]
  >([]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; student_id: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("event_participants")
      .select("profile_id, profiles(name, student_id)")
      .eq("event_id", eventId);
    setParticipants(
      ((data as unknown as { profile_id: string; profiles: { name: string; student_id: string } | null }[]) ?? []).map(
        (r) => ({ profile_id: r.profile_id, name: r.profiles?.name ?? "-", student_id: r.profiles?.student_id ?? "-" }),
      ),
    );
  }, [supabase, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSearch() {
    setMessage(null);
    setFound(null);
    const { data } = await supabase
      .from("profiles")
      .select("id, name, student_id")
      .or(`student_id.eq.${query.trim()},username.eq.${query.trim()}`)
      .limit(1)
      .maybeSingle();
    if (!data) {
      setMessage("일치하는 회원을 찾을 수 없습니다.");
      return;
    }
    setFound(data);
  }

  async function handleAdd() {
    if (!found) return;
    const { error } = await supabase.rpc("admin_add_participant", {
      p_event_id: eventId,
      p_profile_id: found.id,
    });
    if (error) {
      setMessage("등록에 실패했습니다.");
      return;
    }
    setQuery("");
    setFound(null);
    load();
  }

  async function handleRemove(profileId: string) {
    await supabase.rpc("admin_remove_participant", { p_event_id: eventId, p_profile_id: profileId });
    load();
  }

  return (
    <div className="mt-3 rounded-lg bg-brand-50 p-3">
      <p className="text-xs font-bold text-brand-700">참여자 수동 등록 (임원진)</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학번 또는 아이디"
          className="rounded-lg border border-brand-100 px-2 py-1 text-xs"
        />
        <button
          onClick={handleSearch}
          className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100/70"
        >
          검색
        </button>
        {found && (
          <>
            <span className="text-xs text-brand-700">{found.name} ({found.student_id})</span>
            <button
              onClick={handleAdd}
              className="rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white hover:bg-accent-700"
            >
              추가
            </button>
          </>
        )}
      </div>
      {message && <p className="mt-1 text-xs text-red-500">{message}</p>}

      <ul className="mt-2 space-y-1">
        {participants.map((p) => (
          <li key={p.profile_id} className="flex items-center justify-between text-xs text-brand-700">
            <span>
              {p.name} ({p.student_id})
            </span>
            <button
              onClick={() => handleRemove(p.profile_id)}
              className="text-brand-300 hover:text-red-600"
            >
              삭제
            </button>
          </li>
        ))}
        {participants.length === 0 && <li className="text-xs text-brand-300">등록된 참여자가 없어요.</li>}
      </ul>
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
  const meta = categoryMeta(category);

  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [location2, setLocation2] = useState("");
  const [items, setItems] = useState("");
  const [capacity, setCapacity] = useState("6");
  const [priceRange, setPriceRange] = useState("");
  const [signupOpenDate, setSignupOpenDate] = useState("");
  const [signupOpenTime, setSignupOpenTime] = useState("");
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [studioConfirmed, setStudioConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const needsStudio = STUDIO_REQUIRED_CATEGORIES.includes(category);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsStudio && !studioConfirmed) {
      setError("베이킹 스튜디오 예약 여부를 먼저 확인해주세요.");
      return;
    }
    if (meta.timeMode === "range" && endTime && endTime <= startTime) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    if (meta.dateMode === "range" && endDate && endDate < eventDate) {
      setError("종료 날짜는 시작 날짜보다 늦어야 합니다.");
      return;
    }

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
        end_date: meta.dateMode === "range" ? endDate : null,
        start_time: meta.timeMode === "none" ? null : startTime,
        end_time: meta.timeMode === "range" ? endTime : null,
        location,
        location_2: meta.location === "double" ? location2 : null,
        items: meta.needsItems ? items : null,
        price_range: meta.needsPrice ? priceRange : null,
        capacity: meta.signup === "in_app_auto" ? Number(capacity) : null,
        signup_open_at:
          meta.signup === "in_app_auto"
            ? new Date(`${signupOpenDate}T${signupOpenTime}`).toISOString()
            : null,
        google_form_url: meta.needsGoogleForm ? googleFormUrl : null,
        signup_method: meta.signup,
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertError || !created) {
      setLoading(false);
      console.error("insertError", insertError);
      setError("일정 등록에 실패했습니다: " + (insertError?.message ?? "unknown"));
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
            자유주최
          </p>
        )}
      </label>

      {needsStudio && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={studioConfirmed}
              onChange={(e) => setStudioConfirmed(e.target.checked)}
            />
            베이킹 스튜디오 예약을 완료하셨나요?
          </label>
          {!studioConfirmed && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <a
                href={BAKING_PLACE.blogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent-700 hover:underline"
              >
                예약하러 가기 ({BAKING_PLACE.phone})
              </a>
              <Link href="/guide" className="font-semibold text-accent-700 hover:underline">
                주최하는 방법을 모르겠다면? 운영규칙 &gt; 주최 가이드
              </Link>
            </div>
          )}
        </div>
      )}

      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-brand-700">
          {meta.dateMode === "range" ? "시작 날짜" : "날짜"}
        </span>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      {meta.dateMode === "range" && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">종료 날짜</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {meta.timeMode !== "none" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">시작 시간</span>
          <TimeSelect value={startTime} onChange={setStartTime} />
        </label>
      )}
      {meta.timeMode === "range" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">종료 시간</span>
          <TimeSelect value={endTime} onChange={setEndTime} />
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">
          {meta.location === "double" ? "장소 1" : "장소"}
        </span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      {meta.location === "double" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">장소 2</span>
          <input
            value={location2}
            onChange={(e) => setLocation2(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {meta.signup === "in_app_auto" && (
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
      )}

      {meta.needsItems && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">{meta.itemsLabel}</span>
          <input
            value={items}
            onChange={(e) => setItems(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}
      {meta.needsPrice && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">예상 가격대</span>
          <input
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {meta.signup === "in_app_auto" && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">신청 오픈 일시</span>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={signupOpenDate}
              onChange={(e) => setSignupOpenDate(e.target.value)}
              required
              className="rounded-lg border border-brand-100 px-3 py-2 text-sm"
            />
            <TimeSelect value={signupOpenTime} onChange={setSignupOpenTime} />
          </div>
        </label>
      )}

      {meta.needsGoogleForm && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">신청 방법 (구글폼 링크)</span>
          <input
            type="url"
            value={googleFormUrl}
            onChange={(e) => setGoogleFormUrl(e.target.value)}
            placeholder="https://forms.gle/..."
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_BY_10 = ["00", "10", "20", "30", "40", "50"];

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hour, minute] = value ? value.split(":") : ["", ""];

  function update(nextHour: string, nextMinute: string) {
    if (nextHour && nextMinute) onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <div className="flex gap-2">
      <select
        value={hour}
        onChange={(e) => update(e.target.value, minute || "00")}
        required
        className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          시
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>
      <select
        value={minute}
        onChange={(e) => update(hour || "00", e.target.value)}
        required
        className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          분
        </option>
        {MINUTES_BY_10.map((m) => (
          <option key={m} value={m}>
            {m}분
          </option>
        ))}
      </select>
    </div>
  );
}
