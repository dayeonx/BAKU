import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";
import AccountDrawer from "./AccountDrawer";
import MobileNav from "./MobileNav";
import { NAV_LINKS } from "@/lib/navLinks";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: {
    name: string;
    department: string;
    student_id: string;
    college: string | null;
    major: string | null;
  } | null = null;
  let isOfficer = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("name, department, status, student_id, college, major")
      .eq("id", user.id)
      .single();
    profile = data;
    isOfficer = !!data && data.department !== "member" && data.status === "active";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-brand-700">
            BAKU
          </span>
          <span className="hidden text-xs font-medium text-brand-500 sm:inline">
            고려대학교 중앙동아리
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-brand-700 transition-colors hover:text-accent-500"
            >
              {link.label}
            </Link>
          ))}
          {isOfficer && (
            <Link
              href="/admin"
              className="text-sm font-medium text-brand-700 transition-colors hover:text-accent-500"
            >
              관리자
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {profile && user ? (
            <>
              <AccountDrawer
                userId={user.id}
                userEmail={user.email ?? null}
                name={profile.name}
                department={profile.department}
                studentId={profile.student_id}
                college={profile.college}
                major={profile.major}
              />
              <NotificationBell />
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
            >
              로그인
            </Link>
          )}
          <MobileNav isOfficer={isOfficer} />
        </div>
      </div>
    </header>
  );
}
