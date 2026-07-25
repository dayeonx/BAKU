// 이 파일 상단의 데이터만 바꾸면 메인 홈 내용을 쉽게 수정할 수 있습니다.

const ACTIVITIES = [
  { emoji: "📅", title: "정기주최", desc: "매주 정해진 일정에 진행되는 정규 베이킹 활동" },
  { emoji: "🎂", title: "자유주최", desc: "회원 누구나 원하는 날짜에 직접 여는 베이킹 모임" },
  { emoji: "🍰", title: "월별 스페셜 베이킹", desc: "매달 특별한 주제로 진행되는 베이킹 이벤트" },
  { emoji: "🍪", title: "간식행사", desc: "동아리 활동 중 간식을 나누는 소소한 행사" },
  { emoji: "🚌", title: "엠티", desc: "학기마다 떠나는 동아리 엠티" },
  { emoji: "🥐", title: "빵지순례", desc: "유명 빵집을 함께 탐방하는 활동" },
  { emoji: "🍻", title: "주점", desc: "축제 기간 디저트를 제공하는 주점을 운영해볼 수 있는 활동" },
  { emoji: "🎉", title: "신환회", desc: "신입 부원을 환영하는 행사" },
  { emoji: "👥", title: "조별 베이킹", desc: "조를 이루어 미션 베이킹을 수행하는 활동" },
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

const BAKING_PLACE = {
  name: "슈가마미의 베이킹 스튜디오",
  address: "삼선교로16길 16-3 2층 (지번: 삼선동2가 132)",
  phone: "0507-1342-6976",
  mapUrl:
    "https://map.naver.com/p/entry/place/1978941733?placePath=%2Fhome%3Fentry%3Dplt%26from%3Dmap%26fromPanelNum%3D1%26additionalHeight%3D76%26timestamp%3D202607241919%26locale%3Dko%26svcName%3Dmap_pcv5&searchType=place&lng=127.0103229&lat=37.5874425&c=15.00,0,0,0,dh",
  blogUrl: "https://m.blog.naver.com/tmxkdbfl22/224133370715",
  discount: "동아리 특별 할인가: 1시간 7,000원",
};

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {ACTIVITIES.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl border border-brand-100 bg-white p-5 text-center"
            >
              <div className="text-3xl">{a.emoji}</div>
              <div className="mt-2 font-bold text-brand-700">{a.title}</div>
              <p className="mt-1 text-xs text-brand-500">{a.desc}</p>
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
