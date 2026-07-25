// 최초 계정 생성 시 아이디/비밀번호는 모두 학번 그대로 발급되고, 이후 본인이 강제로 변경한다.
export function initialCredentialFor(studentId: string): string {
  return studentId.trim();
}

export const STUDENT_EMAIL_DOMAIN = "@baku.internal";
