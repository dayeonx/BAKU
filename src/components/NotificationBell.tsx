"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notif = { type: string; message: string; href: string };

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("department, status")
      .eq("id", uid)
      .single();
    const isOfficer = !!profileData && profileData.department !== "member" && profileData.status === "active";

    const todayKey = toDateKey(new Date());
    const nowIso = new Date().toISOString();
    const results: Notif[] = [];

    const { data: myParticipation } = await supabase
      .from("event_participants")
      .select("event_id, events(event_date, end_date)")
      .eq("profile_id", uid);

    const joinedIds = new Set((myParticipation ?? []).map((r) => r.event_id));
    const hasToday = (myParticipation ?? []).some((r) => {
      const ev = r.events as unknown as { event_date: string; end_date: string | null } | null;
      if (!ev) return false;
      return ev.event_date <= todayKey && (ev.end_date ?? ev.event_date) >= todayKey;
    });
    if (hasToday) {
      results.push({ type: "today", message: "오늘 참여하는 활동이 있어요", href: "/calendar" });
    }

    const { data: openEvents } = await supabase
      .from("events")
      .select("id")
      .eq("status", "approved")
      .eq("signup_method", "in_app_auto")
      .gte("event_date", todayKey)
      .lte("signup_open_at", nowIso);
    const availableCount = (openEvents ?? []).filter((e) => !joinedIds.has(e.id)).length;
    if (availableCount > 0) {
      results.push({
        type: "signup",
        message: `지금 신청 가능한 베이킹 활동이 ${availableCount}건 있어요`,
        href: "/calendar",
      });
    }

    let settlementCount = 0;
    const { data: myUnpaid } = await supabase
      .from("settlement_participants")
      .select("id")
      .eq("profile_id", uid)
      .eq("paid", false);
    settlementCount += myUnpaid?.length ?? 0;

    const { data: hostedEvents } = await supabase
      .from("events")
      .select("id, event_date, end_date")
      .eq("created_by", uid)
      .lt("event_date", todayKey);
    const finishedHostedIds = (hostedEvents ?? [])
      .filter((e) => (e.end_date ?? e.event_date) < todayKey)
      .map((e) => e.id);
    if (finishedHostedIds.length > 0) {
      const { data: mySettlements } = await supabase
        .from("settlements")
        .select("event_id")
        .in("event_id", finishedHostedIds);
      const settledIds = new Set((mySettlements ?? []).map((s) => s.event_id));
      settlementCount += finishedHostedIds.filter((id) => !settledIds.has(id)).length;
    }

    if (isOfficer) {
      const { count } = await supabase
        .from("settlements")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "assigned"]);
      settlementCount += count ?? 0;
    }

    if (settlementCount > 0) {
      results.push({ type: "settlement", message: `처리할 정산이 ${settlementCount}건 있어요`, href: "/mypage" });
    }

    if (isOfficer && profileData) {
      const soonKey = toDateKey(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
      const { data: dueTasks } = await supabase
        .from("work_tasks")
        .select("id")
        .eq("department", profileData.department)
        .neq("status", "done")
        .not("due_date", "is", null)
        .lte("due_date", soonKey);
      if ((dueTasks?.length ?? 0) > 0) {
        results.push({
          type: "tasks",
          message: `임박한 업무가 ${dueTasks!.length}건 있어요`,
          href: "/admin/tasks",
        });
      }
    }

    setNotifs(results);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="알림"
        className="relative flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-500 transition-colors hover:bg-brand-200"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {notifs.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-brand-100 bg-white shadow-lg">
          {notifs.length === 0 ? (
            <p className="px-4 py-3 text-xs text-brand-300">새 알림이 없어요.</p>
          ) : (
            notifs.map((n) => (
              <Link
                key={n.type}
                href={n.href}
                onClick={() => setOpen(false)}
                className="block border-b border-brand-50 px-4 py-3 text-xs text-brand-700 last:border-0 hover:bg-brand-50"
              >
                {n.message}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
