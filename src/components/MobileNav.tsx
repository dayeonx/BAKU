"use client";

import Link from "next/link";
import { useState } from "react";
import { NAV_LINKS } from "@/lib/navLinks";

export default function MobileNav({ isOfficer }: { isOfficer: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="메뉴"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-brand-700 hover:bg-brand-100"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 z-40 border-b border-brand-100 bg-cream shadow-lg">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                {link.label}
              </Link>
            ))}
            {isOfficer && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                관리자
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
