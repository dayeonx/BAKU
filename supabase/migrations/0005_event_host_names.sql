-- 승인된 일정의 주최자 이름만 안전하게 공개 (profiles 테이블 전체를 열지 않고 이름만 반환)
create or replace function public.event_host_names(p_event_id uuid)
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.name order by p.name), '{}')
  from public.event_hosts eh
  join public.profiles p on p.id = eh.profile_id
  join public.events e on e.id = eh.event_id
  where eh.event_id = p_event_id and e.status = 'approved';
$$;

revoke all on function public.event_host_names(uuid) from public;
grant execute on function public.event_host_names(uuid) to anon, authenticated;
