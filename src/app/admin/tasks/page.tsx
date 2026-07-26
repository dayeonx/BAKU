"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/FormField";

const BOARD_DEPARTMENTS = [
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

function statusClass(status: string): string {
  if (status === "done") return "bg-brand-700 text-white";
  if (status === "in_progress") return "bg-accent-500 text-white";
  return "bg-brand-100 text-brand-700";
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type WorkTask = {
  id: string;
  department: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
};

type Comment = { id: string; comment_text: string; created_at: string; author_name: string };

export default function AdminTasksPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    setUserId(userData.user.id);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("department, status")
      .eq("id", userData.user.id)
      .single();
    const officer = !!myProfile && myProfile.department !== "member" && myProfile.status === "active";
    setIsOfficer(officer);

    if (officer) {
      const { data } = await supabase
        .from("work_tasks")
        .select("id, department, title, description, status, due_date")
        .order("created_at", { ascending: true });
      setTasks(data ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer || !userId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">업무 관리</h1>
      <p className="mt-2 text-sm text-brand-500">
        부서별 업무를 등록하고, 진행 상황을 표시하거나 다른 부서로 옮길 수 있어요.
      </p>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {BOARD_DEPARTMENTS.map((dept) => (
          <DepartmentColumn
            key={dept.value}
            dept={dept}
            tasks={tasks.filter((t) => t.department === dept.value)}
            userId={userId}
            supabase={supabase}
            onDone={load}
          />
        ))}
      </div>
    </div>
  );
}

function DepartmentColumn({
  dept,
  tasks,
  userId,
  supabase,
  onDone,
}: {
  dept: { value: string; label: string };
  tasks: WorkTask[];
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [targetDept, setTargetDept] = useState(dept.value);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from("work_tasks").insert({
      department: targetDept,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      created_by: userId,
    });
    setSaving(false);
    setTitle("");
    setDescription("");
    setDueDate("");
    setTargetDept(dept.value);
    setShowForm(false);
    onDone();
  }

  return (
    <div className="w-72 shrink-0 rounded-2xl border border-brand-100 bg-brand-50/50 p-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-bold text-brand-700">
          {dept.label} <span className="font-normal text-brand-300">({tasks.length})</span>
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-100"
        >
          + 새 업무
        </button>
      </div>

      {showForm && (
        <div className="mt-2 space-y-2 rounded-xl border border-brand-100 bg-white p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="업무 제목"
            className={inputClass}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={2}
            className={inputClass}
          />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          <label className="block text-xs text-brand-500">
            담당 부서
            <select
              value={targetDept}
              onChange={(e) => setTargetDept(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              {BOARD_DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {saving ? "등록 중..." : "등록하기"}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {tasks.length === 0 && !showForm && <p className="px-1 text-xs text-brand-300">업무가 없어요.</p>}
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} userId={userId} supabase={supabase} onDone={onDone} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  userId,
  supabase,
  onDone,
}: {
  task: WorkTask;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const todayKey = toDateKey(new Date());
  const isOverdue = !!task.due_date && task.due_date < todayKey && task.status !== "done";

  async function loadComments() {
    setLoadingComments(true);
    const { data } = await supabase
      .from("work_task_comments")
      .select("id, comment_text, created_at, profiles(name)")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    setComments(
      (data ?? []).map((r) => {
        const p = r.profiles as unknown as { name: string } | null;
        return { id: r.id, comment_text: r.comment_text, created_at: r.created_at, author_name: p?.name ?? "-" };
      }),
    );
    setLoadingComments(false);
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next) await loadComments();
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    await supabase
      .from("work_task_comments")
      .insert({ task_id: task.id, profile_id: userId, comment_text: commentText.trim() });
    setCommentText("");
    await loadComments();
  }

  async function handleStatusChange(status: string) {
    await supabase.from("work_tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", task.id);
    onDone();
  }

  async function handleDeptChange(department: string) {
    await supabase.from("work_tasks").update({ department, updated_at: new Date().toISOString() }).eq("id", task.id);
    onDone();
  }

  async function handleDelete() {
    await supabase.from("work_tasks").delete().eq("id", task.id);
    onDone();
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-brand-700">{task.title}</p>
        <button onClick={handleDelete} className="shrink-0 text-xs text-brand-300 hover:text-red-600">
          삭제
        </button>
      </div>
      {task.description && <p className="mt-1 text-xs text-brand-500">{task.description}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(task.status)}`}>
          {statusLabel(task.status)}
        </span>
        {task.due_date && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${isOverdue ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-500"}`}>
            ~{task.due_date}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-brand-100 px-2 py-1 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={task.department}
          onChange={(e) => handleDeptChange(e.target.value)}
          className="rounded-lg border border-brand-100 px-2 py-1 text-xs"
        >
          {BOARD_DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <button
          onClick={toggleComments}
          className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
        >
          댓글 {showComments ? "▲" : "▼"}
        </button>
      </div>

      {showComments && (
        <div className="mt-2 space-y-2 rounded-lg bg-brand-50 p-2">
          {loadingComments ? (
            <p className="text-xs text-brand-300">불러오는 중...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-brand-300">아직 댓글이 없어요.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="text-xs text-brand-700">
                <span className="font-semibold">{c.author_name}</span>
                <span className="ml-1 text-brand-500">{c.comment_text}</span>
              </div>
            ))
          )}
          <div className="flex gap-1">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글 남기기"
              className="flex-1 rounded-lg border border-brand-100 px-2 py-1 text-xs"
            />
            <button
              onClick={handleAddComment}
              className="rounded-lg bg-accent-500 px-2 py-1 text-xs font-semibold text-white hover:bg-accent-700"
            >
              등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
