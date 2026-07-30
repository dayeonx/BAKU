"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS, departmentLabel } from "@/lib/departments";

type Profile = {
  id: string;
  student_id: string;
  username: string;
  name: string;
  college: string | null;
  major: string | null;
  department: string;
  status: "pending_approval" | "active" | "inactive";
  semester_count: number;
};

const STATUS_LABEL: Record<Profile["status"], string> = {
  pending_approval: "승인 대기",
  active: "활성",
  inactive: "비활성",
};

function departmentValueFromLabel(label: string): string {
  const found = DEPARTMENTS.find((d) => d.label === label || d.value === label);
  return found?.value ?? "member";
}

export default function AdminMembersPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [isPresident, setIsPresident] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

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

    const president = !!myProfile && myProfile.department === "president" && myProfile.status === "active";
    setIsPresident(president);

    if (president) {
      const { data } = await supabase
        .from("profiles")
        .select("id, student_id, username, name, college, major, department, status, semester_count")
        .order("department", { ascending: true })
        .order("name", { ascending: true });
      setProfiles(data ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function updateStatus(id: string, status: Profile["status"]) {
    await supabase.from("profiles").update({ status }).eq("id", id);
    loadData();
  }

  async function updateDepartment(id: string, department: string) {
    await supabase.from("profiles").update({ department }).eq("id", id);
    loadData();
  }

  async function rejectPending(id: string) {
    const res = await fetch("/api/admin/members/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setMessage("가입 신청을 거절했습니다.");
      loadData();
    } else {
      setMessage("거절 처리에 실패했습니다.");
    }
  }

  async function resetPassword(id: string, name: string) {
    const res = await fetch("/api/admin/members/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(
        `${name} 님의 비밀번호가 학번(${json.temp_password})으로 초기화됐습니다. 다음 로그인 시 변경이 강제됩니다.`,
      );
    } else {
      setMessage(json.error ?? "비밀번호 초기화에 실패했습니다.");
    }
  }

  async function handleExcelUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    const members = rows.map((row) => ({
      student_id: String(row["학번"] ?? "").trim(),
      name: String(row["이름"] ?? "").trim(),
      college: String(row["단과대"] ?? "").trim(),
      major: String(row["학과"] ?? "").trim(),
      department: departmentValueFromLabel(String(row["부서"] ?? "member").trim()),
    }));

    const res = await fetch("/api/admin/members/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members }),
    });
    const json = await res.json();
    setUploading(false);

    if (res.ok) {
      setMessage(
        `등록 완료: ${json.created.length}명 생성됨` +
          (json.skipped.length > 0
            ? ` / 건너뜀 ${json.skipped.length}건 (${json.skipped
                .map((s: { student_id: string; reason: string }) => `${s.student_id}: ${s.reason}`)
                .join(", ")})`
            : ""),
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadData();
    } else {
      setMessage(json.error ?? "업로드에 실패했습니다.");
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isPresident) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-brand-500">
        접근 권한이 없습니다.
      </div>
    );
  }

  const pending = profiles.filter((p) => p.status === "pending_approval");
  const officers = profiles.filter((p) => p.department !== "member" && p.status !== "pending_approval");
  const members = profiles.filter((p) => p.department === "member" && p.status !== "pending_approval");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">학기 회원 관리</h1>

      {message && (
        <p className="mt-4 rounded-lg bg-accent-100 px-4 py-3 text-sm text-accent-700">{message}</p>
      )}

      {isPresident && (
        <section className="mt-8 rounded-xl border border-brand-100 bg-white p-5">
          <h2 className="text-sm font-bold text-brand-700">엑셀로 회원 일괄 등록</h2>
          <p className="mt-1 text-xs text-brand-500">
            열 이름: 학번, 이름, 단과대, 학과, 부서(선택, 예: 일반 회원/집행부/기획부/총무부/홍보부/회장단). 최초
            아이디·비밀번호는 모두 학번으로 발급되며, 첫 로그인 시 변경이 강제됩니다.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="text-sm" />
            <button
              onClick={handleExcelUpload}
              disabled={uploading}
              className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {uploading ? "업로드 중..." : "업로드"}
            </button>
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <Section title={`승인 대기 (${pending.length})`}>
          {pending.map((p) => (
            <Row key={p.id}>
              <RowInfo profile={p} />
              {isPresident && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(p.id, "active")}
                    className="rounded-full bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                  >
                    승인
                  </button>
                  <ConfirmButton
                    label="거절"
                    confirmLabel="정말 거절?"
                    tone="danger"
                    onConfirm={() => rejectPending(p.id)}
                  />
                </div>
              )}
            </Row>
          ))}
        </Section>
      )}

      <Section title={`임원진 (${officers.length})`}>
        {officers.map((p) => (
          <Row key={p.id}>
            <RowInfo profile={p} />
            {isPresident && (
              <RowActions
                profile={p}
                onDepartmentChange={(dept) => updateDepartment(p.id, dept)}
                onStatusToggle={() =>
                  updateStatus(p.id, p.status === "active" ? "inactive" : "active")
                }
                onResetPassword={() => resetPassword(p.id, p.name)}
              />
            )}
          </Row>
        ))}
      </Section>

      <Section title={`일반 부원 (${members.length})`}>
        {members.map((p) => (
          <Row key={p.id}>
            <RowInfo profile={p} />
            {isPresident && (
              <RowActions
                profile={p}
                onDepartmentChange={(dept) => updateDepartment(p.id, dept)}
                onStatusToggle={() =>
                  updateStatus(p.id, p.status === "active" ? "inactive" : "active")
                }
                onResetPassword={() => resetPassword(p.id, p.name)}
              />
            )}
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-bold text-brand-700">{title}</h2>
      <div className="divide-y divide-brand-100 rounded-xl border border-brand-100 bg-white">
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {children}
    </div>
  );
}

function RowInfo({ profile }: { profile: Profile }) {
  return (
    <div className="text-sm">
      <span className="font-semibold text-brand-700">{profile.name}</span>
      <span className="ml-2 text-brand-500">{profile.student_id}</span>
      <span className="ml-2 text-brand-300">@{profile.username}</span>
      <span className="ml-2 text-brand-300">
        {[profile.college, profile.major].filter(Boolean).join(" · ") || "-"}
      </span>
      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
        {departmentLabel(profile.department)}
      </span>
      <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-xs text-accent-700">
        {STATUS_LABEL[profile.status]}
      </span>
      <span className="ml-2 text-xs text-brand-300">{profile.semester_count}학기째</span>
    </div>
  );
}

function RowActions({
  profile,
  onDepartmentChange,
  onStatusToggle,
  onResetPassword,
}: {
  profile: Profile;
  onDepartmentChange: (dept: string) => void;
  onStatusToggle: () => void;
  onResetPassword: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={profile.department}
        onChange={(e) => onDepartmentChange(e.target.value)}
        className="rounded-lg border border-brand-100 px-2 py-1 text-xs"
      >
        {DEPARTMENTS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      <button
        onClick={onStatusToggle}
        className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100/70"
      >
        {profile.status === "active" ? "비활성화" : "재활성화"}
      </button>
      <ConfirmButton label="비밀번호 초기화" confirmLabel="정말 초기화?" onConfirm={onResetPassword} />
    </div>
  );
}

// 브라우저 네이티브 confirm()은 자동화 테스트/디자인 일관성과 맞지 않아, 클릭 두 번으로 확인하는 인라인 버튼을 사용한다.
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  tone = "neutral",
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: "neutral" | "danger";
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${
            tone === "danger" ? "bg-red-500 hover:bg-red-600" : "bg-accent-500 hover:bg-accent-700"
          }`}
        >
          {confirmLabel}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100/70"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100/70"
    >
      {label}
    </button>
  );
}
