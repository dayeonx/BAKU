-- BAKU: 업무 단계 담당자를 부서 다중선택 + 자유 텍스트 이름 조합으로 확장

alter table public.work_tasks add column if not exists assignees text[] not null default '{}';

update public.work_tasks set assignees = array[department] where assignees = '{}';

alter table public.work_tasks alter column department drop not null;
alter table public.work_tasks drop constraint if exists work_tasks_department_check;

-- 완료 처리 권한: 담당자 목록에 내 부서가 포함된 경우에만 허용 (자유 입력 이름은 표시용이라 권한에 영향 없음)
drop policy if exists "업무 수정" on public.work_tasks;
create policy "업무 수정" on public.work_tasks
  for update using (public.is_officer())
  with check (
    public.is_officer()
    and (status <> 'done' or public.my_department() = any(assignees))
  );
