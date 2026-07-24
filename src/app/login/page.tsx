"use client";

import { useState } from "react";
import type { FormEvent } from "react";

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
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: Supabase 연동 후 실제 로그인 처리로 교체
    setNotice("백엔드(Supabase) 연결 준비 중입니다. 곧 실제 로그인이 가능해져요.");
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

      {notice && (
        <p className="rounded-lg bg-accent-100 px-3 py-2 text-xs text-accent-700">
          {notice}
        </p>
      )}

      <button
        type="submit"
        className="mt-1 rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
      >
        로그인
      </button>
    </form>
  );
}

function SignupForm() {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [department, setDepartment] = useState("member");
  const [authCode, setAuthCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isOfficer = department !== "member";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (isOfficer && authCode.trim().length === 0) {
      setError("임원 인증코드를 입력해주세요.");
      return;
    }

    // TODO: Supabase 연동 후 실제 회원가입 처리로 교체
    setNotice("백엔드(Supabase) 연결 준비 중입니다. 곧 실제 가입이 가능해져요.");
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
        className="mt-1 rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
      >
        회원가입
      </button>
    </form>
  );
}
