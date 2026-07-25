-- BAKU: 캘린더 (일정, 공동주최자, 참여신청)

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in
    ('regular','free','monthly_special','welcome','mt','bread_tour','team_mission','snack','pub')),
  event_date date not null,
  event_time time not null,
  location text not null,
  items text not null,
  capacity integer not null check (capacity > 0),
  price_range text not null,
  signup_open_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.event_hosts (
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  primary key (event_id, profile_id)
);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

alter table public.events enable row level security;
alter table public.event_hosts enable row level security;
alter table public.event_participants enable row level security;

-- 승인된 일정은 비로그인 포함 누구나 조회 가능, 임원진은 대기/거절도 조회 가능
drop policy if exists "일정 조회" on public.events;
create policy "일정 조회" on public.events
  for select using (status = 'approved' or public.is_officer());

drop policy if exists "일정 등록" on public.events;
create policy "일정 등록" on public.events
  for insert with check (auth.uid() = created_by);

drop policy if exists "임원진 일정 승인" on public.events;
create policy "임원진 일정 승인" on public.events
  for update using (public.is_officer());

drop policy if exists "공동주최자 조회" on public.event_hosts;
create policy "공동주최자 조회" on public.event_hosts
  for select using (true);

drop policy if exists "공동주최자 등록" on public.event_hosts;
create policy "공동주최자 등록" on public.event_hosts
  for insert with check (
    exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  );

drop policy if exists "본인 참여내역 조회" on public.event_participants;
create policy "본인 참여내역 조회" on public.event_participants
  for select using (auth.uid() = profile_id or public.is_officer());

drop policy if exists "본인 참여신청 취소" on public.event_participants;
create policy "본인 참여신청 취소" on public.event_participants
  for delete using (auth.uid() = profile_id);

-- 잔여 자리 수: 비로그인 사용자도 볼 수 있어야 하므로 참여자 개인정보 노출 없이 개수만 반환
create or replace function public.event_remaining_spots(p_event_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select e.capacity - (
    select count(*) from public.event_participants p where p.event_id = e.id
  )
  from public.events e
  where e.id = p_event_id;
$$;

revoke all on function public.event_remaining_spots(uuid) from public;
grant execute on function public.event_remaining_spots(uuid) to anon, authenticated;

-- 참여 신청: 신청 오픈 시간 이전, 정원 초과, 중복 신청을 원자적으로 방지
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

  if v_event is null or v_event.status <> 'approved' then
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

revoke all on function public.join_event(uuid) from public;
grant execute on function public.join_event(uuid) to authenticated;
