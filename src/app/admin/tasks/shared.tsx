"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/FormField";
import { safeFileName } from "@/lib/storagePath";

export const BOARD_DEPARTMENTS = [
  { value: "president", label: "회장단" },
  { value: "planning", label: "기획부" },
  { value: "executive", label: "집행부" },
  { value: "treasury", label: "총무부" },
  { value: "pr", label: "홍보부" },
];

const STATUS_OPTIONS: { value: "todo" | "in_progress" | "done"; label: string }[] = [
  { value: "todo", label: "할 일" },
  { value: "in_progress", label: "진행중" },
  { value: "done", label: "완료" },
];

export function statusClass(status: string): string {
  if (status === "done") return "bg-brand-700 text-white";
  if (status === "in_progress") return "bg-accent-500 text-white";
  return "bg-brand-100 text-brand-700";
}

export function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

function departmentLabelOf(value: string): string {
  return BOARD_DEPARTMENTS.find((d) => d.value === value)?.label ?? value;
}

function isDepartmentValue(value: string): boolean {
  return BOARD_DEPARTMENTS.some((d) => d.value === value);
}

export function assigneeLabel(value: string): string {
  return isDepartmentValue(value) ? departmentLabelOf(value) : value;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Project = { id: string; title: string; created_at: string };

export type TaskStep = {
  id: string;
  project_id: string | null;
  step_order: number;
  assignees: string[];
  title: string;
  description: string | null;
  requirements: string | null;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
};

type Comment = { id: string; profile_id: string; comment_text: string; created_at: string; author_name: string };

export function AssigneePicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [nameInput, setNameInput] = useState("");

  function toggleDept(dept: string) {
    onChange(value.includes(dept) ? value.filter((v) => v !== dept) : [...value, dept]);
  }

  function addName() {
    const name = nameInput.trim();
    if (!name || value.includes(name)) return;
    onChange([...value, name]);
    setNameInput("");
  }

  function removeAssignee(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {BOARD_DEPARTMENTS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => toggleDept(d.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              value.includes(d.value) ? "bg-accent-500 text-white" : "bg-brand-100 text-brand-700 hover:bg-brand-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addName();
            }
          }}
          placeholder="이름 직접 입력 (예: 박다연)"
          className={inputClass}
        />
        <button
          type="button"
          onClick={addName}
          className="shrink-0 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-200"
        >
          추가
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700"
            >
              {assigneeLabel(v)}
              <button type="button" onClick={() => removeAssignee(v)} className="text-brand-300 hover:text-red-600">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CompleteToggle({
  task,
  myDepartment,
  supabase,
  onDone,
}: {
  task: TaskStep;
  myDepartment: string | null;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const allowed = task.status === "done" || (!!myDepartment && task.assignees.includes(myDepartment));

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!allowed) return;
    const nextStatus = task.status === "done" ? "todo" : "done";
    await supabase.from("work_tasks").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", task.id);
    onDone();
  }

  return (
    <button
      onClick={handleClick}
      disabled={!allowed}
      title={!allowed ? "담당자만 완료 처리할 수 있어요" : task.status === "done" ? "완료 취소" : "완료로 표시"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
        task.status === "done"
          ? "border-brand-700 bg-brand-700 text-white"
          : allowed
            ? "border-brand-300 bg-white hover:border-accent-500"
            : "cursor-not-allowed border-brand-100 bg-brand-50"
      }`}
    >
      {task.status === "done" ? "✓" : ""}
    </button>
  );
}

export function CompleteButton({
  task,
  myDepartment,
  supabase,
  onDone,
}: {
  task: TaskStep;
  myDepartment: string | null;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isDone = task.status === "done";
  const canComplete = !!myDepartment && task.assignees.includes(myDepartment);

  async function handleReopen() {
    await supabase
      .from("work_tasks")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", task.id);
    onDone();
  }

  async function handleConfirmComplete() {
    await supabase.from("work_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", task.id);
    setConfirming(false);
    onDone();
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <span className="text-brand-700">완료하였습니까?</span>
        <button
          onClick={handleConfirmComplete}
          className="rounded-full bg-accent-500 px-2.5 py-1 font-semibold text-white hover:bg-accent-700"
        >
          예
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-full bg-brand-100 px-2.5 py-1 font-semibold text-brand-700 hover:bg-brand-200"
        >
          아니오
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => (isDone ? handleReopen() : setConfirming(true))}
      disabled={!isDone && !canComplete}
      title={!isDone && !canComplete ? "담당자만 완료 처리할 수 있어요" : undefined}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isDone
          ? "bg-brand-700 text-white hover:bg-brand-900"
          : canComplete
            ? "bg-accent-500 text-white hover:bg-accent-700"
            : "cursor-not-allowed bg-brand-100 text-brand-300"
      }`}
    >
      {isDone ? "완료" : "진행중"}
    </button>
  );
}

export function TaskDetailPanel({
  task,
  userId,
  myDepartment,
  supabase,
  onDone,
  onClose,
}: {
  task: TaskStep;
  userId: string;
  myDepartment: string | null;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("work_task_comments")
      .select("id, profile_id, comment_text, created_at, profiles(name)")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    setComments(
      (data ?? []).map((r) => {
        const p = r.profiles as unknown as { name: string } | null;
        return {
          id: r.id,
          profile_id: r.profile_id,
          comment_text: r.comment_text,
          created_at: r.created_at,
          author_name: p?.name ?? "-",
        };
      }),
    );
    setLoadingComments(false);
  }, [supabase, task.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleAddComment() {
    if (!commentText.trim()) return;
    await supabase.from("work_task_comments").insert({
      task_id: task.id,
      profile_id: userId,
      comment_text: commentText.trim(),
    });
    setCommentText("");
    loadComments();
  }

  async function handleAssigneesChange(assignees: string[]) {
    await supabase.from("work_tasks").update({ assignees, updated_at: new Date().toISOString() }).eq("id", task.id);
    onDone();
  }

  async function handleDelete() {
    await supabase.from("work_tasks").delete().eq("id", task.id);
    onClose();
    onDone();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-brand-300">{task.step_order}단계</p>
          <h2 className="text-base font-extrabold text-brand-700">{task.title}</h2>
        </div>
        <button onClick={onClose} className="text-xs text-brand-300 hover:text-brand-700">
          닫기
        </button>
      </div>

      <div className="mt-3">
        <AssigneePicker value={task.assignees} onChange={handleAssigneesChange} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {task.due_date && (
          <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs text-brand-500">마감 {task.due_date}</span>
        )}
        <CompleteButton task={task} myDepartment={myDepartment} supabase={supabase} onDone={onDone} />
      </div>

      {task.description && (
        <div className="mt-4">
          <p className="text-xs font-bold text-brand-700">설명</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-brand-500">{task.description}</p>
        </div>
      )}

      <FileAttachments taskId={task.id} userId={userId} supabase={supabase} />

      <button onClick={handleDelete} className="mt-4 self-start text-xs text-brand-300 hover:text-red-600">
        업무 단계 삭제
      </button>

      <div className="mt-6 flex flex-1 flex-col border-t border-brand-100 pt-4">
        <p className="text-xs font-bold text-brand-700">질문 · 댓글</p>
        <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
          {loadingComments ? (
            <p className="text-xs text-brand-300">불러오는 중...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-brand-300">아직 댓글이 없어요.</p>
          ) : (
            comments.map((c) => {
              const mine = c.profile_id === userId;
              return (
                <div key={c.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                    <p className={`mb-0.5 px-1 text-[11px] text-brand-300 ${mine ? "text-right" : "text-left"}`}>
                      {c.author_name}
                    </p>
                    <div
                      className={`rounded-2xl px-3 py-2 text-xs ${
                        mine ? "rounded-br-sm bg-accent-500 text-white" : "rounded-bl-sm bg-brand-50 text-brand-700"
                      }`}
                    >
                      {c.comment_text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="질문이나 답변을 남겨보세요"
            className="flex-1 rounded-lg border border-brand-100 px-2 py-1.5 text-xs"
          />
          <button
            onClick={handleAddComment}
            className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}

type TaskFile = { id: string; file_name: string; file_path: string; uploaded_by: string };

function FileAttachments({
  taskId,
  userId,
  supabase,
}: {
  taskId: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("work_task_files")
      .select("id, file_name, file_path, uploaded_by")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    const rows = data ?? [];
    setFiles(rows);

    const entries = await Promise.all(
      rows.map(async (f) => {
        const { data: signed } = await supabase.storage.from("work-tasks").createSignedUrl(f.file_path, 3600);
        return [f.id, signed?.signedUrl ?? null] as const;
      }),
    );
    setLinks(new Map(entries.filter(([, url]) => !!url) as [string, string][]));
  }, [supabase, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${taskId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("work-tasks").upload(path, file);
    if (!uploadError) {
      await supabase.from("work_task_files").insert({
        task_id: taskId,
        uploaded_by: userId,
        file_name: file.name,
        file_path: path,
      });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  async function handleDelete(fileId: string, filePath: string) {
    await supabase.storage.from("work-tasks").remove([filePath]);
    await supabase.from("work_task_files").delete().eq("id", fileId);
    load();
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-brand-700">첨부파일</p>
      {files.length === 0 ? (
        <p className="mt-1 text-xs text-brand-300">첨부된 파일이 없어요.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs">
              {links.get(f.id) ? (
                <a
                  href={links.get(f.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-semibold text-accent-700 hover:underline"
                >
                  {f.file_name}
                </a>
              ) : (
                <span className="truncate text-brand-500">{f.file_name}</span>
              )}
              {f.uploaded_by === userId && (
                <button onClick={() => handleDelete(f.id, f.file_path)} className="shrink-0 text-brand-300 hover:text-red-600">
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-2">
        <input ref={fileInputRef} type="file" className="min-w-0 flex-1 text-xs" />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="shrink-0 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200 disabled:opacity-60"
        >
          {uploading ? "업로드 중..." : "업로드"}
        </button>
      </div>
    </div>
  );
}
