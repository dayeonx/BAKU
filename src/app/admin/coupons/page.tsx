"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/FormField";

type Member = { id: string; name: string; student_id: string };

type Coupon = {
  id: string;
  reason: string;
  max_amount: number | null;
  valid_until: string | null;
  used: boolean;
  created_at: string;
  profiles: { name: string; student_id: string } | null;
};

export default function AdminCouponsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [reason, setReason] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("department, status")
      .eq("id", userData.user.id)
      .single();
    const officer = !!myProfile && myProfile.department !== "member" && myProfile.status === "active";
    setIsOfficer(officer);

    if (officer) {
      const [{ data: memberRows }, { data: couponRows }] = await Promise.all([
        supabase.from("profiles").select("id, name, student_id").order("name", { ascending: true }),
        supabase
          .from("coupons")
          .select(
            "id, reason, max_amount, valid_until, used, created_at, profiles!coupons_profile_id_fkey(name, student_id)",
          )
          .eq("used", false)
          .order("created_at", { ascending: false }),
      ]);
      setMembers(memberRows ?? []);
      setCoupons((couponRows ?? []) as unknown as Coupon[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMembers =
    query.trim().length === 0
      ? []
      : members
          .filter((m) => m.name.includes(query.trim()) || m.student_id.includes(query.trim()))
          .slice(0, 8);

  async function handleIssue() {
    if (!selectedMemberId || !reason.trim()) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("coupons").insert({
      profile_id: selectedMemberId,
      reason: reason.trim(),
      max_amount: maxAmount ? Number(maxAmount) : null,
      valid_until: validUntil || null,
      granted_by: userData.user!.id,
    });
    setSaving(false);
    setQuery("");
    setSelectedMemberId("");
    setReason("");
    setMaxAmount("");
    setValidUntil("");
    load();
  }

  async function handleMarkUsed(id: string) {
    await supabase.from("coupons").update({ used: true }).eq("id", id);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("coupons").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">쿠폰 관리</h1>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-5">
        <p className="text-sm font-bold text-brand-700">쿠폰 등록</p>

        {selectedMember ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
            <span>
              {selectedMember.name} ({selectedMember.student_id})
            </span>
            <button
              onClick={() => {
                setSelectedMemberId("");
                setQuery("");
              }}
              className="text-xs text-brand-300 hover:text-red-600"
            >
              변경
            </button>
          </div>
        ) : (
          <div className="relative mt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 또는 학번으로 검색"
              className={inputClass}
            />
            {filteredMembers.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-brand-100 bg-white shadow-lg">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMemberId(m.id);
                      setQuery("");
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                  >
                    {m.name} ({m.student_id})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="받은 사유 (예: 조별 베이킹 우수 참여자)"
          className={`${inputClass} mt-2`}
        />
        <div className="mt-2 flex gap-2">
          <input
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="최대 지원 금액 (원, 선택)"
            className={inputClass}
          />
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          onClick={handleIssue}
          disabled={saving || !selectedMemberId || !reason.trim()}
          className="mt-3 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {saving ? "등록 중..." : "쿠폰 등록하기"}
        </button>
      </div>

      <div className="mt-8">
        <p className="text-sm font-bold text-brand-700">현재 발급된 쿠폰 ({coupons.length})</p>
        {coupons.length === 0 ? (
          <p className="mt-2 text-sm text-brand-300">사용 가능한 쿠폰이 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {coupons.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-semibold text-brand-700">
                    {c.profiles?.name ?? "-"} ({c.profiles?.student_id ?? "-"})
                  </span>
                  <span className="ml-2 text-brand-500">{c.reason}</span>
                  {c.max_amount !== null && (
                    <span className="ml-2 text-xs text-brand-300">최대 {c.max_amount.toLocaleString()}원</span>
                  )}
                  {c.valid_until && <span className="ml-2 text-xs text-brand-300">~{c.valid_until}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMarkUsed(c.id)}
                    className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700 hover:bg-accent-100"
                  >
                    사용완료 처리
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-brand-300 hover:text-red-600">
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
