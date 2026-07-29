-- BAKU: 앨범 사진 갤러리 신설, 레시피 URL 등록 지원, 후기 텍스트 전용화

-- 카테고리별 앨범 콘텐츠(사진/후기) 등록 권한 통합 판정
-- 정기/자유/월별스페셜/주점: 주최자(주준위) 또는 참여자
-- 신환회/엠티/빵지순례: 참여자만
-- 간식행사: 활성 상태인 모든 회원
create or replace function public.can_manage_album_content(p_event_id uuid, p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
begin
  select category into v_category from public.events where id = p_event_id;
  if v_category is null then
    return false;
  end if;

  if v_category in ('regular', 'free', 'monthly_special', 'pub') then
    return public.is_event_host(p_event_id, p_profile_id)
      or exists (
        select 1 from public.event_participants
        where event_id = p_event_id and profile_id = p_profile_id
      );
  elsif v_category in ('welcome', 'mt', 'bread_tour') then
    return exists (
      select 1 from public.event_participants
      where event_id = p_event_id and profile_id = p_profile_id
    );
  elsif v_category = 'snack' then
    return exists (
      select 1 from public.profiles where id = p_profile_id and status = 'active'
    );
  else
    return false;
  end if;
end;
$$;

revoke all on function public.can_manage_album_content(uuid, uuid) from public;
grant execute on function public.can_manage_album_content(uuid, uuid) to authenticated;

-- 사진 갤러리 ('gallery' = 활동 사진, 'menu' = 주점 대표 메뉴 사진)
create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  photo_url text not null,
  photo_type text not null default 'gallery' check (photo_type in ('gallery', 'menu')),
  created_at timestamptz not null default now()
);

alter table public.album_photos enable row level security;

drop policy if exists "앨범 사진 조회" on public.album_photos;
create policy "앨범 사진 조회" on public.album_photos
  for select using (true);

drop policy if exists "앨범 사진 등록" on public.album_photos;
create policy "앨범 사진 등록" on public.album_photos
  for insert with check (
    auth.uid() = uploaded_by
    and public.is_event_finished(event_id)
    and public.can_manage_album_content(event_id, auth.uid())
  );

drop policy if exists "앨범 사진 삭제" on public.album_photos;
create policy "앨범 사진 삭제" on public.album_photos
  for delete using (auth.uid() = uploaded_by or public.is_officer());

create or replace function public.album_photos_for_event(p_event_id uuid, p_photo_type text default 'gallery')
returns table (id uuid, uploaded_by uuid, photo_url text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, p.uploaded_by, p.photo_url, p.created_at
  from public.album_photos p
  where p.event_id = p_event_id and p.photo_type = p_photo_type
  order by p.created_at asc;
$$;

revoke all on function public.album_photos_for_event(uuid, text) from public;
grant execute on function public.album_photos_for_event(uuid, text) to anon, authenticated;

-- 기존 후기에 첨부돼있던 사진을 새 갤러리 테이블로 이전 (데이터 유지)
insert into public.album_photos (event_id, uploaded_by, photo_url, photo_type, created_at)
select r.event_id, r.profile_id, unnest(r.photo_urls), 'gallery', r.created_at
from public.album_reviews r
where coalesce(array_length(r.photo_urls, 1), 0) > 0;

-- 대표 사진 설정 권한을 주최자 전용에서 can_manage_album_content 기준으로 확장
create or replace function public.set_cover_photo(p_event_id uuid, p_photo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_album_content(p_event_id, auth.uid()) then
    raise exception '대표 사진을 설정할 권한이 없습니다.';
  end if;

  update public.events set cover_photo_url = p_photo_url where id = p_event_id;
end;
$$;

-- 레시피: PDF 파일 또는 외부 URL 링크 중 하나로 등록 가능
alter table public.album_recipes alter column file_url drop not null;
alter table public.album_recipes alter column file_name drop not null;
alter table public.album_recipes add column if not exists link_url text;
alter table public.album_recipes drop constraint if exists album_recipes_file_or_link;
alter table public.album_recipes add constraint album_recipes_file_or_link
  check (file_url is not null or link_url is not null);

drop function if exists public.album_recipes_for_event(uuid);
create or replace function public.album_recipes_for_event(p_event_id uuid)
returns table (
  id uuid,
  title text,
  file_url text,
  file_name text,
  link_url text,
  uploader_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select rc.id, rc.title, rc.file_url, rc.file_name, rc.link_url,
    case when auth.uid() is null then public.mask_name(pr.name) else pr.name end,
    rc.created_at
  from public.album_recipes rc
  join public.profiles pr on pr.id = rc.uploaded_by
  where rc.event_id = p_event_id
  order by rc.created_at desc;
$$;

revoke all on function public.album_recipes_for_event(uuid) from public;
grant execute on function public.album_recipes_for_event(uuid) to anon, authenticated;

-- 후기: 사진 첨부 제거(사진은 앨범 갤러리로 이관), 작성/수정 권한을 can_manage_album_content 기준으로 확장
drop policy if exists "후기 작성" on public.album_reviews;
create policy "후기 작성" on public.album_reviews
  for insert with check (
    auth.uid() = profile_id
    and public.is_event_finished(event_id)
    and public.can_manage_album_content(event_id, auth.uid())
  );

alter table public.album_reviews drop column if exists photo_urls;

drop function if exists public.album_reviews_for_event(uuid);
create or replace function public.album_reviews_for_event(p_event_id uuid)
returns table (
  id uuid,
  profile_id uuid,
  author_name text,
  review_text text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.profile_id,
    case when auth.uid() is null then public.mask_name(pr.name) else pr.name end,
    r.review_text, r.created_at
  from public.album_reviews r
  join public.profiles pr on pr.id = r.profile_id
  where r.event_id = p_event_id
  order by r.created_at desc;
$$;

revoke all on function public.album_reviews_for_event(uuid) from public;
grant execute on function public.album_reviews_for_event(uuid) to anon, authenticated;
