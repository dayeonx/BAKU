-- BAKU: 엠티/신환회/빵지순례/간식행사/주점처럼 회원 주최자가 없는 활동은
-- 임원진이 누구든 직접 정산을 등록할 수 있도록 허용

drop policy if exists "정산 등록" on public.settlements;
create policy "정산 등록" on public.settlements
  for insert with check (
    auth.uid() = host_id
    and public.is_event_finished(event_id)
    and (public.is_event_host(event_id, auth.uid()) or public.is_officer())
  );
