// 임시 비밀번호 규칙: 학번의 숫자만 남긴 뒤 마지막 6자리
export function tempPasswordFor(studentId: string): string {
  const digits = studentId.replace(/\D/g, "");
  return digits.slice(-6).padStart(6, "0");
}

export const STUDENT_EMAIL_DOMAIN = "@baku.internal";
