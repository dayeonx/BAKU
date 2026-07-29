import { BAKING_PLACE } from "@/lib/bakingPlace";

const NAV = [
  { href: "#free-hosting", label: "자유 주최 가이드" },
  { href: "#settlement", label: "정산 시스템" },
  { href: "#faq", label: "FAQ" },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">운영규칙 / FAQ</h1>
      <p className="mt-2 text-sm text-brand-500">
        BAKU를 함께 만들어가는 데 필요한 규칙과 안내를 정리했어요.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand-500 hover:bg-brand-50"
          >
            {n.label}
          </a>
        ))}
      </nav>

      {/* 자유 주최 가이드 */}
      <section id="free-hosting" className="mt-10 scroll-mt-20">
        <h2 className="text-xl font-bold text-brand-700">자유 주최 가이드</h2>

        <div className="mt-4 space-y-3 rounded-2xl border border-brand-100 bg-white p-5 text-sm leading-relaxed text-brand-700">
          <p>
            임원진이 매주 진행하는 정기 주최 외에도, 부원이라면 누구나 직접 베이킹을 주최할 수 있어요. 정기
            주최 신청을 놓쳤거나 특별히 만들어보고 싶은 품목이 있다면 자유 주최를 활용해보세요.
          </p>
          <p className="text-brand-500">
            단, 베이킹 비용이 지원되는 자유 주최는 <strong className="text-brand-700">주 2회</strong>로
            제한돼요. 특정 주에 활동이 몰리지 않고 매주 다양한 베이킹이 이어질 수 있도록, 자유 주최 신청이
            비어있는 주를 우선적으로 고려해주세요.
          </p>
        </div>

        <ol className="mt-6 space-y-4">
          <GuideStep n={1} title="계획 및 사전 준비">
            <li>자유 주최를 희망하는 주가 비어있는지 확인한 뒤, 집행부장에게 주최 의사를 전달해주세요.</li>
            <li>베이킹 품목과 날짜·시간, 참여 인원을 정해주세요. (참여 인원 6~8인 권장)</li>
            <li>스튜디오에 구비된 재료를 확인하고, 추가로 필요한 재료는 직접 준비해주세요.</li>
          </GuideStep>

          <GuideStep n={2} title="스튜디오 예약">
            <li>
              스튜디오 전화({BAKING_PLACE.phone}) 또는 사장님 연락처({BAKING_PLACE.ownerPhone})로
              예약해주세요.
            </li>
            <li>
              참여 인원 수와 이용 시간을 함께 안내하고, 동아리 할인 적용을 위해 &ldquo;고려대학교 베이킹
              동아리&rdquo;임을 꼭 말씀해주세요.
            </li>
          </GuideStep>

          <GuideStep n={3} title="캘린더 등록 및 참여자 모집">
            <li>캘린더에서 &ldquo;자유주최&rdquo;로 일정을 등록해주세요. (베이킹 스튜디오 예약 여부 체크 필요)</li>
            <li>임원진 승인이 완료되면 캘린더에 공개되고, 회원들이 선착순으로 참여 신청을 할 수 있어요.</li>
            <li>레시피는 미리 준비해두었다가, 활동이 끝난 뒤 앨범 페이지에 PDF로 등록해주세요.</li>
          </GuideStep>

          <GuideStep n={4} title="베이킹 진행">
            <li>안전하고 즐겁게 베이킹을 진행해주세요.</li>
            <li>효율적인 뒷정리를 위해 2인 1조로 같은 조리도구를 함께 사용하는 것을 권장해요.</li>
            <li>활동이 끝나면 앨범 페이지에 사진과 후기를 남겨주세요.</li>
          </GuideStep>

          <GuideStep n={5} title="정산">
            <li>베이킹 다음 날, 스튜디오 사장님께 사용한 재료 양을 전달하고 영수증을 받아주세요.</li>
            <li>마이페이지에서 영수증 사진, 환급 계좌, 총 지출 금액을 입력해 정산을 등록해주세요.</li>
            <li>
              임원진이 확인 후 참여자별 정산 금액을 배정하면, 참여자는 마이페이지에서 납부할 금액을 확인하고
              계좌이체로 납부하면 완료돼요.
            </li>
          </GuideStep>
        </ol>

        <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-5">
          <h3 className="text-sm font-bold text-brand-700">베이킹 스튜디오</h3>
          <dl className="mt-3 space-y-1 text-sm text-brand-500">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 whitespace-nowrap font-semibold text-brand-700">주소</dt>
              <dd>{BAKING_PLACE.address}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 whitespace-nowrap font-semibold text-brand-700">스튜디오 전화</dt>
              <dd>{BAKING_PLACE.phone}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 whitespace-nowrap font-semibold text-brand-700">사장님 연락처</dt>
              <dd>{BAKING_PLACE.ownerPhone}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 정산 시스템 */}
      <section id="settlement" className="mt-14 scroll-mt-20">
        <h2 className="text-xl font-bold text-brand-700">정산 시스템</h2>

        <div className="mt-4 space-y-6">
          <RuleCard title="베이킹 활동 정산 (정기 주최 · 자유 주최)">
            <li>
              베이킹 비용은 <strong>재료비 + 대여비</strong>를 합산해 계산해요. 대여비는 동아리 특별 할인가인{" "}
              <strong>시간당 1인 7,000원</strong>이 적용돼요.
            </li>
            <li>정산 방식: 주최자를 제외한 참여 인원이 1/N으로 비용을 분담해요.</li>
            <li>
              참여자 지원금: 1인당 <strong>10,000원</strong> (1/N 금액에서 지원금을 뺀 나머지 금액만 납부)
            </li>
            <li className="text-brand-300">자유 주최는 비용 지원이 주 2회로 제한돼요.</li>
          </RuleCard>

          <RuleCard title="주최자 보상 제도">
            <li>
              베이킹 레시피를 준비하고 현장을 주도하는 주최자에게는 회당 <strong>10,000원</strong>의 보상금이
              베이킹 비용 면제와 별개로 추가 지급돼요.
            </li>
            <li>
              <strong>1인 주최</strong>: 주최자 베이킹 비용 100% 면제 + 보상금 1만원
            </li>
            <li>
              <strong>2인 공동주최</strong>: 주최자 각자 베이킹 비용 50%씩 면제 + 각자 보상금 1만원 (3인 이상
              공동주최는 불가)
            </li>
            <li className="text-brand-300">
              주최자를 제외한 참여 인원이 4인 이상인 베이킹부터 주최자 비용이 면제돼요.
            </li>
          </RuleCard>

          <RuleCard title="조별 미션">
            <li>정산 방식: 참여 인원 전체가 1/N으로 비용을 분담해요.</li>
            <li>참여자 보상: 학기말 조별 미션 참여율이 가장 우수한 조에게 상품을 지급해요.</li>
            <li className="text-brand-300">주최자 보상금과 참여자 지원금은 제공되지 않아요.</li>
          </RuleCard>

          <RuleCard title="주최를 위한 사전 연습">
            <li>동아리 특별 할인가인 시간당 1인 7,000원이 적용돼요.</li>
            <li className="text-brand-300">대여비·재료비 지원금은 제공되지 않아요.</li>
          </RuleCard>

          <RuleCard title="기타 행사 (신환회, 엠티 등)">
            <li>특수 행사는 운영 상황에 따라 유동적으로 정산돼요.</li>
            <li>정산 방식: 기본적으로 참여 인원 전체 1/N 원칙을 따라요.</li>
            <li>참여자 지원금: 행사 성격과 예산 상황에 따라 지원금 규모가 달라져요.</li>
          </RuleCard>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mt-14 scroll-mt-20">
        <h2 className="text-xl font-bold text-brand-700">FAQ</h2>
        <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-6 text-center text-sm text-brand-300">
          아직 준비 중이에요. 곧 자주 묻는 질문들을 정리해서 채워둘게요.
          <br />
          더 궁금한 점은 하단의 카카오톡 채널로 문의하시면 실시간으로 답변드려요.
        </div>
      </section>
    </div>
  );
}

function GuideStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-brand-100 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
          {n}
        </span>
        <h3 className="font-bold text-brand-700">{title}</h3>
      </div>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-brand-500">{children}</ul>
    </li>
  );
}

function RuleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-5">
      <h3 className="font-bold text-brand-700">{title}</h3>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-brand-500">{children}</ul>
    </div>
  );
}
