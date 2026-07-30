"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel } from "@/lib/eventCategories";
import { semesterLabel, currentSemesterLabel } from "@/lib/semester";
import { isEventOver } from "@/lib/eventTime";

const BAKING_CATEGORIES = ["regular", "free", "monthly_special"];
const PAST_SEMESTERS_PREVIEW = 3;

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
  cover_photo_position: string | null;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displaySemester(label: string): string {
  return label.replace("학기", "");
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
  const [showAllPastSemesters, setShowAllPastSemesters] = useState(false);

  useEffect(() => {
    (async () => {
      const todayKey = toDateKey(new Date());
      const { data } = await supabase
        .from("events")
        .select(
          "id, category, event_date, end_date, location, items, price_range, start_time, end_time, cover_photo_url, cover_photo_position",
        )
        .eq("status", "approved")
        .lte("event_date", todayKey)
        .order("event_date", { ascending: false });

      const finished = (data ?? []).filter((e) => isEventOver(e));
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
  const visiblePastSemesters = showAllPastSemesters
    ? pastSemesters
    : pastSemesters.slice(0, PAST_SEMESTERS_PREVIEW);

  const eventsInSemester = useMemo(
    () => events.filter((e) => semesterLabel(e.event_date) === selectedSemester),
    [events, selectedSemester],
  );

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

  const recentItems = useMemo(
    () =>
      Array.from(itemFrequency.entries())
        .sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate))
        .slice(0, 3)
        .map(([name]) => name),
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

      {!isViewingCurrent && (
        <div className="mt-6 flex items-center gap-3">
          <h2 className="text-lg font-bold text-brand-700">{displaySemester(selectedSemester!)}</h2>
          <button
            onClick={() => setSelectedSemester(currentSemesterLabel())}
            className="text-xs font-semibold text-accent-700 hover:underline"
          >
            이번 학기로 돌아가기
          </button>
        </div>
      )}

      <section className="mt-6">
        {eventsInSemester.length === 0 ? (
          <p className="text-sm text-brand-300">이 학기에 종료된 활동이 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-5">
            {eventsInSemester.map((e) => {
              const hashtags = [categoryLabel(e.category), ...(e.items ? splitItems(e.items) : [])];
              return (
                <Link key={e.id} href={`/album/${e.id}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-50">
                    {e.cover_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.cover_photo_url}
                        alt=""
                        style={{ objectPosition: e.cover_photo_position ?? "50% 50%" }}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-brand-300">
                        아직 사진이 등록되지 않았습니다
                      </div>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-brand-500">
                    {hashtags.map((tag) => `#${tag}`).join(" ")}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 border-t border-brand-100 pt-8 sm:grid-cols-2">
        <div className="rounded-2xl border border-brand-100 bg-white p-5">
          <h3 className="text-sm font-bold text-brand-700">이번 학기</h3>
          <dl className="mt-3 divide-y divide-brand-50 text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-brand-500">베이킹 횟수</dt>
              <dd className="font-semibold text-brand-700">{stats.count}회</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-brand-500">평균 베이킹 비용</dt>
              <dd className="font-semibold text-brand-700">
                {stats.avgPrice !== null ? `약 ${stats.avgPrice.toLocaleString()}원` : "-"}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-brand-500">평균 소요 시간</dt>
              <dd className="font-semibold text-brand-700">
                {stats.avgDuration !== null ? formatMinutes(stats.avgDuration) : "-"}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-brand-500">최근 베이킹 품목</dt>
              <dd className="font-semibold text-brand-700">
                {recentItems.length > 0 ? recentItems.join(", ") : "-"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white p-5">
          <h3 className="text-sm font-bold text-brand-700">지난 학기</h3>
          {pastSemesters.length === 0 ? (
            <p className="mt-3 text-sm text-brand-300">지난 학기 기록이 없어요.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {visiblePastSemesters.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSemester(s)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    selectedSemester === s
                      ? "bg-accent-500 text-white"
                      : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                  }`}
                >
                  {displaySemester(s)}
                </button>
              ))}
              {!showAllPastSemesters && pastSemesters.length > PAST_SEMESTERS_PREVIEW && (
                <button
                  onClick={() => setShowAllPastSemesters(true)}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand-300 hover:bg-brand-50"
                >
                  더보기
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
