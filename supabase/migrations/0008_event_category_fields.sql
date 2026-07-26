-- BAKU: 카테고리별 일정 필드 확장 (다일간 행사, 구글폼, 장소 2곳, 수동 참여자 등록)

alter table public.events
  add column if not exists end_date date,
  add column if not exists location_2 text,
  add column if not exists google_form_url text,
  add column if not exists signup_method text not null default 'in_app_auto'
    check (signup_method in ('in_app_auto', 'manual', 'none'));

alter table public.events alter column capacity drop not null;
alter table public.events alter column price_range drop not null;
alter table public.events alter column signup_open_at drop not null;
alter table public.events alter column items drop not null;

-- 카테고리 체크 제약을 갱신해 조별 베이킹(team_mission)을 제거하고 새 값은 이미 포함되어 있으므로 그대로 둠
do $$
declare
  con text;
begin
  select conname into con from pg_constraint
  where conrelid = 'public.events'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%category%';
  if con is not null then
    execute format('alter table public.events drop constraint %I', con);
  end if;
end $$;

alter table public.events add constraint events_category_check
  check (category in ('regular', 'free', 'monthly_special', 'welcome', 'mt', 'bread_tour', 'snack', 'pub'));

-- 자동 참여신청은 in_app_auto 종류에서만 가능하도록 강화
create or replace function public.join_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_taken integer;
begin
  select * into v_event from public.events where id = p_event_id for update;

  if v_event is null or v_event.status <> 'approved' or v_event.signup_method <> 'in_app_auto' then
    raise exception '참여할 수 없는 일정입니다.';
  end if;

  if now() < v_event.signup_open_at then
    raise exception '아직 신청 기간이 아닙니다.';
  end if;

  select count(*) into v_taken from public.event_participants where event_id = p_event_id;
  if v_taken >= v_event.capacity then
    raise exception '정원이 마감되었습니다.';
  end if;

  insert into public.event_participants (event_id, profile_id)
  values (p_event_id, auth.uid())
  on conflict (event_id, profile_id) do nothing;
end;
$$;

-- 임원진이 구글폼/오프라인으로 신청받은 인원을 수동으로 등록
create or replace function public.admin_add_participant(p_event_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_officer() then
    raise exception '임원진만 사용할 수 있습니다.';
  end if;

  insert into public.event_participants (event_id, profile_id)
  values (p_event_id, p_profile_id)
  on conflict (event_id, profile_id) do nothing;
end;
$$;

revoke all on function public.admin_add_participant(uuid, uuid) from public;
grant execute on function public.admin_add_participant(uuid, uuid) to authenticated;

create or replace function public.admin_remove_participant(p_event_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_officer() then
    raise exception '임원진만 사용할 수 있습니다.';
  end if;

  delete from public.event_participants where event_id = p_event_id and profile_id = p_profile_id;
end;
$$;

revoke all on function public.admin_remove_participant(uuid, uuid) from public;
grant execute on function public.admin_remove_participant(uuid, uuid) to authenticated;
