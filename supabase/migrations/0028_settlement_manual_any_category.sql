-- BAKU: 임원진이 카테고리 제한 없이 어떤 활동이든 직접 정산을 등록할 수 있도록 확장

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
    )
  );
