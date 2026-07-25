-- 일반 회원은 자유주최만 등록 가능, 임원진은 모든 종류 등록 가능
drop policy if exists "일정 등록" on public.events;
create policy "일정 등록" on public.events
  for insert with check (
    auth.uid() = created_by
    and (public.is_officer() or category = 'free')
  );
