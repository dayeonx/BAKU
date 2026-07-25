export const DEPARTMENTS = [
  { value: "member", label: "일반 회원" },
  { value: "president", label: "회장단" },
  { value: "executive", label: "집행부" },
  { value: "planning", label: "기획부" },
  { value: "treasury", label: "총무부" },
  { value: "pr", label: "홍보부" },
] as const;

export function departmentLabel(value: string): string {
  return DEPARTMENTS.find((d) => d.value === value)?.label ?? value;
}
