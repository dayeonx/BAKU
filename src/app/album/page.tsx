"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel } from "@/lib/eventCategories";
import { semesterLabel, currentSemesterLabel, semesterDateRange } from "@/lib/semester";

const BAKING_CATEGORIES = ["regular", "free", "monthly_special"];

type AlbumEvent = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  location: string;
  items: string | null;
  price_range: string | null;
  start_time: string | null;
  end_time: string | null;
  cover_photo_url: string | null;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function parsePrice(priceRange: string | null): number | null {
  if (!priceRange) return null;
  const match = priceRange.replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function splitItems(items: string): string[] {
  return items
    .split(/[,\/·、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function AlbumPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AlbumEvent[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archiveRef = useRef<HTMLDivElement>(null);
  const [topHost, setTopHost] = useState<{ username: string; count: number } | null>(null);
  const [topParticipant, setTopParticipant] = useState<{ username: string; count: number } | null>(null);

  useEffect(() => {
    (async () => {
      const todayKey = toDateKey(new Date());
      const { data } = await supabase
        .from("events")
        .select(
          "id, category, event_date, end_date, location, items, price_range, start_time, end_time, cover_photo_url",
        )
        .eq("status", "approved")
        .lt("event_date", todayKey)
        .order("event_date", { ascending: false });

      const finished = (data ?? []).filter((e) => (e.end_date ?? e.event_date) < todayKey);
      setEvents(finished);
      setSelectedSemester(currentSemesterLabel());
      setLoading(false);
    })();
  }, [supabase]);

  const semesters = useMemo(() => {
    const set = new Set(events.map((e) => semesterLabel(e.event_date)));
    set.add(currentSemesterLabel());
    return Array.from(set).sort().reverse();
  }, [events]);

  const pastSemesters = useMemo(
    () => semesters.filter((s) => s !== currentSemesterLabel()),
    [semesters],
  );
  const isViewingCurrent = selectedSemester === currentSemesterLabel();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (archiveRef.current && !archiveRef.current.contains(e.target as Node)) {
        setArchiveOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const eventsInSemester = useMemo(
    () => events.filter((e) => semesterLabel(e.event_date) === selectedSemester),
    [events, selectedSemester],
  );

  useEffect(() => {
    if (!selectedSemester) return;
    (async () => {
      const { start, endExclusive } = semesterDateRange(selectedSemester);
      const [{ data: hostRow }, { data: participantRow }] = await Promise.all([
        supabase.rpc("album_top_host", { p_start: start, p_end_exclusive: endExclusive }),
        supabase.rpc("album_top_participant", { p_start: start, p_end_exclusive: endExclusive }),
      ]);
      const host = hostRow?.[0];
      const participant = participantRow?.[0];
      setTopHost(host ? { username: host.username, count: host.host_count } : null);
      setTopParticipant(
        participant ? { username: participant.username, count: participant.participation_count } : null,
      );
    })();
  }, [selectedSemester, supabase]);

  const bakingEvents = useMemo(
    () => eventsInSemester.filter((e) => BAKING_CATEGORIES.includes(e.category)),
    [eventsInSemester],
  );

  const itemFrequency = useMemo(() => {
    const freq = new Map<string, { count: number; lastDate: string }>();
    for (const e of bakingEvents) {
      if (!e.items) continue;
      for (const item of splitItems(e.items)) {
        const prev = freq.get(item);
        freq.set(item, {
          count: (prev?.count ?? 0) + 1,
          lastDate: prev && prev.lastDate > e.event_date ? prev.lastDate : e.event_date,
        });
      }
    }
    return freq;
  }, [bakingEvents]);

  const topFrequent = useMemo(
    () =>
      Array.from(itemFrequency.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5),
    [itemFrequency],
  );

  const leastRecent = useMemo(
    () =>
      Array.from(itemFrequency.entries())
        .sort((a, b) => a[1].lastDate.localeCompare(b[1].lastDate))
        .slice(0, 5),
    [itemFrequency],
  );

  const stats = useMemo(() => {
    const count = bakingEvents.length;
    const prices = bakingEvents.map((e) => parsePrice(e.price_range)).filter((p): p is number => p !== null);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
    const durations = bakingEvents
      .filter((e) => e.start_time && e.end_time)
      .map((e) => timeToMinutes(e.end_time!) - timeToMinutes(e.start_time!));
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    return { count, avgPrice, avgDuration };
  }, [bakingEvents]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">앨범</h1>
      <p className="mt-2 text-sm text-brand-500">종료된 동아리 활동의 기록과 후기를 모아볼 수 있어요.</p>

      <div className="mt-6 flex items-center gap-3">
        <h2 className="text-lg font-bold text-brand-700">
          {isViewingCurrent ? "이번 학기" : selectedSemester}
        </h2>
        {!isViewingCurrent && (
          <button
            onClick={() => setSelectedSemester(currentSemesterLabel())}
            className="text-xs font-semibold text-accent-700 hover:underline"
          >
            이번 학기로 돌아가기
          </button>
        )}
        <div ref={archiveRef} className="relative ml-auto">
          <button
            onClick={() => setArchiveOpen((v) => !v)}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand-500 transition-colors hover:bg-brand-50"
          >
            지난 학기 아카이브 {archiveOpen ? "▲" : "▼"}
          </button>
          {archiveOpen && (
            <div className="absolute right-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-xl border border-brand-100 bg-white shadow-lg">
              {pastSemesters.length === 0 ? (
                <p className="px-4 py-2.5 text-xs text-brand-300">지난 학기 기록이 없어요.</p>
              ) : (
                pastSemesters.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSelectedSemester(s);
                      setArchiveOpen(false);
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-brand-50 ${
                      selectedSemester === s ? "font-semibold text-accent-700" : "text-brand-700"
                    }`}
                  >
                    {s}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-700">
        <span>
          베이킹 <strong>{stats.count}회</strong>
        </span>
        <span className="text-brand-200">|</span>
        <span>
          평균 가격 <strong>{stats.avgPrice !== null ? `약 ${stats.avgPrice.toLocaleString()}원` : "-"}</strong>
        </span>
        <span className="text-brand-200">|</span>
        <span>
          평균 소요 <strong>{stats.avgDuration !== null ? formatMinutes(stats.avgDuration) : "-"}</strong>
        </span>
        <button
          onClick={() => setShowRanking((v) => !v)}
          className="ml-auto text-xs font-semibold text-accent-700 hover:underline"
        >
          {showRanking ? "품목 랭킹 접기 ▲" : "품목 랭킹 보기 ▼"}
        </button>
      </div>

      {showRanking && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <RankCard title="자주 만든 빵" items={topFrequent.map(([name, v]) => `${name} (${v.count}회)`)} />
          <RankCard
            title="오랜만에 만든 빵"
            items={leastRecent.map(([name, v]) => `${name} · 마지막 ${formatShortDate(v.lastDate)}`)}
          />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TopMemberCard
          title={`${isViewingCurrent ? "이번학기" : selectedSemester} 최다 베이킹 주최자`}
          member={topHost}
          unit="회 주최"
        />
        <TopMemberCard
          title={`${isViewingCurrent ? "이번학기" : selectedSemester} 최다 베이킹 참여자`}
          member={topParticipant}
          unit="회 참여"
        />
      </div>

      <section className="mt-8">
        {eventsInSemester.length === 0 ? (
          <p className="text-sm text-brand-300">이 학기에 종료된 활동이 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-4">
            {eventsInSemester.map((e) => (
              <Link key={e.id} href={`/album/${e.id}`} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-50">
                  {e.cover_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.cover_photo_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-brand-300">
                      아직 사진이 등록되지 않았습니다
                    </div>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-semibold text-brand-700">
                  {categoryLabel(e.category)} · {formatShortDate(e.event_date)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TopMemberCard({
  title,
  member,
  unit,
}: {
  title: string;
  member: { username: string; count: number } | null;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4 text-center">
      <p className="text-xs text-brand-500">{title}</p>
      {member ? (
        <p className="mt-1">
          <span className="text-lg font-extrabold text-brand-700">{member.username}</span>
          <span className="ml-1.5 text-sm font-semibold text-accent-700">
            {member.count}
            {unit}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-brand-300">아직 데이터가 없어요.</p>
      )}
    </div>
  );
}

function RankCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4">
      <p className="text-sm font-bold text-brand-700">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-brand-300">아직 데이터가 없어요.</p>
      ) : (
        <ol className="mt-2 space-y-1 text-sm text-brand-500">
          {items.map((item, i) => (
            <li key={i}>
              {i + 1}. {item}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
