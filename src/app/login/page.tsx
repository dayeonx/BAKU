"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STUDENT_EMAIL_DOMAIN = "@baku.internal";

const DEPARTMENTS = [
  { value: "member", label: "일반 회원" },
  { value: "president", label: "회장단" },
  { value: "executive", label: "집행부" },
  { value: "planning", label: "기획부" },
  { value: "treasury", label: "총무부" },
  { value: "pr", label: "홍보부" },
];

type Tab = "login" | "signup";

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("login");

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <div className="mb-8 flex rounded-full bg-brand-100 p-1">
        <TabButton active={tab === "login"} onClick={() => setTab("login")}>
          로그인
        </TabButton>
        <TabButton active={tab === "signup"} onClick={() => setTab("signup")}>
          회원가입
        </TabButton>
      </div>

      {tab === "login" ? <LoginForm /> : <SignupForm />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
        active ? "bg-accent-500 text-white" : "text-brand-700"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-brand-700">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-brand-100 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-brand-300 focus:border-accent-500";

function LoginForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: studentId.trim() + STUDENT_EMAIL_DOMAIN,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("학번 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="학번">
        <input
          className={inputClass}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="2024xxxxxx"
          required
        />
      </Field>
      <Field label="비밀번호">
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}

function SignupForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [department, setDepartment] = useState("member");
  const [authCode, setAuthCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isOfficer = department !== "member";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (studentId.trim().length === 0 || name.trim().length === 0) {
      setError("학번과 이름을 입력해주세요.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (isOfficer) {
      const { data: codeValid, error: rpcError } = await supabase.rpc(
        "verify_officer_code",
        { input_code: authCode.trim() },
      );
      if (rpcError || !codeValid) {
        setLoading(false);
        setError("임원 인증코드가 올바르지 않습니다.");
        return;
      }
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: studentId.trim() + STUDENT_EMAIL_DOMAIN,
      password,
    });

    if (signUpError || !signUpData.user) {
      setLoading(false);
      setError(
        signUpError?.message.includes("already registered")
          ? "이미 가입된 학번입니다."
          : "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: signUpData.user.id,
      student_id: studentId.trim(),
      name: name.trim(),
      department,
    });

    setLoading(false);

    if (profileError) {
      setError("프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setNotice("가입이 완료됐습니다! 로그인 화면으로 이동합니다.");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="학번">
        <input
          className={inputClass}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="2024xxxxxx"
          required
        />
      </Field>
      <Field label="이름">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <Field label="비밀번호">
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Field label="비밀번호 확인">
        <input
          className={inputClass}
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
        />
      </Field>
      <Field label="소속 부서">
        <select
          className={inputClass}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>

      {isOfficer && (
        <Field label="임원 인증코드">
          <input
            className={inputClass}
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="회장단에게 문의"
            required
          />
        </Field>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-accent-100 px-3 py-2 text-xs text-accent-700">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60"
      >
        {loading ? "가입 중..." : "회원가입"}
      </button>
    </form>
  );
}
