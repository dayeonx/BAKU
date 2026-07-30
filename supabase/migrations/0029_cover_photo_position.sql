-- BAKU: 대표 사진을 1:1로 자를 때 어느 영역이 보일지 위치(CSS object-position) 저장

alter table public.events add column if not exists cover_photo_position text;

create or replace function public.set_cover_photo(p_event_id uuid, p_photo_url text, p_position text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_album_content(p_event_id, auth.uid()) then
    raise exception '대표 사진을 설정할 권한이 없습니다.';
  end if;

  update public.events
  set cover_photo_url = p_photo_url, cover_photo_position = coalesce(p_position, '50% 50%')
  where id = p_event_id;
end;
$$;
