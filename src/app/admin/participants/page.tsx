"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel } from "@/lib/eventCategories";

type EventOption = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  location: string;
};

export default function AdminParticipantsPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: string[]; skipped: { row: string; reason: string }[] } | null>(
    null,
  );

  const loadEvents = useCallback(async () => {
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
        .select("id, category, event_date, end_date, location")
        .eq("signup_method", "manual")
        .eq("status", "approved")
        .order("event_date", { ascending: false });
      setEvents(data ?? []);
      if (data && data.length > 0) setSelectedEventId(data[0].id);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedEventId) return;

    setUploading(true);
    setResult(null);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    const created: string[] = [];
    const skipped: { row: string; reason: string }[] = [];

    for (const row of rows) {
      const name = String(row["이름"] ?? "").trim();
      const studentId = String(row["학번"] ?? "").trim();
      const label = `${name || "(이름 없음)"} / ${studentId || "(학번 없음)"}`;

      if (!name || !studentId) {
        skipped.push({ row: label, reason: "이름 또는 학번 누락" });
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("name", name)
        .eq("student_id", studentId)
        .maybeSingle();

      if (!profile) {
        skipped.push({ row: label, reason: "일치하는 회원 계정을 찾을 수 없음" });
        continue;
      }

      const { error } = await supabase.rpc("admin_add_participant", {
        p_event_id: selectedEventId,
        p_profile_id: profile.id,
      });

      if (error) {
        skipped.push({ row: label, reason: "등록 실패" });
        continue;
      }

      created.push(label);
    }

    setUploading(false);
    setResult({ created, skipped });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">참여자 명단 엑셀 등록</h1>
      <p className="mt-2 text-sm text-brand-500">
        엠티/신환회/빵지순례처럼 구글폼 등으로 신청받는 일정의 참여자 명단을 엑셀로 한 번에 등록합니다. 열 이름은
        &quot;이름&quot;, &quot;학번&quot;이어야 하며, 이름과 학번이 모두 일치하는 계정만 등록됩니다.
      </p>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-5">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">대상 일정</span>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.event_date}
                {e.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {categoryLabel(e.category)} ·{" "}
                {e.location}
              </option>
            ))}
          </select>
        </label>
        {events.length === 0 && (
          <p className="mt-2 text-xs text-brand-300">승인된 엠티/신환회/빵지순례 일정이 없어요.</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="text-sm" />
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedEventId}
            className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {uploading ? "등록 중..." : "업로드"}
          </button>
        </div>

        {result && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-accent-700">등록 완료: {result.created.length}명</p>
            {result.skipped.length > 0 && (
              <div className="text-red-600">
                <p>건너뜀: {result.skipped.length}건</p>
                <ul className="ml-4 list-disc text-xs">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
