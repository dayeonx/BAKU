"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, categoryColor } from "@/lib/eventCategories";

type MyEvent = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string | null;
  location: string;
  items: string | null;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MyPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      if (uid) {
        const { data } = await supabase
          .from("event_participants")
          .select(
            "events(id, category, event_date, end_date, start_time, end_time, location, items)",
          )
          .eq("profile_id", uid);

        const rows = ((data as unknown as { events: MyEvent | null }[]) ?? [])
          .map((r) => r.events)
          .filter((e): e is MyEvent => !!e);
        setMyEvents(rows);
      }

      setLoading(false);
    })();
  }, [supabase]);

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

  if (!userId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-brand-500">
        로그인 후 이용할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">마이페이지</h1>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-brand-700">나의 일정</h2>

        <h3 className="mb-2 text-sm font-bold text-accent-700">앞으로 참여할 일정</h3>
        <EventList events={upcoming} empty="앞으로 참여할 일정이 없어요." />

        <h3 className="mb-2 mt-6 text-sm font-bold text-accent-700">참여 완료한 일정</h3>
        <EventList events={completed} empty="아직 완료한 활동이 없어요." />
      </section>
    </div>
  );
}

function EventList({ events, empty }: { events: MyEvent[]; empty: string }) {
  if (events.length === 0) {
    return <p className="text-sm text-brand-300">{empty}</p>;
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
