"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/FormField";
import {
  AssigneePicker,
  CompleteToggle,
  TaskDetailPanel,
  assigneeLabel,
  statusClass,
  statusLabel,
  toDateKey,
  type Project,
  type TaskStep,
} from "../shared";

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>}>
      <ProjectDetailPageInner />
    </Suspense>
  );
}

function ProjectDetailPageInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [myDepartment, setMyDepartment] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

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
      const [{ data: projectRow }, { data: taskRows }] = await Promise.all([
        supabase.from("work_projects").select("id, title, created_at").eq("id", projectId).single(),
        supabase
          .from("work_tasks")
          .select("id, project_id, step_order, assignees, title, description, requirements, status, due_date")
          .eq("project_id", projectId)
          .order("step_order", { ascending: true }),
      ]);
      setProject(projectRow ?? null);
      setSteps(taskRows ?? []);
    }

    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (taskParam) setSelectedTaskId(taskParam);
  }, [searchParams]);

  async function handleAddStep() {
    if (!title.trim() || !userId) return;
    setSaving(true);
    const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.step_order)) + 1 : 1;
    await supabase.from("work_tasks").insert({
      project_id: projectId,
      step_order: nextOrder,
      assignees,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      created_by: userId,
    });
    setSaving(false);
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignees([]);
    setShowForm(false);
    load();
  }

  async function handleDeleteProject() {
    await supabase.from("work_projects").delete().eq("id", projectId);
    router.push("/admin/tasks");
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-brand-500">불러오는 중...</div>;
  }

  if (!isOfficer || !userId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-brand-500">
        임원진만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-brand-500">존재하지 않는 프로젝트예요.</div>
    );
  }

  const orderedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
  const todayKey = toDateKey(new Date());
  const selectedStep = orderedSteps.find((s) => s.id === selectedTaskId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/tasks" className="text-sm text-brand-500 hover:underline">
        ← 프로젝트 목록으로
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-700">{project.title}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-200"
          >
            + 업무 단계 추가
          </button>
          <button onClick={handleDeleteProject} className="text-xs text-brand-300 hover:text-red-600">
            프로젝트 삭제
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-4 space-y-2 rounded-xl border border-brand-100 bg-white p-4">
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
          <AssigneePicker value={assignees} onChange={setAssignees} />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
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
        <p className="mt-6 text-sm text-brand-300">등록된 업무 단계가 없어요.</p>
      ) : (
        <div className="mt-6 flex gap-4">
          <ol className={`space-y-2 ${selectedStep ? "w-1/2 shrink-0" : "flex-1"}`}>
            {orderedSteps.map((step) => {
              const overdue = !!step.due_date && step.due_date < todayKey && step.status !== "done";
              const active = step.id === selectedTaskId;
              return (
                <li
                  key={step.id}
                  onClick={() => setSelectedTaskId(step.id)}
                  className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    active ? "border-accent-500 bg-accent-50" : "border-brand-100 bg-white hover:bg-brand-50"
                  }`}
                >
                  <CompleteToggle task={step} myDepartment={myDepartment} supabase={supabase} onDone={load} />
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                    {step.step_order}
                  </span>
                  <span className="font-semibold text-brand-700">{step.title}</span>
                  {step.assignees.map((a) => (
                    <span key={a} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-500">
                      {assigneeLabel(a)}
                    </span>
                  ))}
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
            <div className="w-1/2 rounded-2xl border border-brand-100 bg-white p-4">
              <TaskDetailPanel
                key={selectedStep.id}
                task={selectedStep}
                userId={userId}
                myDepartment={myDepartment}
                supabase={supabase}
                onDone={load}
                onClose={() => setSelectedTaskId(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
