export const EVENT_CATEGORIES = [
  { value: "regular", label: "정기주최", color: "#A8632F" },
  { value: "free", label: "자유주최", color: "#E0791F" },
  { value: "monthly_special", label: "월별 스페셜 베이킹", color: "#C2410C" },
  { value: "welcome", label: "신환회", color: "#B45309" },
  { value: "mt", label: "엠티", color: "#0EA5E9" },
  { value: "bread_tour", label: "빵지순례", color: "#65A30D" },
  { value: "team_mission", label: "조별 베이킹", color: "#7C3AED" },
  { value: "snack", label: "간식행사", color: "#DB2777" },
  { value: "pub", label: "주점", color: "#475569" },
] as const;

export function categoryLabel(value: string): string {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function categoryColor(value: string): string {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.color ?? "#A8632F";
}
