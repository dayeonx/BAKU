-- BAKU: 정산 등록 폼이 스튜디오/재료 항목으로 세분화되면서 더 이상 채우지 않는 옛 컬럼들을 nullable로 변경

alter table public.settlements alter column receipt_url drop not null;
alter table public.settlements alter column bank_account drop not null;
alter table public.settlements alter column total_amount drop not null;
