export type EventTiming = {
  event_date: string;
  end_date: string | null;
  end_time: string | null;
};

// 종료 시각(있으면 분 단위, 없으면 자정)까지 지나야 활동이 끝난 것으로 판단
export function isEventOver(e: EventTiming): boolean {
  const endDateStr = e.end_date ?? e.event_date;
  const cutoff = e.end_time ? new Date(`${endDateStr}T${e.end_time}`) : new Date(`${endDateStr}T23:59:59`);
  return new Date() > cutoff;
}
