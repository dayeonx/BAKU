"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { departmentLabel } from "@/lib/departments";
import { isValidPassword, CREDENTIAL_FORMAT_HINT } from "@/lib/validation";
import { Field, inputClass } from "@/components/FormField";

type Coupon = {
  id: string;
  reason: string;
  used: boolean;
  created_at: string;
  max_amount: number | null;
  valid_until: string | null;
};

export default function AccountDrawer({
  userId,
  userEmail,
  name,
  department,
  studentId,
  college: initialCollege,
  major: initialMajor,
}: {
  userId: string;
  userEmail: string | null;
  name: string;
  department: string;
  studentId: string;
  college: string | null;
  major: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [editing, setEditing] = useState(false);
  const [college, setCollege] = useState(initialCollege ?? "");
  const [major, setMajor] = useState(initialMajor ?? "");
  const [saving, setSaving] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("coupons")
        .select("id, reason, used, created_at, max_amount, valid_until")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });
      setCoupons(data ?? []);
    })();
  }, [open, supabase, userId]);

  async function handleProfileSave() {
    setSaving(true);
    await supabase.from("profiles").update({ college: college.trim(), major: major.trim() }).eq("id", userId);
    setSaving(false);
    setEditing(false);
  }

  async function handlePasswordSave() {
    setPasswordError(null);
    if (!isValidPassword(newPassword)) {
      setPasswordError(CREDENTIAL_FORMAT_HINT);
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("새 비밀번호가 서로 일치하지 않아요.");
      return;
    }
    if (!userEmail) return;

    setPasswordSaving(true);
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (reauthError) {
      setPasswordSaving(false);
      setPasswordError("현재 비밀번호가 일치하지 않아요.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (updateError) {
      setPasswordError("비밀번호 변경에 실패했어요.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setChangingPassword(false);
    setPasswordDone(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-semibold text-brand-700 transition-colors hover:text-accent-500"
      >
        {name}
        <span className="ml-1 font-normal text-brand-300">{departmentLabel(department)}</span>
      </button>

      {mounted &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 transition-opacity ${
              open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
        <div
          className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white p-5 shadow-xl transition-transform duration-300 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-brand-700">계정 정보</p>
            <button onClick={() => setOpen(false)} className="text-sm text-brand-300 hover:text-brand-700">
              닫기
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-brand-700">{name}</p>
                <p className="text-xs text-brand-500">
                  {studentId} · {departmentLabel(department)}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                >
                  프로필 수정
                </button>
                <button
                  onClick={() => {
                    setChangingPassword((v) => !v);
                    setPasswordDone(false);
                  }}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                >
                  비밀번호 변경
                </button>
              </div>
            </div>

            {!editing && (
              <p className="mt-3 text-xs text-brand-500">
                {initialCollege || "단과대 미입력"} · {initialMajor || "학과 미입력"}
              </p>
            )}

            {editing && (
              <div className="mt-3 space-y-2">
                <Field label="단과대">
                  <input value={college} onChange={(e) => setCollege(e.target.value)} className={inputClass} />
                </Field>
                <Field label="학과">
                  <input value={major} onChange={(e) => setMajor(e.target.value)} className={inputClass} />
                </Field>
                <button
                  onClick={handleProfileSave}
                  disabled={saving}
                  className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
                >
                  {saving ? "저장 중..." : "저장하기"}
                </button>
              </div>
            )}

            {changingPassword && (
              <div className="mt-3 space-y-2 border-t border-brand-100 pt-3">
                <Field label="현재 비밀번호">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="새 비밀번호">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={CREDENTIAL_FORMAT_HINT}
                    className={inputClass}
                  />
                </Field>
                <Field label="새 비밀번호 확인">
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
                <button
                  onClick={handlePasswordSave}
                  disabled={passwordSaving}
                  className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
                >
                  {passwordSaving ? "변경 중..." : "비밀번호 변경하기"}
                </button>
              </div>
            )}
            {passwordDone && <p className="mt-3 text-xs text-accent-700">비밀번호가 변경됐어요.</p>}
          </div>

          <div className="mt-6 border-t border-brand-100 pt-4">
            <p className="text-sm font-bold text-brand-700">쿠폰 관리</p>
            <div className="mt-2">
              <CouponList coupons={coupons} />
            </div>
          </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function CouponList({ coupons }: { coupons: Coupon[] }) {
  if (coupons.length === 0) {
    return <p className="text-sm text-brand-300">아직 발급된 쿠폰이 없어요.</p>;
  }
  return (
    <ul className="space-y-2">
      {coupons.map((c) => (
        <li
          key={c.id}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
            c.used ? "border-brand-100 bg-brand-50 text-brand-300" : "border-accent-500/30 bg-white text-brand-700"
          }`}
        >
          <span>
            {c.reason}
            {c.max_amount !== null && (
              <span className="ml-2 text-xs text-brand-300">최대 {c.max_amount.toLocaleString()}원</span>
            )}
            {c.valid_until && <span className="ml-2 text-xs text-brand-300">~{c.valid_until}까지</span>}
          </span>
          <span className="text-xs font-semibold">{c.used ? "사용완료" : "사용가능"}</span>
        </li>
      ))}
    </ul>
  );
}
