import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "메인 홈" },
  { href: "/calendar", label: "캘린더" },
  { href: "/album", label: "앨범" },
  { href: "/guide", label: "운영규칙/FAQ" },
  { href: "/mypage", label: "마이페이지" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-brand-700">
            BAKU
          </span>
          <span className="hidden text-xs font-medium text-brand-500 sm:inline">
            고려대학교 중앙동아리
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-brand-700 transition-colors hover:text-accent-500"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          로그인
        </Link>
      </div>
    </header>
  );
}
