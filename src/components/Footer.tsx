// TODO: Notion / Instagram / 카카오톡 채널 링크가 정해지면 아래 값만 채우면 됩니다.
const NOTION_URL = "#";
const INSTAGRAM_URL = "#";
const KAKAO_CHANNEL_URL = "#";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-brand-100 bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6">
        <div className="flex items-center gap-4">
          <a
            href={NOTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Notion"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-colors hover:bg-accent-100 hover:text-accent-700"
          >
            <NotionIcon />
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-colors hover:bg-accent-100 hover:text-accent-700"
          >
            <InstagramIcon />
          </a>
          <a
            href={KAKAO_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="카카오톡 채널"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-colors hover:bg-accent-100 hover:text-accent-700"
          >
            <KakaoIcon />
          </a>
        </div>
        <p className="text-xs text-brand-500">
          © {new Date().getFullYear()} BAKU — 고려대학교 중앙동아리
        </p>
      </div>
    </footer>
  );
}

function NotionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .046-.28-.047-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.213.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.887l-15.177.887c-.56.047-.746.327-.746.933zm14.337.746c.093.42 0 .84-.42.887l-.7.14v10.264c-.606.327-1.166.514-1.633.514-.746 0-.933-.234-1.492-.933l-4.577-7.186v6.952l1.446.327s0 .84-1.166.84l-3.217.186c-.093-.187 0-.653.327-.746l.84-.234V9.854l-1.166-.093c-.094-.42.14-1.026.793-1.073l3.451-.233 4.764 7.279V9.16l-1.213-.14c-.093-.514.28-.887.746-.933z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.64 1.73 4.96 4.34 6.3-.19.68-.69 2.48-.79 2.87 0 0-.02.18.1.25.12.07.26.02.26.02.34-.05 2.6-1.73 3.65-2.42.63.09 1.28.14 1.94.14 5.25 0 9.5-3.36 9.5-7.16S17.25 3.5 12 3.5z" />
    </svg>
  );
}
