-- BAKU: 참여자 본인이 마이페이지에서 직접 쿠폰을 적용해 정산 금액을 할인받도록 함

create or replace function public.apply_settlement_coupon(p_participant_id uuid, p_coupon_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_current_amount integer;
  v_coupon_found boolean;
  v_max_amount integer;
begin
  select amount into v_current_amount
  from public.settlement_participants
  where id = p_participant_id and profile_id = auth.uid() and coupon_id is null and paid = false;

  if v_current_amount is null then
    raise exception '쿠폰을 적용할 수 없는 정산 항목입니다.';
  end if;

  select true, max_amount into v_coupon_found, v_max_amount
  from public.coupons
  where id = p_coupon_id and profile_id = auth.uid() and used = false;

  if v_coupon_found is null then
    raise exception '사용할 수 없는 쿠폰입니다.';
  end if;

  update public.settlement_participants
  set coupon_id = p_coupon_id,
      amount = greatest(v_current_amount - coalesce(v_max_amount, v_current_amount), 0)
  where id = p_participant_id;

  update public.coupons set used = true where id = p_coupon_id;
end;
$$;
