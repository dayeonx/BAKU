-- BAKU: 초기 스키마 (회원 프로필 + 임원 인증코드)
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  student_id text unique not null,
  name text not null,
  department text not null default 'member'
    check (department in ('member', 'president', 'executive', 'planning', 'treasury', 'pr')),
  semester_count integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "본인 프로필 조회" on public.profiles;
create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "본인 프로필 생성" on public.profiles;
create policy "본인 프로필 생성" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "본인 프로필 수정" on public.profiles;
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id);

-- 임원 인증코드 등 민감한 설정값 저장용. anon/authenticated 권한으로는 직접 조회 불가 (RLS 미부여 + 정책 없음).
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- 의도적으로 select/insert/update 정책을 만들지 않음 -> anon/authenticated는 접근 불가, service_role만 가능.

-- 회원가입 시 클라이언트가 인증코드를 직접 비교하지 않고 이 함수로만 검증하도록 함 (코드 값 자체는 노출되지 않음).
create or replace function public.verify_officer_code(input_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_settings
    where key = 'officer_signup_code' and value = input_code
  );
$$;

revoke all on function public.verify_officer_code(text) from public;
grant execute on function public.verify_officer_code(text) to anon, authenticated;

-- 초기 임원 인증코드를 설정하세요 (원하는 값으로 교체 후 실행):
-- insert into public.app_settings (key, value) values ('officer_signup_code', '여기에_코드_입력')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
