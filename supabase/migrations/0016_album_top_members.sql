-- BAKU: 앨범 - 학기별 최다 주최자 / 최다 참여자 (아이디 노출, 실명 비노출)

create or replace function public.album_top_host(p_start date, p_end_exclusive date)
returns table (username text, host_count bigint)
language sql
security definer
set search_path = public
as $$
  select pr.username, count(*) as host_count
  from (
    select e.id as event_id, e.created_by as profile_id
    from public.events e
    where e.status = 'approved'
      and e.category in ('regular', 'free', 'monthly_special')
      and e.event_date >= p_start and e.event_date < p_end_exclusive
    union
    select h.event_id, h.profile_id
    from public.event_hosts h
    join public.events e on e.id = h.event_id
    where e.status = 'approved'
      and e.category in ('regular', 'free', 'monthly_special')
      and e.event_date >= p_start and e.event_date < p_end_exclusive
  ) hosts
  join public.profiles pr on pr.id = hosts.profile_id
  group by pr.username
  order by host_count desc
  limit 1;
$$;

revoke all on function public.album_top_host(date, date) from public;
grant execute on function public.album_top_host(date, date) to anon, authenticated;

create or replace function public.album_top_participant(p_start date, p_end_exclusive date)
returns table (username text, participation_count bigint)
language sql
security definer
set search_path = public
as $$
  select pr.username, count(*) as participation_count
  from public.event_participants ep
  join public.events e on e.id = ep.event_id
  join public.profiles pr on pr.id = ep.profile_id
  where e.status = 'approved'
    and e.category in ('regular', 'free', 'monthly_special')
    and e.event_date >= p_start and e.event_date < p_end_exclusive
  group by pr.username
  order by participation_count desc
  limit 1;
$$;

revoke all on function public.album_top_participant(date, date) from public;
grant execute on function public.album_top_participant(date, date) to anon, authenticated;
