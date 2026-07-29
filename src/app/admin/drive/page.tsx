"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/FormField";

type DriveLink = {
  id: string;
  title: string;
  url: string;
  created_at: string;
  profiles: { name: string } | null;
};

export default function AdminDrivePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [links, setLinks] = useState<DriveLink[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("department, status")
      .eq("id", userData.user.id)
      .single();
    const officer = !!myProfile && myProfile.department !== "member" && myProfile.status === "active";
    setIsOfficer(officer);

    if (officer) {
      const { data } = await supabase
        .from("drive_links")
        .select("id, title, url, created_at, profiles(name)")
        .order("created_at", { ascending: false });
      setLinks((data ?? []) as unknown as DriveLink[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("drive_links").insert({
      title: title.trim(),
      url: url.trim(),
      created_by: userData.user!.id,
    });
    setSaving(false);
    setTitle("");
    setUrl("");
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("drive_links").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">구글드라이브</h1>
      <p className="mt-2 text-sm text-brand-500">동아리에서 사용하는 구글드라이브 폴더·문서 링크를 모아둬요.</p>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-5">
        <p className="text-sm font-bold text-brand-700">링크 등록</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (예: 2026 주점 자료)"
          className={`${inputClass} mt-2`}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="구글드라이브 링크 URL"
          className={`${inputClass} mt-2`}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !title.trim() || !url.trim()}
          className="mt-3 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {saving ? "등록 중..." : "링크 등록하기"}
        </button>
      </div>

      <div className="mt-8">
        <p className="text-sm font-bold text-brand-700">등록된 링크</p>
        {links.length === 0 ? (
          <p className="mt-2 text-sm text-brand-300">아직 등록된 링크가 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm"
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-accent-700 hover:underline"
                >
                  {l.title}
                </a>
                <div className="flex items-center gap-2 text-xs text-brand-300">
                  <span>{l.profiles?.name ?? "-"} 등록</span>
                  <button onClick={() => handleDelete(l.id)} className="hover:text-red-600">
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
