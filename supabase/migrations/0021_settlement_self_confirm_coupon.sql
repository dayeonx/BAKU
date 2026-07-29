-- BAKU: 참여자 본인 정산완료 확인 + 정산 배정 시 쿠폰 적용

alter table public.settlement_participants add column if not exists coupon_id uuid references public.coupons (id);

create or replace function public.mark_settlement_participant_paid(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.settlement_participants
  set paid = true
  where id = p_id and profile_id = auth.uid();
end;
$$;
