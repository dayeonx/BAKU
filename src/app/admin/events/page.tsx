"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, categoryColor } from "@/lib/eventCategories";

const STATUS_TABS: { value: "pending" | "approved" | "rejected"; label: string }[] = [
  { value: "pending", label: "승인 대기" },
  { value: "approved", label: "승인됨" },
  { value: "rejected", label: "거절됨" },
];

type EventRow = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  location: string;
  items: string | null;
  status: "pending" | "approved" | "rejected";
  signup_method: "in_app_auto" | "manual" | "none";
  host_name: string;
};

export default function AdminEventsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [events, setEvents] = useState<EventRow[]>([]);

  const load = useCallback(async () => {
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
    const officer = !!myProfile && myProfile.department !== "member" && myProfile.status === "active";
    setIsOfficer(officer);

    if (officer) {
      const { data } = await supabase
        .from("events")
        .select("id, category, event_date, end_date, location, items, status, signup_method, profiles(name)")
        .order("event_date", { ascending: false });
      setEvents(
        (data ?? []).map((e) => {
          const p = e.profiles as unknown as { name: string } | null;
          return { ...e, host_name: p?.name ?? "-" };
        }),
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecision(id: string, status: "approved" | "rejected") {
    await supabase.from("events").update({ status }).eq("id", id);
    load();
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  const filtered = events.filter((e) => e.status === tab);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-700">행사 관리</h1>
          <p className="mt-2 text-sm text-brand-500">전체 행사를 상태별로 확인하고 승인·거절할 수 있어요.</p>
        </div>
        <Link
          href="/calendar"
          className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700"
        >
          캘린더에서 새 일정 등록하기 →
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s.value}
            onClick={() => setTab(s.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === s.value ? "bg-accent-500 text-white" : "bg-white text-brand-500 hover:bg-brand-50"
            }`}
          >
            {s.label} ({events.filter((e) => e.status === s.value).length})
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-brand-300">해당하는 행사가 없어요.</p>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(e.category) }} />
                <span className="font-semibold text-brand-700">{categoryLabel(e.category)}</span>
                <span className="text-brand-500">
                  {e.event_date}
                  {e.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {e.location}
                  {e.items ? ` · ${e.items}` : ""}
                </span>
                <span className="text-xs text-brand-300">주최자 {e.host_name}</span>
              </div>
              <div className="flex items-center gap-2">
                {e.signup_method === "manual" && e.status === "approved" && (
                  <Link
                    href="/admin/participants"
                    className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200"
                  >
                    참여자 명단 등록
                  </Link>
                )}
                {e.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleDecision(e.id, "approved")}
                      className="rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white hover:bg-accent-700"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleDecision(e.id, "rejected")}
                      className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-red-50 hover:text-red-600"
                    >
                      거절
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
