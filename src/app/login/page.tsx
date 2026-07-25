"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STUDENT_EMAIL_DOMAIN } from "@/lib/temp-password";
import { Field, inputClass } from "@/components/FormField";
import { DEPARTMENTS } from "@/lib/departments";
import { isValidUsername, isValidPassword, CREDENTIAL_FORMAT_HINT } from "@/lib/validation";

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

function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { data: email, error: resolveError } = await supabase.rpc(
      "resolve_login_email",
      { input_username: username.trim() },
    );

    if (resolveError || !email) {
      setLoading(false);
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="아이디">
        <input
          className={inputClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="최초 로그인 시에는 학번"
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
  const [college, setCollege] = useState("");
  const [major, setMajor] = useState("");
  const [username, setUsername] = useState("");
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
    if (!isValidUsername(username)) {
      setError(`아이디: ${CREDENTIAL_FORMAT_HINT}`);
      return;
    }
    if (!isValidPassword(password)) {
      setError(`비밀번호: ${CREDENTIAL_FORMAT_HINT}`);
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
      username: username.trim(),
      must_change_username: false,
      name: name.trim(),
      college: college.trim(),
      major: major.trim(),
      department,
      status: "pending_approval",
      must_change_password: false,
    });

    setLoading(false);

    if (profileError) {
      setError(
        profileError.message.includes("duplicate")
          ? "이미 사용 중인 학번 또는 아이디입니다."
          : "프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
      return;
    }

    setNotice("가입 신청이 완료됐습니다! 임원진 승인 후 로그인하실 수 있어요.");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
        회원가입 후에는 임원진 승인 후에 로그인이 가능합니다.
      </p>
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
      <Field label="단과대">
        <input
          className={inputClass}
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          placeholder="예: 이과대학"
          required
        />
      </Field>
      <Field label="학과">
        <input
          className={inputClass}
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          placeholder="예: 화학과"
          required
        />
      </Field>
      <Field label="아이디 (영문+숫자 조합)">
        <input
          className={inputClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="baku2026"
          required
        />
      </Field>
      <Field label="비밀번호 (영문+숫자 조합)">
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
