"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, categoryColor } from "@/lib/eventCategories";
import { isEventOver } from "@/lib/eventTime";

const BAKING_CATEGORIES = ["regular", "free", "monthly_special"];
const PARTICIPANT_ONLY_CATEGORIES = ["welcome", "mt", "bread_tour"];

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
  created_at: string;
};

type Recipe = {
  id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  link_url: string | null;
  uploader_name: string;
  created_at: string;
};

type Photo = {
  id: string;
  uploaded_by: string;
  photo_url: string;
  created_at: string;
};

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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [menuPhotos, setMenuPhotos] = useState<Photo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfficer, setIsOfficer] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    if (uid) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("department, status")
        .eq("id", uid)
        .single();
      setIsOfficer(!!myProfile && myProfile.department !== "member" && myProfile.status === "active");
    }

    const { data: eventData } = await supabase
      .from("events")
      .select(
        "id, category, event_date, end_date, location, location_2, items, price_range, start_time, end_time, status, cover_photo_url",
      )
      .eq("id", eventId)
      .maybeSingle();
    setEvent(eventData);

    if (eventData) {
      const isPub = eventData.category === "pub";
      const [
        { data: hostRows },
        { data: participantRows },
        { data: reviewRows },
        { data: recipeRows },
        { data: photoRows },
        menuResult,
        canManageResult,
      ] = await Promise.all([
        supabase.rpc("album_hosts", { p_event_id: eventId }),
        supabase.rpc("album_participants", { p_event_id: eventId }),
        supabase.rpc("album_reviews_for_event", { p_event_id: eventId }),
        supabase.rpc("album_recipes_for_event", { p_event_id: eventId }),
        supabase.rpc("album_photos_for_event", { p_event_id: eventId, p_photo_type: "gallery" }),
        isPub
          ? supabase.rpc("album_photos_for_event", { p_event_id: eventId, p_photo_type: "menu" })
          : Promise.resolve({ data: [] as Photo[] }),
        uid
          ? supabase.rpc("can_manage_album_content", { p_event_id: eventId, p_profile_id: uid })
          : Promise.resolve({ data: false }),
      ]);
      setHosts(hostRows ?? []);
      setParticipants(participantRows ?? []);
      setReviews(reviewRows ?? []);
      setRecipes(recipeRows ?? []);
      setPhotos(photoRows ?? []);
      setMenuPhotos((menuResult.data as Photo[]) ?? []);
      setCanManage(!!canManageResult.data);
    }

    setLoading(false);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const isHost = hosts.some((h) => h.profile_id === userId);
  const isFinished =
    !!event && event.status === "approved" && isEventOver(event);
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

  const isBaking = BAKING_CATEGORIES.includes(event.category);
  const isParticipantOnly = PARTICIPANT_ONLY_CATEGORIES.includes(event.category);
  const isPub = event.category === "pub";
  const isSnack = event.category === "snack";

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
        {isBaking && (
          <>
            <p>
              <span className="font-semibold text-brand-500">주최자</span>{" "}
              {hosts.map((h) => h.name).join(", ") || "-"}
            </p>
            <p>
              <span className="font-semibold text-brand-500">참여자</span>{" "}
              {participants.length > 0 ? participants.map((p) => p.name).join(", ") : "없음"}
            </p>
            {event.items && (
              <p>
                <span className="font-semibold text-brand-500">품목</span> {event.items}
              </p>
            )}
          </>
        )}
        {isParticipantOnly && (
          <p>
            <span className="font-semibold text-brand-500">장소</span> {event.location}
            {event.location_2 ? ` / ${event.location_2}` : ""}
          </p>
        )}
        {isPub && (
          <p>
            <span className="font-semibold text-brand-500">주준위</span>{" "}
            {hosts.map((h) => h.name).join(", ") || "-"}
          </p>
        )}
        {isSnack && event.items && (
          <p>
            <span className="font-semibold text-brand-500">품목</span> {event.items}
          </p>
        )}
      </div>

      <PhotoSection
        title="사진"
        eventId={event.id}
        photoType="gallery"
        photos={photos}
        canManage={canManage}
        userId={userId}
        isOfficer={isOfficer}
        coverUrl={event.cover_photo_url}
        supabase={supabase}
        onDone={load}
      />

      {isBaking && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-brand-700">레시피</h2>
          {recipes.length === 0 ? (
            <p className="mt-2 text-sm text-brand-300">레시피가 등록되지 않았어요.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {recipes.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm"
                >
                  <a
                    href={r.file_url ?? r.link_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-accent-700 hover:underline"
                  >
                    {r.title} {r.file_url ? "(PDF)" : "(링크)"}
                  </a>
                  <span className="text-xs text-brand-300">{r.uploader_name}</span>
                </li>
              ))}
            </ul>
          )}

          {isHost && userId && (
            <RecipeForm eventId={event.id} userId={userId} supabase={supabase} onDone={load} />
          )}
        </section>
      )}

      {isPub && (
        <PhotoSection
          title="대표 메뉴"
          eventId={event.id}
          photoType="menu"
          photos={menuPhotos}
          canManage={canManage}
          userId={userId}
          isOfficer={isOfficer}
          coverUrl={null}
          supabase={supabase}
          onDone={load}
        />
      )}

      <section className="mt-10">
        <h2 className="text-lg font-bold text-brand-700">후기</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-brand-300">아직 등록된 후기가 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-brand-100 bg-white p-4">
                <p className="text-sm font-semibold text-brand-700">{r.author_name}</p>
                {r.review_text && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-500">{r.review_text}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {userId && canManage && (
          <ReviewForm eventId={event.id} userId={userId} existing={myReview} supabase={supabase} onDone={load} />
        )}
      </section>
    </div>
  );
}

function PhotoSection({
  title,
  eventId,
  photoType,
  photos,
  canManage,
  userId,
  isOfficer,
  coverUrl,
  supabase,
  onDone,
}: {
  title: string;
  eventId: string;
  photoType: "gallery" | "menu";
  photos: Photo[];
  canManage: boolean;
  userId: string | null;
  isOfficer: boolean;
  coverUrl: string | null;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0 || !userId) return;

    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const path = `photos/${eventId}/${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("album").upload(path, file);
      if (uploadError) {
        setError(`업로드 실패: ${uploadError.message}`);
        continue;
      }
      const { data } = supabase.storage.from("album").getPublicUrl(path);
      const { error: insertError } = await supabase.from("album_photos").insert({
        event_id: eventId,
        uploaded_by: userId,
        photo_url: data.publicUrl,
        photo_type: photoType,
      });
      if (insertError) {
        setError(`저장 실패: ${insertError.message}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onDone();
  }

  async function handleDelete(photoId: string) {
    const { error: deleteError } = await supabase.from("album_photos").delete().eq("id", photoId);
    if (deleteError) {
      setError(`삭제 실패: ${deleteError.message}`);
      return;
    }
    onDone();
  }

  async function handleSetCover(url: string) {
    const { error: rpcError } = await supabase.rpc("set_cover_photo", { p_event_id: eventId, p_photo_url: url });
    if (rpcError) {
      setError(`대표 사진 설정 실패: ${rpcError.message}`);
      return;
    }
    onDone();
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-brand-700">{title}</h2>
      {photos.length === 0 ? (
        <p className="mt-2 text-sm text-brand-300">등록된 사진이 없어요.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo_url} alt="" className="h-auto w-full rounded-xl" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between rounded-b-xl bg-black/50 px-2 py-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {photoType === "gallery" && canManage ? (
                  <button
                    onClick={() => handleSetCover(p.photo_url)}
                    className={`text-[11px] font-semibold ${coverUrl === p.photo_url ? "text-accent-300" : "text-white"}`}
                  >
                    {coverUrl === p.photo_url ? "대표 사진" : "대표로 설정"}
                  </button>
                ) : (
                  <span />
                )}
                {(p.uploaded_by === userId || isOfficer) && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-[11px] font-semibold hover:text-red-300"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="text-sm" />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="shrink-0 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {uploading ? "업로드 중..." : "사진 등록"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </section>
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
  const [error, setError] = useState<string | null>(null);
  const tooShort = text.trim().length < 100;

  async function handleSubmit() {
    if (tooShort) return;
    setSaving(true);
    setError(null);

    const { error: upsertError } = await supabase
      .from("album_reviews")
      .upsert(
        { event_id: eventId, profile_id: userId, review_text: text.trim() },
        { onConflict: "event_id,profile_id" },
      );

    setSaving(false);
    if (upsertError) {
      setError(`저장 실패: ${upsertError.message}`);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <p className="text-sm font-bold text-brand-700">{existing ? "내 후기 수정" : "후기 작성하기"}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="활동 후기를 100자 이상 남겨주세요"
        rows={5}
        className="mt-2 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      />
      <p className={`mt-1 text-xs ${tooShort ? "text-red-500" : "text-brand-300"}`}>
        {text.trim().length}자{tooShort ? " · 100자 이상 입력해주세요" : ""}
      </p>
      <button
        onClick={handleSubmit}
        disabled={saving || tooShort}
        className="mt-3 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {saving ? "저장 중..." : "저장하기"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
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
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!title.trim() || (!file && !linkUrl.trim())) return;

    setSaving(true);
    setError(null);
    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (file) {
      const path = `recipes/${eventId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("album").upload(path, file);
      if (uploadError) {
        setSaving(false);
        setError(`업로드 실패: ${uploadError.message}`);
        return;
      }
      const { data } = supabase.storage.from("album").getPublicUrl(path);
      fileUrl = data.publicUrl;
      fileName = file.name;
    }

    const { error: insertError } = await supabase.from("album_recipes").insert({
      event_id: eventId,
      uploaded_by: userId,
      title: title.trim(),
      file_url: fileUrl,
      file_name: fileName,
      link_url: linkUrl.trim() || null,
    });

    setSaving(false);
    if (insertError) {
      setError(`저장 실패: ${insertError.message}`);
      return;
    }
    setTitle("");
    setLinkUrl("");
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
      <p className="mt-2 text-xs text-brand-300">PDF 파일을 올리거나, 아래에 레시피 링크를 입력해주세요.</p>
      <input
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        type="url"
        placeholder="https://..."
        className="mt-2 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm"
      />
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="mt-3 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {saving ? "등록 중..." : "등록하기"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
