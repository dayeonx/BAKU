"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, categoryColor } from "@/lib/eventCategories";

type EventDetail = {
  id: string;
  category: string;
  event_date: string;
  end_date: string | null;
  location: string;
  location_2: string | null;
  items: string | null;
  price_range: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  cover_photo_url: string | null;
};

type NameRow = { profile_id: string; name: string };

type Review = {
  id: string;
  profile_id: string;
  author_name: string;
  review_text: string | null;
  photo_urls: string[];
  created_at: string;
};

type Recipe = {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  uploader_name: string;
  created_at: string;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AlbumDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [hosts, setHosts] = useState<NameRow[]>([]);
  const [participants, setParticipants] = useState<NameRow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    setUserId(userData.user?.id ?? null);

    const { data: eventData } = await supabase
      .from("events")
      .select(
        "id, category, event_date, end_date, location, location_2, items, price_range, start_time, end_time, status, cover_photo_url",
      )
      .eq("id", eventId)
      .maybeSingle();
    setEvent(eventData);

    if (eventData) {
      const [{ data: hostRows }, { data: participantRows }, { data: reviewRows }, { data: recipeRows }] =
        await Promise.all([
          supabase.rpc("album_hosts", { p_event_id: eventId }),
          supabase.rpc("album_participants", { p_event_id: eventId }),
          supabase.rpc("album_reviews_for_event", { p_event_id: eventId }),
          supabase.rpc("album_recipes_for_event", { p_event_id: eventId }),
        ]);
      setHosts(hostRows ?? []);
      setParticipants(participantRows ?? []);
      setReviews(reviewRows ?? []);
      setRecipes(recipeRows ?? []);
    }

    setLoading(false);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const isHost = hosts.some((h) => h.profile_id === userId);
  const isParticipant = participants.some((p) => p.profile_id === userId);
  const isFinished =
    !!event && event.status === "approved" && (event.end_date ?? event.event_date) < toDateKey(new Date());
  const myReview = reviews.find((r) => r.profile_id === userId);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">존재하지 않는 활동이에요.</div>
    );
  }

  if (!isFinished) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-brand-500">
        아직 진행 중이거나 앨범에 등록되지 않은 활동이에요.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/album" className="text-sm text-brand-500 hover:underline">
        ← 앨범으로
      </Link>

      {event.cover_photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.cover_photo_url}
          alt=""
          className="mt-4 aspect-square w-full rounded-2xl object-cover sm:aspect-video"
        />
      )}

      <div className="mt-3 flex items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: categoryColor(event.category) }}
        >
          {categoryLabel(event.category)}
        </span>
      </div>

      <h1 className="mt-3 text-2xl font-extrabold text-brand-700">
        {event.event_date}
        {event.end_date && event.end_date !== event.event_date ? ` ~ ${event.end_date}` : ""}
      </h1>

      <div className="mt-4 space-y-1 text-sm text-brand-700">
        <p>
          <span className="font-semibold text-brand-500">주최자</span>{" "}
          {hosts.map((h) => h.name).join(", ") || "-"}
        </p>
        <p>
          <span className="font-semibold text-brand-500">참여자</span>{" "}
          {participants.length > 0 ? participants.map((p) => p.name).join(", ") : "없음"}
        </p>
        <p>
          <span className="font-semibold text-brand-500">장소</span> {event.location}
          {event.location_2 ? ` / ${event.location_2}` : ""}
        </p>
        {event.items && (
          <p>
            <span className="font-semibold text-brand-500">품목</span> {event.items}
          </p>
        )}
        {event.price_range && (
          <p>
            <span className="font-semibold text-brand-500">가격대</span> {event.price_range}
          </p>
        )}
        {event.start_time && (
          <p>
            <span className="font-semibold text-brand-500">시간</span> {event.start_time.slice(0, 5)}
            {event.end_time ? ` ~ ${event.end_time.slice(0, 5)}` : ""}
          </p>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-brand-700">레시피</h2>
        {recipes.length === 0 ? (
          <p className="mt-2 text-sm text-brand-300">등록된 레시피가 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm"
              >
                <a href={r.file_url} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 hover:underline">
                  {r.title}
                </a>
                <span className="text-xs text-brand-300">{r.uploader_name}</span>
              </li>
            ))}
          </ul>
        )}

        {isHost && <RecipeForm eventId={event.id} userId={userId!} supabase={supabase} onDone={load} />}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-brand-700">후기</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-brand-300">아직 등록된 후기가 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-brand-100 bg-white p-4">
                <p className="text-sm font-semibold text-brand-700">{r.author_name}</p>
                {r.review_text && <p className="mt-1 text-sm text-brand-500">{r.review_text}</p>}
                {r.photo_urls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.photo_urls.map((url, i) => (
                      <div key={i} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                        {isHost && (
                          <button
                            onClick={async () => {
                              await supabase.rpc("set_cover_photo", { p_event_id: event.id, p_photo_url: url });
                              load();
                            }}
                            className={`absolute inset-x-0 bottom-0 rounded-b-lg px-1 py-0.5 text-[10px] font-semibold transition-opacity ${
                              event.cover_photo_url === url
                                ? "bg-accent-500 text-white"
                                : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {event.cover_photo_url === url ? "대표 사진" : "대표로 설정"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {userId && (isHost || isParticipant) && (
          <ReviewForm
            eventId={event.id}
            userId={userId}
            existing={myReview}
            supabase={supabase}
            onDone={load}
          />
        )}
      </section>
    </div>
  );
}

function ReviewForm({
  eventId,
  userId,
  existing,
  supabase,
  onDone,
}: {
  eventId: string;
  userId: string;
  existing: Review | undefined;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [text, setText] = useState(existing?.review_text ?? "");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    setSaving(true);
    const files = fileInputRef.current?.files;
    const newUrls: string[] = [];

    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        const path = `reviews/${eventId}/${userId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("album").upload(path, file);
        if (!uploadError) {
          const { data } = supabase.storage.from("album").getPublicUrl(path);
          newUrls.push(data.publicUrl);
        }
      }
    }

    const photoUrls = [...(existing?.photo_urls ?? []), ...newUrls];

    await supabase
      .from("album_reviews")
      .upsert(
        { event_id: eventId, profile_id: userId, review_text: text || null, photo_urls: photoUrls },
        { onConflict: "event_id,profile_id" },
      );

    setSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onDone();
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <p className="text-sm font-bold text-brand-700">{existing ? "내 후기 수정" : "후기 작성하기"}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="활동 후기를 남겨보세요"
        rows={3}
        className="mt-2 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      />
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="mt-2 text-sm" />
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="mt-3 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {saving ? "저장 중..." : "저장하기"}
      </button>
    </div>
  );
}

function RecipeForm({
  eventId,
  userId,
  supabase,
  onDone,
}: {
  eventId: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !title.trim()) return;

    setSaving(true);
    const path = `recipes/${eventId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("album").upload(path, file);

    if (!uploadError) {
      const { data } = supabase.storage.from("album").getPublicUrl(path);
      await supabase.from("album_recipes").insert({
        event_id: eventId,
        uploaded_by: userId,
        title: title.trim(),
        file_url: data.publicUrl,
        file_name: file.name,
      });
    }

    setSaving(false);
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onDone();
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <p className="text-sm font-bold text-brand-700">레시피 등록하기</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="레시피 이름 (예: 마들렌)"
        className="mt-2 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      />
      <input ref={fileInputRef} type="file" accept="application/pdf" className="mt-2 text-sm" />
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="mt-3 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {saving ? "업로드 중..." : "등록하기"}
      </button>
    </div>
  );
}
