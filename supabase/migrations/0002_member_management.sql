-- BAKU: 회원 관리 확장 (전화번호, 상태, 최초 비밀번호 변경 강제, 임원 권한 함수)

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists status text not null default 'active'
    check (status in ('pending_approval', 'active', 'inactive')),
  add column if not exists must_change_password boolean not null default false;

-- 현재 로그인한 사용자가 "활성 임원"인지 확인 (부서가 일반회원이 아니고 status가 active)
create or replace function public.is_officer()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and department <> 'member' and status = 'active'
  );
$$;

-- 현재 로그인한 사용자가 "활성 회장단"인지 확인
create or replace function public.is_president()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and department = 'president' and status = 'active'
  );
$$;

revoke all on function public.is_officer() from public;
revoke all on function public.is_president() from public;
grant execute on function public.is_officer() to authenticated;
grant execute on function public.is_president() to authenticated;

-- 임원진은 전체 회원 목록을 조회할 수 있음
drop policy if exists "임원진 전체 조회" on public.profiles;
create policy "임원진 전체 조회" on public.profiles
  for select using (public.is_officer());

-- 회장단은 모든 회원 정보를 수정할 수 있음 (부서/상태 변경 등)
drop policy if exists "회장단 전체 수정" on public.profiles;
create policy "회장단 전체 수정" on public.profiles
  for update using (public.is_president());
