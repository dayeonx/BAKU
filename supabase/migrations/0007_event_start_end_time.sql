-- 일정 시간: 단일 시간 -> 시작/종료 시간
alter table public.events rename column event_time to start_time;
alter table public.events add column if not exists end_time time;
update public.events set end_time = start_time where end_time is null;
alter table public.events alter column end_time set not null;
