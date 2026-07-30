"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_SECTIONS = [
  { emoji: "📋", title: "프로젝트별 업무 공유", href: "/admin/tasks" },
  { emoji: "📁", title: "구글 드라이브", href: "/admin/drive" },
  { emoji: "🗓️", title: "행사 관리", href: "/admin/events" },
  { emoji: "💰", title: "정산 관리", href: "/admin/settlements" },
  { emoji: "🎟️", title: "쿠폰 관리", href: "/admin/coupons" },
  { emoji: "👥", title: "회원 관리", href: "/admin/members" },
];

export default function AdminHomePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);

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
    setIsOfficer(!!myProfile && myProfile.department !== "member" && myProfile.status === "active");
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">관리자 페이지</h1>

      <section className="mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ADMIN_SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-2xl border border-brand-100 bg-white p-5 text-center transition-colors hover:border-accent-500 hover:bg-brand-50"
            >
              <div className="text-3xl">{s.emoji}</div>
              <div className="mt-2 font-bold text-brand-700">{s.title}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
