-- BAKU: 행사 등록 시 주최자 이름 입력 + 정산 등록 항목 세분화(스튜디오/재료 영수증, 참여 인원, 공동주최자 계좌)

alter table public.events add column if not exists host_name text;

alter table public.settlements add column if not exists studio_receipt_url text;
alter table public.settlements add column if not exists studio_amount integer;
alter table public.settlements add column if not exists materials_receipt_url text;
alter table public.settlements add column if not exists materials_amount integer;
alter table public.settlements add column if not exists participant_count integer;

create table if not exists public.settlement_hosts (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  name text not null,
  account text not null,
  reward_amount integer not null default 10000,
  status text not null default 'pending' check (status in ('pending', 'paid', 'not_needed'))
);

alter table public.settlement_hosts enable row level security;

-- 정산 주최자 정보: 임원진 또는 정산 등록 본인이 조회 가능
drop policy if exists "정산 주최자 정보 조회" on public.settlement_hosts;
create policy "정산 주최자 정보 조회" on public.settlement_hosts
  for select using (
    public.is_officer()
    or exists (
      select 1 from public.settlements s where s.id = settlement_hosts.settlement_id and s.host_id = auth.uid()
    )
  );

-- 등록: 본인이 접수한 정산 건에만 등록 가능
drop policy if exists "정산 주최자 정보 등록" on public.settlement_hosts;
create policy "정산 주최자 정보 등록" on public.settlement_hosts
  for insert with check (
    exists (
      select 1 from public.settlements s where s.id = settlement_hosts.settlement_id and s.host_id = auth.uid()
    )
  );

-- 보상금 지급 상태 변경은 임원진만
drop policy if exists "정산 주최자 정보 수정" on public.settlement_hosts;
create policy "정산 주최자 정보 수정" on public.settlement_hosts
  for update using (public.is_officer());
