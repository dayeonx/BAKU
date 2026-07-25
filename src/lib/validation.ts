// 아이디/비밀번호 공통 규칙: 영문+숫자 조합 (각각 최소 1개 이상 포함), 4~20자
const ALPHANUMERIC_MIX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9!@#$%^&*_-]{4,20}$/;

export function isValidUsername(value: string): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{4,20}$/.test(value);
}

export function isValidPassword(value: string): boolean {
  return ALPHANUMERIC_MIX.test(value);
}

export const CREDENTIAL_FORMAT_HINT = "영문과 숫자를 모두 포함해서 4~20자로 입력해주세요.";
