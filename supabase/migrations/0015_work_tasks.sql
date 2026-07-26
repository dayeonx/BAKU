-- BAKU: 관리자 페이지 - 부서별 업무 관리 (5분할 보드)

create table if not exists public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('president', 'executive', 'planning', 'treasury', 'pr')),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  due_date date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  comment_text text not null,
  created_at timestamptz not null default now()
);

alter table public.work_tasks enable row level security;
alter table public.work_task_comments enable row level security;

-- 업무 카드: 임원진만 조회/등록/수정(담당 부서 변경, 상태 변경 포함) 가능
drop policy if exists "업무 조회" on public.work_tasks;
create policy "업무 조회" on public.work_tasks
  for select using (public.is_officer());

drop policy if exists "업무 등록" on public.work_tasks;
create policy "업무 등록" on public.work_tasks
  for insert with check (public.is_officer() and auth.uid() = created_by);

drop policy if exists "업무 수정" on public.work_tasks;
create policy "업무 수정" on public.work_tasks
  for update using (public.is_officer());

drop policy if exists "업무 삭제" on public.work_tasks;
create policy "업무 삭제" on public.work_tasks
  for delete using (public.is_officer());

-- 업무 댓글: 임원진만 조회/작성 가능, 삭제는 작성자 본인 또는 회장단
drop policy if exists "업무 댓글 조회" on public.work_task_comments;
create policy "업무 댓글 조회" on public.work_task_comments
  for select using (public.is_officer());

drop policy if exists "업무 댓글 작성" on public.work_task_comments;
create policy "업무 댓글 작성" on public.work_task_comments
  for insert with check (public.is_officer() and auth.uid() = profile_id);

drop policy if exists "업무 댓글 삭제" on public.work_task_comments;
create policy "업무 댓글 삭제" on public.work_task_comments
  for delete using (auth.uid() = profile_id or public.is_president());
