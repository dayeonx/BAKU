-- BAKU: 주최자 없는 활동(신환회/엠티/빵지순례) 정산 지원 + 참여자 입금 확인 2단계 분리

-- 활동 종료 판정을 날짜 단위에서 종료 시각(분 단위, 없으면 자정) 기준으로 정밀화.
-- 같은 날 안에서도 종료 시각이 지나는 즉시 정산 등록이 가능해야 하기 때문 (한국 시간 기준).
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
      and (
        (coalesce(e.end_date, e.event_date) + coalesce(e.end_time, '23:59:59'::time))
          at time zone 'Asia/Seoul'
      ) < now()
  );
$$;

-- 주최자가 없는 활동은 임원진이 영수증 없이 바로 정산을 등록하므로 host_id를 nullable로 변경
alter table public.settlements alter column host_id drop not null;

drop policy if exists "정산 등록" on public.settlements;
create policy "정산 등록" on public.settlements
  for insert with check (
    (
      auth.uid() = host_id
      and public.is_event_host(event_id, auth.uid())
      and public.is_event_finished(event_id)
    )
    or (
      public.is_officer()
      and host_id is null
      and public.is_event_finished(event_id)
      and exists (
        select 1 from public.events e
        where e.id = settlements.event_id and e.category in ('welcome', 'mt', 'bread_tour')
      )
    )
  );

-- 참여자 입금 확인 2단계: 참여자 자가신고(self_reported_paid) -> 임원진 최종확인(paid)
alter table public.settlement_participants add column if not exists self_reported_paid boolean not null default false;

create or replace function public.mark_settlement_participant_paid(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.settlement_participants
  set self_reported_paid = true
  where id = p_id and profile_id = auth.uid();
end;
$$;
