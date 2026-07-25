-- BAKU: 아이디(username) 분리 + 학과 정보로 교체

alter table public.profiles
  add column if not exists username text,
  add column if not exists must_change_username boolean not null default true,
  add column if not exists college text,
  add column if not exists major text;

-- 기존 회원(있다면)의 아이디는 학번으로 초기화
update public.profiles set username = student_id where username is null;

alter table public.profiles
  alter column username set not null;

drop index if exists profiles_username_key;
create unique index if not exists profiles_username_key on public.profiles (username);

alter table public.profiles drop column if exists phone_number;

-- 로그인 시 아이디 -> 내부 이메일(학번 기반, 불변)을 알아내기 위한 함수.
-- 이메일 자체는 절대 바뀌지 않으므로 Supabase의 이메일 변경 확인 절차가 필요 없음.
create or replace function public.resolve_login_email(input_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select student_id || '@baku.internal'
  from public.profiles
  where username = input_username
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
