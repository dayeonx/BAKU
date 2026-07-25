import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role(secret) 키를 사용하는 관리자 클라이언트. 절대 클라이언트 컴포넌트에서 import하지 말 것.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
