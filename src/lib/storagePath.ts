// Supabase Storage 객체 키는 공백·한글 등 비-ASCII 문자를 포함하면 업로드가 거부되므로,
// 원본 파일명에서 확장자를 보존한 채 안전한 문자만 남긴다.
export function safeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";

  const safeBase = base
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "");
  const safeExt = ext.replace(/[^A-Za-z0-9.]/g, "");

  return `${safeBase || "file"}${safeExt}`;
}
