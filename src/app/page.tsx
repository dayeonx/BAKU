// 이 파일 상단의 데이터만 바꾸면 메인 홈 내용을 쉽게 수정할 수 있습니다.

import { BAKING_PLACE } from "@/lib/bakingPlace";

const ACTIVITIES = [
  { emoji: "📅", title: "정기주최" },
  { emoji: "🎂", title: "자유주최" },
  { emoji: "🍰", title: "월별 스페셜 베이킹" },
  { emoji: "🎉", title: "신환회" },
  { emoji: "🚌", title: "엠티" },
  { emoji: "🥐", title: "빵지순례" },
  { emoji: "🧑‍🍳", title: "조별 베이킹" },
  { emoji: "🍪", title: "간식행사" },
  { emoji: "🍻", title: "주점" },
];

// TODO: 담당자 확정되면 이름/연락처 채우기
const OFFICERS = [
  { role: "회장", name: "박다연", contact: "추후 업데이트 예정" },
  { role: "부회장", name: "우도린", contact: "추후 업데이트 예정" },
  { role: "집행부", name: "추후 업데이트 예정", contact: "" },
  { role: "기획부", name: "추후 업데이트 예정", contact: "" },
  { role: "총무부", name: "추후 업데이트 예정", contact: "" },
  { role: "홍보부", name: "추후 업데이트 예정", contact: "" },
];

// TODO: 실제 연혁으로 교체
const HISTORY = [
  { year: "20XX", event: "BAKU 설립" },
  { year: "20XX", event: "고려대학교 중앙동아리 가등록" },
  { year: "20XX", event: "동방 생성" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          고려대학교 중앙동아리
        </span>
        <h1 className="mt-4 text-4xl font-extrabold text-brand-700 sm:text-5xl">
          BAKU
        </h1>
        <p className="mt-3 text-lg font-medium text-brand-500">
          고려대학교 유일 제과제빵동아리
        </p>
      </section>

      {/* 활동 소개 */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-xl font-bold text-brand-700">BAKU 활동 소개</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ACTIVITIES.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl border border-brand-100 bg-white p-5 text-center"
            >
              <div className="text-3xl">{a.emoji}</div>
              <div className="mt-2 font-bold text-brand-700">{a.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 베이킹 활동 장소 */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-xl font-bold text-brand-700">베이킹 활동 장소</h2>
        <div className="rounded-2xl border border-brand-100 bg-white p-6">
          <h3 className="text-lg font-bold text-brand-700">{BAKING_PLACE.name}</h3>
          <p className="mt-2 text-sm text-brand-500">{BAKING_PLACE.address}</p>
          <p className="mt-1 text-sm text-brand-500">{BAKING_PLACE.phone}</p>
          <p className="mt-2 text-sm font-semibold text-accent-700">
            {BAKING_PLACE.discount}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={BAKING_PLACE.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-brand-100 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100/70"
            >
              지도에서 보기
            </a>
            <a
              href={BAKING_PLACE.blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-brand-100 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100/70"
            >
              장소 블로그 보기
            </a>
          </div>
        </div>
      </section>

      {/* 임원진 소개 */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-xl font-bold text-brand-700">임원진 소개</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {OFFICERS.map((o) => (
            <div
              key={o.role}
              className="rounded-2xl border border-brand-100 bg-white p-4 text-center"
            >
              <div className="text-xs font-semibold text-accent-700">{o.role}</div>
              <div className="mt-1 font-bold text-brand-700">{o.name}</div>
              {o.contact && (
                <div className="mt-1 text-xs text-brand-300">{o.contact}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 베이쿠 연혁 */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="mb-6 text-xl font-bold text-brand-700">베이쿠 연혁</h2>
        <ol className="space-y-3 border-l-2 border-brand-100 pl-6">
          {HISTORY.map((h) => (
            <li key={h.event} className="relative">
              <span className="absolute -left-[1.95rem] top-1 h-3 w-3 rounded-full bg-accent-500" />
              <span className="font-bold text-brand-700">{h.year}</span>
              <span className="ml-2 text-sm text-brand-500">{h.event}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
