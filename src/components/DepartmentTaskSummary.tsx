"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { departmentLabel } from "@/lib/departments";

type SummaryTask = {
  id: string;
  project_id: string | null;
  assignees: string[];
  title: string;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function compareDue(a: SummaryTask, b: SummaryTask): number {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return 0;
}

export default function DepartmentTaskSummary({
  onSelectTask,
}: {
  onSelectTask: (taskId: string, projectId: string | null) => void;
}) {
  const supabase = createClient();
  const [myDepartment, setMyDepartment] = useState<string | null>(null);
  const [tasks, setTasks] = useState<SummaryTask[]>([]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("department")
      .eq("id", userData.user.id)
      .single();
    setMyDepartment(myProfile?.department ?? null);

    const { data: taskRows } = await supabase
      .from("work_tasks")
      .select("id, project_id, assignees, title, status, due_date")
      .order("step_order", { ascending: true });
    setTasks(taskRows ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const todayKey = toDateKey(new Date());

  if (!myDepartment) return null;

  const deptTasks = tasks.filter((t) => t.assignees.includes(myDepartment) && t.status !== "done").sort(compareDue);

  return (
    <div className="max-w-sm rounded-2xl border border-brand-100 bg-brand-50/50 p-3">
      <h2 className="text-sm font-bold text-brand-700">
        {departmentLabel(myDepartment)} 업무 <span className="font-normal text-brand-300">({deptTasks.length})</span>
      </h2>
      <div className="mt-2 space-y-1.5">
        {deptTasks.length === 0 ? (
          <p className="px-0.5 text-xs text-brand-300">급한 업무가 없어요.</p>
        ) : (
          deptTasks.map((t) => {
            const overdue = !!t.due_date && t.due_date < todayKey;
            return (
              <div
                key={t.id}
                onClick={() => onSelectTask(t.id, t.project_id)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-1.5 py-1.5 text-xs hover:bg-brand-100"
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
}

function CompleteToggle({
  task,
  myDepartment,
  supabase,
  onDone,
}: {
  task: SummaryTask;
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
