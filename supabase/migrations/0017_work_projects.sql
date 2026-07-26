-- BAKU: 업무 관리 - 프로젝트 단위로 업무 단계를 묶어서 관리

create table if not exists public.work_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.work_projects enable row level security;

drop policy if exists "프로젝트 조회" on public.work_projects;
create policy "프로젝트 조회" on public.work_projects
  for select using (public.is_officer());

drop policy if exists "프로젝트 등록" on public.work_projects;
create policy "프로젝트 등록" on public.work_projects
  for insert with check (public.is_officer() and auth.uid() = created_by);

drop policy if exists "프로젝트 삭제" on public.work_projects;
create policy "프로젝트 삭제" on public.work_projects
  for delete using (public.is_officer());

-- 기존 업무 카드를 프로젝트에 속한 "업무 단계"로 확장
alter table public.work_tasks add column if not exists project_id uuid references public.work_projects (id) on delete cascade;
alter table public.work_tasks add column if not exists step_order integer not null default 1;
alter table public.work_tasks add column if not exists requirements text;
