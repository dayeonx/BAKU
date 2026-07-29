"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { categoryMeta, type EventCategoryMeta } from "@/lib/eventCategories";
import { BAKING_PLACE } from "@/lib/bakingPlace";

export default function EventRegisterForm({
  categories,
  autoApprove,
  onClose,
  onCreated,
}: {
  categories: EventCategoryMeta[];
  autoApprove: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<string>(categories[0].value);
  const meta = categoryMeta(category);

  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [location2, setLocation2] = useState("");
  const [items, setItems] = useState("");
  const [capacity, setCapacity] = useState("6");
  const [priceRange, setPriceRange] = useState("");
  const [signupOpenDate, setSignupOpenDate] = useState("");
  const [signupOpenTime, setSignupOpenTime] = useState("");
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [studioConfirmed, setStudioConfirmed] = useState(false);
  const [hostName, setHostName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (meta.needsHostName && !hostName.trim()) {
      setError("주최자 이름을 입력해주세요.");
      return;
    }
    if (meta.needsStudioConfirm && !studioConfirmed) {
      setError("베이킹 스튜디오 예약 여부를 먼저 확인해주세요.");
      return;
    }
    if (meta.timeMode === "range" && endTime && endTime <= startTime) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    if (meta.dateMode === "range" && endDate && endDate < eventDate) {
      setError("종료 날짜는 시작 날짜보다 늦어야 합니다.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("로그인이 필요합니다.");
      return;
    }

    setLoading(true);
    const { data: created, error: insertError } = await supabase
      .from("events")
      .insert({
        category,
        event_date: eventDate,
        end_date: meta.dateMode === "range" ? endDate : null,
        start_time: meta.timeMode === "none" ? null : startTime,
        end_time: meta.timeMode === "range" ? endTime : null,
        location,
        location_2: meta.location === "double" ? location2 : null,
        items: meta.needsItems ? items : null,
        price_range: meta.needsPrice ? priceRange : null,
        capacity: meta.signup === "in_app_auto" ? Number(capacity) : null,
        signup_open_at:
          meta.signup === "in_app_auto"
            ? new Date(`${signupOpenDate}T${signupOpenTime}`).toISOString()
            : null,
        google_form_url: meta.needsGoogleForm ? googleFormUrl : null,
        signup_method: meta.signup,
        created_by: userData.user.id,
        status: autoApprove ? "approved" : "pending",
        host_name: meta.needsHostName ? hostName.trim() : null,
      })
      .select("id")
      .single();

    if (insertError || !created) {
      setLoading(false);
      setError("일정 등록에 실패했습니다.");
      return;
    }

    await supabase.from("event_hosts").insert({ event_id: created.id, profile_id: userData.user.id });

    setLoading(false);
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-brand-100 bg-white p-5 sm:grid-cols-2"
    >
      {categories.length > 1 && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">종류</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {meta.needsHostName && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">{meta.hostLabel} 이름</span>
          <input
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="예: 홍길동"
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-brand-300">공동주최인 경우 두 분의 이름 모두 작성해주세요.</span>
        </label>
      )}

      {meta.needsStudioConfirm && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={studioConfirmed}
              onChange={(e) => setStudioConfirmed(e.target.checked)}
            />
            베이킹 스튜디오 예약을 완료하셨나요?
          </label>
          {!studioConfirmed && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <a
                href={BAKING_PLACE.blogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent-700 hover:underline"
              >
                예약하러 가기 ({BAKING_PLACE.phone})
              </a>
              <Link href="/guide" className="font-semibold text-accent-700 hover:underline">
                주최하는 방법을 모르겠다면? 운영규칙 &gt; 주최 가이드
              </Link>
            </div>
          )}
        </div>
      )}

      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-brand-700">
          {meta.dateMode === "range" ? "시작 날짜" : "날짜"}
        </span>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      {meta.dateMode === "range" && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">종료 날짜</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {meta.timeMode !== "none" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">시작 시간</span>
          <TimeSelect value={startTime} onChange={setStartTime} />
        </label>
      )}
      {meta.timeMode === "range" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">종료 시간</span>
          <TimeSelect value={endTime} onChange={setEndTime} />
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-700">
          {meta.location === "double" ? "장소 1" : "장소"}
        </span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
        />
      </label>
      {meta.location === "double" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">장소 2</span>
          <input
            value={location2}
            onChange={(e) => setLocation2(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {meta.signup === "in_app_auto" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">정원</span>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {meta.needsItems && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">{meta.itemsLabel}</span>
          <input
            value={items}
            onChange={(e) => setItems(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}
      {meta.needsPrice && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-700">예상 가격대</span>
          <input
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {meta.signup === "in_app_auto" && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">신청 오픈 일시</span>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={signupOpenDate}
              onChange={(e) => setSignupOpenDate(e.target.value)}
              required
              className="rounded-lg border border-brand-100 px-3 py-2 text-sm"
            />
            <TimeSelect value={signupOpenTime} onChange={setSignupOpenTime} />
          </div>
        </label>
      )}

      {meta.needsGoogleForm && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-brand-700">{meta.googleFormLabel} (구글폼 링크)</span>
          <input
            type="url"
            value={googleFormUrl}
            onChange={(e) => setGoogleFormUrl(e.target.value)}
            placeholder="https://forms.gle/..."
            required
            className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
          />
        </label>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 sm:col-span-2">{error}</p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {loading ? "등록 중..." : "등록"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100/70"
        >
          취소
        </button>
      </div>
    </form>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_BY_10 = ["00", "10", "20", "30", "40", "50"];

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hour, minute] = value ? value.split(":") : ["", ""];

  function update(nextHour: string, nextMinute: string) {
    if (nextHour && nextMinute) onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <div className="flex gap-2">
      <select
        value={hour}
        onChange={(e) => update(e.target.value, minute || "00")}
        required
        className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          시
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>
      <select
        value={minute}
        onChange={(e) => update(hour || "00", e.target.value)}
        required
        className="w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          분
        </option>
        {MINUTES_BY_10.map((m) => (
          <option key={m} value={m}>
            {m}분
          </option>
        ))}
      </select>
    </div>
  );
}
