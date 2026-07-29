-- BAKU: 관리자 페이지 - 회원 쿠폰 등록(9.5), 구글드라이브 연동(9.4)

alter table public.coupons add column if not exists max_amount integer;
alter table public.coupons add column if not exists valid_until date;

create table if not exists public.drive_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.drive_links enable row level security;

-- 링크 목록은 임원진만 볼 수 있음 (내부 운영 문서이므로)
drop policy if exists "드라이브 링크 조회" on public.drive_links;
create policy "드라이브 링크 조회" on public.drive_links
  for select using (public.is_officer());

drop policy if exists "드라이브 링크 등록" on public.drive_links;
create policy "드라이브 링크 등록" on public.drive_links
  for insert with check (public.is_officer() and auth.uid() = created_by);

drop policy if exists "드라이브 링크 삭제" on public.drive_links;
create policy "드라이브 링크 삭제" on public.drive_links
  for delete using (public.is_officer());
