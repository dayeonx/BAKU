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

function departmentLabelOf(value: string): string {
  return BOARD_DEPARTMENTS.find((d) => d.value === value)?.label ?? value;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function compareDue(a: TaskStep, b: TaskStep): number {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return 0;
}

type Project = { id: string; title: string; created_at: string };

type TaskStep = {
  id: string;
  project_id: string | null;
  step_order: number;
  department: string;
  title: string;
  description: string | null;
  requirements: string | null;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
};

type Comment = { id: string; comment_text: string; created_at: string; author_name: string };

export default function AdminTasksPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [myDepartment, setMyDepartment] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskStep[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");

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
    setMyDepartment(myProfile?.department ?? null);

    if (officer) {
      const [{ data: projectRows }, { data: taskRows }] = await Promise.all([
        supabase.from("work_projects").select("id, title, created_at").order("created_at", { ascending: true }),
        supabase
          .from("work_tasks")
          .select("id, project_id, step_order, department, title, description, requirements, status, due_date")
          .order("step_order", { ascending: true }),
      ]);
      setProjects(projectRows ?? []);
      setTasks(taskRows ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedTaskId) return;
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (task?.project_id) {
      document.getElementById(`project-${task.project_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedTaskId, tasks]);

  async function handleCreateProject() {
    if (!newProjectTitle.trim() || !userId) return;
    await supabase.from("work_projects").insert({ title: newProjectTitle.trim(), created_by: userId });
    setNewProjectTitle("");
    setShowNewProject(false);
    load();
  }

  async function handleDeleteProject(id: string) {
    await supabase.from("work_projects").delete().eq("id", id);
    load();
  }

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

  const todayKey = toDateKey(new Date());

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">업무 관리</h1>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {BOARD_DEPARTMENTS.map((dept) => {
          const deptTasks = tasks
            .filter((t) => t.department === dept.value && t.status !== "done")
            .sort(compareDue);
          return (
            <div key={dept.value} className="w-64 shrink-0 rounded-2xl border border-brand-100 bg-brand-50/50 p-3">
              <h2 className="px-1 font-bold text-brand-700">
                {dept.label} <span className="font-normal text-brand-300">({deptTasks.length})</span>
              </h2>
              <div className="mt-2 space-y-1.5">
                {deptTasks.length === 0 ? (
                  <p className="px-1 text-xs text-brand-300">급한 업무가 없어요.</p>
                ) : (
                  deptTasks.map((t) => {
                    const overdue = !!t.due_date && t.due_date < todayKey;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-xs hover:bg-brand-100"
                      >
                        <CompleteToggle task={t} myDepartment={myDepartment} supabase={supabase} onDone={load} />
                        <span className="min-w-0 flex-1 truncate">
                          <span className={overdue ? "font-semibold text-red-600" : "text-brand-700"}>{t.title}</span>
                          {t.due_date && <span className="ml-1 text-brand-300">~{t.due_date}</span>}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-700">프로젝트</h2>
          <button
            onClick={() => setShowNewProject((v) => !v)}
            className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700"
          >
            + 새 프로젝트
          </button>
        </div>

        {showNewProject && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-brand-100 bg-white p-3">
            <input
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              placeholder="프로젝트 이름 (예: 주점, 간식행사, 엠티)"
              className={inputClass}
            />
            <button
              onClick={handleCreateProject}
              className="shrink-0 rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700"
            >
              등록
            </button>
          </div>
        )}

        <div className="mt-4 space-y-6">
          {projects.length === 0 ? (
            <p className="text-sm text-brand-300">등록된 프로젝트가 없어요.</p>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                steps={tasks.filter((t) => t.project_id === project.id)}
                userId={userId}
                myDepartment={myDepartment}
                supabase={supabase}
                onDone={load}
                onDelete={() => handleDeleteProject(project.id)}
                selectedTaskId={selectedTaskId}
                onOpenDetail={setSelectedTaskId}
                onCloseDetail={() => setSelectedTaskId(null)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CompleteToggle({
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
  const allowed = task.status === "done" || myDepartment === task.department;

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
      title={!allowed ? "담당 부서만 완료 처리할 수 있어요" : task.status === "done" ? "완료 취소" : "완료로 표시"}
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

function ProjectCard({
  project,
  steps,
  userId,
  myDepartment,
  supabase,
  onDone,
  onDelete,
  selectedTaskId,
  onOpenDetail,
  onCloseDetail,
}: {
  project: Project;
  steps: TaskStep[];
  userId: string;
  myDepartment: string | null;
  supabase: ReturnType<typeof createClient>;
  onDone: () => void;
  onDelete: () => void;
  selectedTaskId: string | null;
  onOpenDetail: (taskId: string) => void;
  onCloseDetail: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [department, setDepartment] = useState(BOARD_DEPARTMENTS[0].value);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const orderedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
  const todayKey = toDateKey(new Date());
  const selectedStep = orderedSteps.find((s) => s.id === selectedTaskId) ?? null;

  async function handleAddStep() {
    if (!title.trim()) return;
    setSaving(true);
    const nextOrder = orderedSteps.length > 0 ? Math.max(...orderedSteps.map((s) => s.step_order)) + 1 : 1;
    await supabase.from("work_tasks").insert({
      project_id: project.id,
      step_order: nextOrder,
      department,
      title: title.trim(),
      description: description.trim() || null,
      requirements: requirements.trim() || null,
      due_date: dueDate || null,
      created_by: userId,
    });
    setSaving(false);
    setTitle("");
    setDescription("");
    setRequirements("");
    setDueDate("");
    setDepartment(BOARD_DEPARTMENTS[0].value);
    setShowForm(false);
    onDone();
  }

  return (
    <div id={`project-${project.id}`} className="rounded-2xl border border-brand-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-brand-700">{project.title}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200"
          >
            + 업무 단계 추가
          </button>
          <button onClick={onDelete} className="text-xs text-brand-300 hover:text-red-600">
            프로젝트 삭제
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-3 space-y-2 rounded-xl bg-brand-50 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="업무 단계 제목 (예: 메뉴 선정)"
            className={inputClass}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명"
            rows={2}
            className={inputClass}
          />
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="요구사항"
            rows={2}
            className={inputClass}
          />
          <div className="flex gap-2">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
              {BOARD_DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
          <button
            onClick={handleAddStep}
            disabled={saving}
            className="rounded-full bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {saving ? "등록 중..." : "등록하기"}
          </button>
        </div>
      )}

      {orderedSteps.length === 0 ? (
        <p className="mt-3 text-xs text-brand-300">등록된 업무 단계가 없어요.</p>
      ) : (
        <div className={`mt-3 flex gap-4 ${selectedStep ? "" : ""}`}>
          <ol className={`space-y-2 ${selectedStep ? "w-1/2 shrink-0" : "flex-1"}`}>
            {orderedSteps.map((step) => {
              const overdue = !!step.due_date && step.due_date < todayKey && step.status !== "done";
              const active = step.id === selectedTaskId;
              return (
                <li
                  key={step.id}
                  onClick={() => onOpenDetail(step.id)}
                  className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    active ? "border-accent-500 bg-accent-50" : "border-brand-100 hover:bg-brand-50"
                  }`}
                >
                  <CompleteToggle task={step} myDepartment={myDepartment} supabase={supabase} onDone={onDone} />
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                    {step.step_order}
                  </span>
                  <span className="font-semibold text-brand-700">{step.title}</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-500">
                    {departmentLabelOf(step.department)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(step.status)}`}>
                    {statusLabel(step.status)}
                  </span>
                  {step.due_date && (
                    <span className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-brand-300"}`}>
                      ~{step.due_date}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {selectedStep && (
            <div className="w-1/2 border-l border-brand-100 pl-4">
              <TaskDetailPanel
                task={selectedStep}
                userId={userId}
                myDepartment={myDepartment}
                supabase={supabase}
                onDone={onDone}
                onClose={onCloseDetail}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskDetailPanel({
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

  const canComplete = myDepartment === task.department;

  const loadComments = useCallback(async () => {
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

  async function handleStatusChange(status: string) {
    if (status === "done" && !canComplete) return;
    await supabase.from("work_tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", task.id);
    onDone();
  }

  async function handleDeptChange(department: string) {
    await supabase.from("work_tasks").update({ department, updated_at: new Date().toISOString() }).eq("id", task.id);
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

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-brand-100 px-2 py-1 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value} disabled={s.value === "done" && !canComplete}>
              {s.label}
              {s.value === "done" && !canComplete ? " (담당 부서 전용)" : ""}
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
        {task.due_date && (
          <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs text-brand-500">마감 {task.due_date}</span>
        )}
      </div>

      {task.description && (
        <div className="mt-4">
          <p className="text-xs font-bold text-brand-700">설명</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-brand-500">{task.description}</p>
        </div>
      )}
      {task.requirements && (
        <div className="mt-3">
          <p className="text-xs font-bold text-brand-700">요구사항</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-brand-500">{task.requirements}</p>
        </div>
      )}

      <button onClick={handleDelete} className="mt-4 self-start text-xs text-brand-300 hover:text-red-600">
        업무 단계 삭제
      </button>

      <div className="mt-6 flex-1 border-t border-brand-100 pt-4">
        <p className="text-xs font-bold text-brand-700">질문 · 댓글</p>
        <div className="mt-2 space-y-2">
          {loadingComments ? (
            <p className="text-xs text-brand-300">불러오는 중...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-brand-300">아직 댓글이 없어요.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                <span className="font-semibold">{c.author_name}</span>
                <span className="ml-1 text-brand-500">{c.comment_text}</span>
              </div>
            ))
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
