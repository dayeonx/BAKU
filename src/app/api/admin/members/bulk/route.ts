import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initialCredentialFor, STUDENT_EMAIL_DOMAIN } from "@/lib/temp-password";

type MemberRow = {
  student_id: string;
  name: string;
  college?: string;
  major?: string;
  department?: string;
};

const VALID_DEPARTMENTS = [
  "member",
  "president",
  "executive",
  "planning",
  "treasury",
  "pr",
];

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

  const body = await request.json();
  const members: MemberRow[] = Array.isArray(body?.members) ? body.members : [];

  if (members.length === 0) {
    return NextResponse.json({ error: "등록할 회원이 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const created: string[] = [];
  const skipped: { student_id: string; reason: string }[] = [];

  for (const row of members) {
    const studentId = String(row.student_id ?? "").trim();
    const name = String(row.name ?? "").trim();

    if (!studentId || !name) {
      skipped.push({ student_id: studentId || "(빈 값)", reason: "학번 또는 이름 누락" });
      continue;
    }

    const department = VALID_DEPARTMENTS.includes(row.department ?? "")
      ? (row.department as string)
      : "member";

    const initialCredential = initialCredentialFor(studentId);

    const { data: created_user, error: createError } = await admin.auth.admin.createUser({
      email: studentId + STUDENT_EMAIL_DOMAIN,
      password: initialCredential,
      email_confirm: true,
    });

    if (createError || !created_user.user) {
      skipped.push({
        student_id: studentId,
        reason: createError?.message.includes("already registered")
          ? "이미 등록된 학번"
          : "계정 생성 실패",
      });
      continue;
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created_user.user.id,
      student_id: studentId,
      username: initialCredential,
      must_change_username: true,
      name,
      college: row.college ? String(row.college).trim() : null,
      major: row.major ? String(row.major).trim() : null,
      department,
      status: "active",
      must_change_password: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created_user.user.id);
      skipped.push({ student_id: studentId, reason: "프로필 저장 실패" });
      continue;
    }

    created.push(studentId);
  }

  return NextResponse.json({ created, skipped });
}
