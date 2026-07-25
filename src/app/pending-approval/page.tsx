"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PendingApprovalPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-xl font-bold text-brand-700">임원진 승인 대기 중</h1>
      <p className="mt-3 text-sm text-brand-500">
        가입 신청이 접수되었습니다. 임원진이 승인하면 로그인하실 수 있어요.
      </p>
      <button
        onClick={handleSignOut}
        className="mt-8 rounded-full bg-brand-100 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100/70"
      >
        로그아웃
      </button>
    </div>
  );
}
