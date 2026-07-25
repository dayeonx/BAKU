import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initialCredentialFor } from "@/lib/temp-password";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: isPresident } = await supabase.rpc("is_president");
  if (!isPresident) {
    return NextResponse.json({ error: "회장단만 사용할 수 있습니다." }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "대상 회원이 지정되지 않았습니다." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("student_id")
    .eq("id", id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const admin = createAdminClient();
  const newPassword = initialCredentialFor(profile.student_id);

  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  });

  if (updateError) {
    return NextResponse.json({ error: "비밀번호 초기화에 실패했습니다." }, { status: 500 });
  }

  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);

  return NextResponse.json({ ok: true, temp_password: newPassword });
}
