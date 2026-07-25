"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InactivePage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-xl font-bold text-brand-700">비활성화된 계정입니다</h1>
      <p className="mt-3 text-sm text-brand-500">
        휴면 처리된 계정이에요. 다시 활동하시려면 회장단에게 문의해주세요.
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
