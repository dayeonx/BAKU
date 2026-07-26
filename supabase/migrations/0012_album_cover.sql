-- BAKU: 앨범 피드 대표 사진(커버) 설정

alter table public.events add column if not exists cover_photo_url text;

-- 주최자가 후기 사진 중 하나를 대표 사진으로 지정 (events 테이블 전체 update 권한을 열지 않기 위해 RPC로 제한)
create or replace function public.set_cover_photo(p_event_id uuid, p_photo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_host(p_event_id, auth.uid()) then
    raise exception '주최자만 대표 사진을 설정할 수 있습니다.';
  end if;

  update public.events set cover_photo_url = p_photo_url where id = p_event_id;
end;
$$;

revoke all on function public.set_cover_photo(uuid, text) from public;
grant execute on function public.set_cover_photo(uuid, text) to authenticated;
