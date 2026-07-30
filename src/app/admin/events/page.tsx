"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES, categoryLabel, categoryColor } from "@/lib/eventCategories";
import EventRegisterForm from "@/components/EventRegisterForm";

const OFFICER_CATEGORIES = EVENT_CATEGORIES.filter((c) => c.value !== "free");

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
  host_name: string | null;
  host_account_name: string;
};

export default function AdminEventsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [openParticipantsFor, setOpenParticipantsFor] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
        .select(
          "id, category, event_date, end_date, location, items, status, signup_method, host_name, profiles!events_created_by_fkey(name)",
        )
        .order("event_date", { ascending: false });
      setEvents(
        (data ?? []).map((e) => {
          const p = e.profiles as unknown as { name: string } | null;
          return { ...e, host_account_name: p?.name ?? "-" };
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
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700"
        >
          {showForm ? "닫기" : "+ 새 일정 등록"}
        </button>
      </div>

      {showForm && (
        <EventRegisterForm
          categories={OFFICER_CATEGORIES}
          autoApprove
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

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
            <div key={e.id} className="rounded-lg border border-brand-100 bg-white px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(e.category) }} />
                  <span className="font-semibold text-brand-700">{categoryLabel(e.category)}</span>
                  <span className="text-brand-500">
                    {e.event_date}
                    {e.end_date && e.end_date !== e.event_date ? ` ~ ${e.end_date}` : ""} · {e.location}
                    {e.items ? ` · ${e.items}` : ""}
                  </span>
                  <span className="text-xs text-brand-300">
                    주최자 {e.host_name || e.host_account_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {e.signup_method === "manual" && e.status === "approved" && (
                    <button
                      onClick={() => setOpenParticipantsFor((cur) => (cur === e.id ? null : e.id))}
                      className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200"
                    >
                      참여자 명단 등록 {openParticipantsFor === e.id ? "▲" : "▼"}
                    </button>
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

              {openParticipantsFor === e.id && <ParticipantUploadPanel eventId={e.id} supabase={supabase} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ParticipantUploadPanel({
  eventId,
  supabase,
}: {
  eventId: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: string[]; skipped: { row: string; reason: string }[] } | null>(
    null,
  );

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

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
        p_event_id: eventId,
        p_profile_id: profile.id,
      });

      if (error) {
        skipped.push({ row: label, reason: `등록 실패: ${error.message}` });
        continue;
      }

      created.push(label);
    }

    setUploading(false);
    setResult({ created, skipped });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="mt-3 rounded-xl bg-brand-50 p-3">
      <p className="text-xs text-brand-500">
        열 이름은 &quot;이름&quot;, &quot;학번&quot;이어야 하며, 이름과 학번이 모두 일치하는 계정만 등록돼요.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="text-xs" />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {uploading ? "등록 중..." : "업로드"}
        </button>
      </div>

      {result && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="text-accent-700">등록 완료: {result.created.length}명</p>
          {result.skipped.length > 0 && (
            <div className="text-red-600">
              <p>건너뜀: {result.skipped.length}건</p>
              <ul className="ml-4 list-disc">
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
  );
}
