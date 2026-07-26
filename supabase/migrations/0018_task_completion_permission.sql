-- BAKU: 업무 완료 처리는 담당 부서 소속 임원진만 가능하도록 제한
-- (업무 등록·상태 변경 자체는 계속 임원진 누구나 가능, "완료"로 바꾸는 것만 제한)

create or replace function public.my_department()
returns text
language sql
security definer
set search_path = public
as $$
  select department from public.profiles where id = auth.uid();
$$;

drop policy if exists "업무 수정" on public.work_tasks;
create policy "업무 수정" on public.work_tasks
  for update using (public.is_officer())
  with check (
    public.is_officer()
    and (status <> 'done' or department = public.my_department())
  );
