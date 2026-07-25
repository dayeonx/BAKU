import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const GATE_EXEMPT_PATHS = ["/login", "/pending-approval", "/inactive", "/account-setup"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 갱신 (Server Component에서는 쿠키를 쓸 수 없으므로 필수)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isApiRoute = path.startsWith("/api/");
  const isExempt = GATE_EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (user && !isApiRoute && !isExempt) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, must_change_password, must_change_username")
      .eq("id", user.id)
      .single();

    if (profile) {
      if (profile.status === "pending_approval") {
        return NextResponse.redirect(new URL("/pending-approval", request.url));
      }
      if (profile.status === "inactive") {
        return NextResponse.redirect(new URL("/inactive", request.url));
      }
      if (profile.must_change_username || profile.must_change_password) {
        return NextResponse.redirect(new URL("/account-setup", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
