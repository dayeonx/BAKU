"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass } from "@/components/FormField";
import { isValidUsername, isValidPassword, CREDENTIAL_FORMAT_HINT } from "@/lib/validation";

export default function AccountSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      setUserId(userData.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_username, must_change_password")
        .eq("id", userData.user.id)
        .single();

      setNeedsUsername(!!profile?.must_change_username);
      setNeedsPassword(!!profile?.must_change_password);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsUsername && !isValidUsername(username)) {
      setError(`아이디: ${CREDENTIAL_FORMAT_HINT}`);
      return;
    }
    if (needsPassword) {
      if (!isValidPassword(password)) {
        setError(`비밀번호: ${CREDENTIAL_FORMAT_HINT}`);
        return;
      }
      if (password !== passwordConfirm) {
        setError("비밀번호가 일치하지 않습니다.");
        return;
      }
    }

    if (!userId) return;
    setSubmitting(true);

    if (needsUsername) {
      const { error: usernameError } = await supabase
        .from("profiles")
        .update({ username: username.trim(), must_change_username: false })
        .eq("id", userId);

      if (usernameError) {
        setSubmitting(false);
        setError(
          usernameError.message.includes("duplicate")
            ? "이미 사용 중인 아이디입니다."
            : "아이디 변경에 실패했습니다.",
        );
        return;
      }
    }

    if (needsPassword) {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        setSubmitting(false);
        setError("비밀번호 변경에 실패했습니다.");
        return;
      }
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", userId);
    }

    setSubmitting(false);
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <div className="mx-auto max-w-md px-4 py-24 text-center text-brand-500">불러오는 중...</div>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <h1 className="mb-2 text-xl font-bold text-brand-700">계정 정보 설정</h1>
      <p className="mb-8 text-sm text-brand-500">
        보안을 위해 최초 로그인 시 아래 정보를 새로 설정해주세요.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {needsUsername && (
          <Field label="새 아이디 (영문+숫자 조합)">
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="baku2024"
              required
            />
          </Field>
        )}

        {needsPassword && (
          <>
            <Field label="새 비밀번호 (영문+숫자 조합)">
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
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60"
        >
          {submitting ? "저장 중..." : "저장하고 계속하기"}
        </button>
      </form>
    </div>
  );
}
