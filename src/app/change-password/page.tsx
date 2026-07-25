"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass } from "@/components/FormField";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      setError("로그인이 필요합니다.");
      return;
    }

    const { error: updateAuthError } = await supabase.auth.updateUser({ password });
    if (updateAuthError) {
      setLoading(false);
      setError("비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userData.user.id);

    setLoading(false);

    if (profileError) {
      setError("비밀번호는 변경됐지만 상태 업데이트에 실패했습니다. 새로고침해주세요.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <h1 className="mb-2 text-xl font-bold text-brand-700">비밀번호 변경</h1>
      <p className="mb-8 text-sm text-brand-500">
        임시 비밀번호로 로그인하셨어요. 계속 이용하시려면 비밀번호를 새로 설정해주세요.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="새 비밀번호">
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="새 비밀번호 확인">
          <input
            className={inputClass}
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60"
        >
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}
