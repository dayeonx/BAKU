-- BAKU: 업무 단계별 파일 첨부 (업로드/다운로드)

create table if not exists public.work_task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  file_name text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

alter table public.work_task_files enable row level security;

drop policy if exists "업무 파일 조회" on public.work_task_files;
create policy "업무 파일 조회" on public.work_task_files
  for select using (public.is_officer());

drop policy if exists "업무 파일 등록" on public.work_task_files;
create policy "업무 파일 등록" on public.work_task_files
  for insert with check (public.is_officer() and auth.uid() = uploaded_by);

drop policy if exists "업무 파일 삭제" on public.work_task_files;
create policy "업무 파일 삭제" on public.work_task_files
  for delete using (auth.uid() = uploaded_by or public.is_president());

-- 업무 첨부파일 저장용 비공개 스토리지 버킷 (임원진만 접근)
insert into storage.buckets (id, name, public)
values ('work-tasks', 'work-tasks', false)
on conflict (id) do nothing;

drop policy if exists "업무 파일 스토리지 조회" on storage.objects;
create policy "업무 파일 스토리지 조회" on storage.objects
  for select using (bucket_id = 'work-tasks' and public.is_officer());

drop policy if exists "업무 파일 스토리지 업로드" on storage.objects;
create policy "업무 파일 스토리지 업로드" on storage.objects
  for insert with check (bucket_id = 'work-tasks' and public.is_officer());

drop policy if exists "업무 파일 스토리지 삭제" on storage.objects;
create policy "업무 파일 스토리지 삭제" on storage.objects
  for delete using (bucket_id = 'work-tasks' and public.is_officer());
