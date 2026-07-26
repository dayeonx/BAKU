-- BAKU: 앨범 (후기, 레시피 아카이브)

create table if not exists public.album_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  review_text text,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create table if not exists public.album_recipes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  title text not null,
  file_url text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

alter table public.album_reviews enable row level security;
alter table public.album_recipes enable row level security;

-- 활동이 종료(승인 + 종료일 경과)되었는지 확인하는 헬퍼
create or replace function public.is_event_finished(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.status = 'approved'
      and coalesce(e.end_date, e.event_date) < current_date
  );
$$;

-- 해당 활동의 주최자(등록자 또는 공동주최자)인지 확인
create or replace function public.is_event_host(p_event_id uuid, p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e where e.id = p_event_id and e.created_by = p_profile_id
  ) or exists (
    select 1 from public.event_hosts h where h.event_id = p_event_id and h.profile_id = p_profile_id
  );
$$;

-- 후기: 종료된 활동의 주최자 또는 참여자만 작성 가능, 조회는 누구나 가능(비로그인 포함, 이름은 앱단에서 마스킹)
drop policy if exists "후기 조회" on public.album_reviews;
create policy "후기 조회" on public.album_reviews
  for select using (true);

drop policy if exists "후기 작성" on public.album_reviews;
create policy "후기 작성" on public.album_reviews
  for insert with check (
    auth.uid() = profile_id
    and public.is_event_finished(event_id)
    and (
      public.is_event_host(event_id, auth.uid())
      or exists (select 1 from public.event_participants p where p.event_id = album_reviews.event_id and p.profile_id = auth.uid())
    )
  );

drop policy if exists "후기 수정" on public.album_reviews;
create policy "후기 수정" on public.album_reviews
  for update using (auth.uid() = profile_id);

drop policy if exists "후기 삭제" on public.album_reviews;
create policy "후기 삭제" on public.album_reviews
  for delete using (auth.uid() = profile_id or public.is_officer());

-- 레시피: 종료된 활동의 주최자만 업로드 가능, 조회는 누구나 가능
drop policy if exists "레시피 조회" on public.album_recipes;
create policy "레시피 조회" on public.album_recipes
  for select using (true);

drop policy if exists "레시피 등록" on public.album_recipes;
create policy "레시피 등록" on public.album_recipes
  for insert with check (
    auth.uid() = uploaded_by
    and public.is_event_finished(event_id)
    and public.is_event_host(event_id, auth.uid())
  );

drop policy if exists "레시피 삭제" on public.album_recipes;
create policy "레시피 삭제" on public.album_recipes
  for delete using (auth.uid() = uploaded_by or public.is_officer());

-- 이름 마스킹: 비로그인 사용자에게는 "김oo" 형태로 표시
create or replace function public.mask_name(p_name text)
returns text
language sql
immutable
as $$
  select case
    when p_name is null or length(p_name) = 0 then p_name
    else substring(p_name from 1 for 1) || 'oo'
  end;
$$;

-- 활동 참여자 이름 (profiles 테이블 직접 조회가 막혀있으므로 RPC로 우회, 비로그인은 마스킹)
create or replace function public.album_participants(p_event_id uuid)
returns table (profile_id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select pr.id, case when auth.uid() is null then public.mask_name(pr.name) else pr.name end
  from public.event_participants ep
  join public.profiles pr on pr.id = ep.profile_id
  where ep.event_id = p_event_id
  order by ep.joined_at;
$$;

revoke all on function public.album_participants(uuid) from public;
grant execute on function public.album_participants(uuid) to anon, authenticated;

-- 활동 주최자 이름 (등록자 + 공동주최자)
create or replace function public.album_hosts(p_event_id uuid)
returns table (profile_id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select pr.id, case when auth.uid() is null then public.mask_name(pr.name) else pr.name end
  from (
    select e.created_by as profile_id from public.events e where e.id = p_event_id
    union
    select h.profile_id from public.event_hosts h where h.event_id = p_event_id
  ) hosts
  join public.profiles pr on pr.id = hosts.profile_id;
$$;

revoke all on function public.album_hosts(uuid) from public;
grant execute on function public.album_hosts(uuid) to anon, authenticated;

-- 후기 목록 + 작성자 이름 (비로그인은 마스킹)
create or replace function public.album_reviews_for_event(p_event_id uuid)
returns table (
  id uuid,
  profile_id uuid,
  author_name text,
  review_text text,
  photo_urls text[],
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.profile_id,
    case when auth.uid() is null then public.mask_name(pr.name) else pr.name end,
    r.review_text, r.photo_urls, r.created_at
  from public.album_reviews r
  join public.profiles pr on pr.id = r.profile_id
  where r.event_id = p_event_id
  order by r.created_at desc;
$$;

revoke all on function public.album_reviews_for_event(uuid) from public;
grant execute on function public.album_reviews_for_event(uuid) to anon, authenticated;

-- 레시피 목록 + 업로더 이름
create or replace function public.album_recipes_for_event(p_event_id uuid)
returns table (
  id uuid,
  title text,
  file_url text,
  file_name text,
  uploader_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select rc.id, rc.title, rc.file_url, rc.file_name,
    case when auth.uid() is null then public.mask_name(pr.name) else pr.name end,
    rc.created_at
  from public.album_recipes rc
  join public.profiles pr on pr.id = rc.uploaded_by
  where rc.event_id = p_event_id
  order by rc.created_at desc;
$$;

revoke all on function public.album_recipes_for_event(uuid) from public;
grant execute on function public.album_recipes_for_event(uuid) to anon, authenticated;

-- 후기 사진 및 레시피 PDF 저장용 스토리지 버킷
insert into storage.buckets (id, name, public)
values ('album', 'album', true)
on conflict (id) do nothing;

drop policy if exists "앨범 파일 공개 조회" on storage.objects;
create policy "앨범 파일 공개 조회" on storage.objects
  for select using (bucket_id = 'album');

drop policy if exists "앨범 파일 업로드" on storage.objects;
create policy "앨범 파일 업로드" on storage.objects
  for insert with check (bucket_id = 'album' and auth.role() = 'authenticated');

drop policy if exists "앨범 파일 삭제" on storage.objects;
create policy "앨범 파일 삭제" on storage.objects
  for delete using (bucket_id = 'album' and auth.role() = 'authenticated');
