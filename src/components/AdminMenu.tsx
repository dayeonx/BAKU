"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ADMIN_LINKS = [
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/events", label: "행사 관리" },
  { href: "/admin/settlements", label: "정산 관리" },
  { href: "/admin/tasks", label: "업무 관리" },
];

export default function AdminMenu() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-accent-500"
      >
        관리자
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-brand-100 bg-white shadow-lg">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-brand-700 transition-colors hover:bg-brand-50 hover:text-accent-500"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
