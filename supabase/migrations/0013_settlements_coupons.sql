-- BAKU: 마이페이지 (정산, 무료 베이킹 쿠폰)

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  host_id uuid not null references public.profiles (id),
  receipt_url text not null,
  bank_account text not null,
  total_amount integer not null check (total_amount >= 0),
  host_reward_amount integer,
  host_reward_paid boolean not null default false,
  status text not null default 'submitted' check (status in ('submitted', 'assigned', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.settlement_participants (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  amount integer not null check (amount >= 0),
  paid boolean not null default false,
  unique (settlement_id, profile_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  reason text not null,
  granted_by uuid not null references public.profiles (id),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.settlements enable row level security;
alter table public.settlement_participants enable row level security;
alter table public.coupons enable row level security;

-- 정산: 주최자 본인/참여자/임원진이 조회 가능, 등록은 종료된 활동의 주최자만
drop policy if exists "정산 조회" on public.settlements;
create policy "정산 조회" on public.settlements
  for select using (
    public.is_officer()
    or host_id = auth.uid()
    or exists (select 1 from public.event_participants p where p.event_id = settlements.event_id and p.profile_id = auth.uid())
  );

drop policy if exists "정산 등록" on public.settlements;
create policy "정산 등록" on public.settlements
  for insert with check (
    auth.uid() = host_id
    and public.is_event_host(event_id, auth.uid())
    and public.is_event_finished(event_id)
  );

drop policy if exists "정산 임원진 수정" on public.settlements;
create policy "정산 임원진 수정" on public.settlements
  for update using (public.is_officer());

-- 정산 참여자별 금액: 본인/주최자/임원진 조회, 등록·수정은 임원진만 (추후 관리자 페이지에서 사용)
drop policy if exists "정산 참여자 금액 조회" on public.settlement_participants;
create policy "정산 참여자 금액 조회" on public.settlement_participants
  for select using (
    public.is_officer()
    or profile_id = auth.uid()
    or exists (select 1 from public.settlements s where s.id = settlement_participants.settlement_id and s.host_id = auth.uid())
  );

drop policy if exists "정산 참여자 금액 등록" on public.settlement_participants;
create policy "정산 참여자 금액 등록" on public.settlement_participants
  for insert with check (public.is_officer());

drop policy if exists "정산 참여자 금액 수정" on public.settlement_participants;
create policy "정산 참여자 금액 수정" on public.settlement_participants
  for update using (public.is_officer());

-- 무료 베이킹 쿠폰: 본인/임원진 조회, 등록은 임원진만 (추후 관리자 페이지에서 사용)
drop policy if exists "쿠폰 조회" on public.coupons;
create policy "쿠폰 조회" on public.coupons
  for select using (public.is_officer() or profile_id = auth.uid());

drop policy if exists "쿠폰 등록" on public.coupons;
create policy "쿠폰 등록" on public.coupons
  for insert with check (public.is_officer());

drop policy if exists "쿠폰 수정" on public.coupons;
create policy "쿠폰 수정" on public.coupons
  for update using (public.is_officer());

-- 정산 영수증 저장용 비공개 스토리지 버킷 (사업 계좌·금액 정보가 담겨있어 공개 버킷 사용 불가)
insert into storage.buckets (id, name, public)
values ('settlements', 'settlements', false)
on conflict (id) do nothing;

drop policy if exists "정산 영수증 조회" on storage.objects;
create policy "정산 영수증 조회" on storage.objects
  for select using (
    bucket_id = 'settlements'
    and auth.role() = 'authenticated'
    and (
      public.is_officer()
      or public.is_event_host((storage.foldername(name))[2]::uuid, auth.uid())
      or exists (
        select 1 from public.event_participants p
        where p.event_id = (storage.foldername(name))[2]::uuid and p.profile_id = auth.uid()
      )
    )
  );

drop policy if exists "정산 영수증 업로드" on storage.objects;
create policy "정산 영수증 업로드" on storage.objects
  for insert with check (
    bucket_id = 'settlements'
    and auth.role() = 'authenticated'
    and public.is_event_host((storage.foldername(name))[2]::uuid, auth.uid())
  );
