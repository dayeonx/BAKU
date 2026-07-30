"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/FormField";
import DepartmentTaskSummary from "@/components/DepartmentTaskSummary";
import type { Project, TaskStep } from "./shared";

export default function AdminTasksPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isOfficer, setIsOfficer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Pick<TaskStep, "id" | "project_id" | "status">[]>([]);
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

    if (officer) {
      const [{ data: projectRows }, { data: taskRows }] = await Promise.all([
        supabase.from("work_projects").select("id, title, created_at").order("created_at", { ascending: true }),
        supabase.from("work_tasks").select("id, project_id, status"),
      ]);
      setProjects(projectRows ?? []);
      setTasks(taskRows ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateProject() {
    if (!newProjectTitle.trim() || !userId) return;
    await supabase.from("work_projects").insert({ title: newProjectTitle.trim(), created_by: userId });
    setNewProjectTitle("");
    setShowNewProject(false);
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-700">부서별 업무</h1>

      <div className="mt-6">
        <DepartmentTaskSummary
          onSelectTask={(taskId, projectId) =>
            router.push(projectId ? `/admin/tasks/${projectId}?task=${taskId}` : "/admin/tasks")
          }
        />
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

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {projects.length === 0 ? (
            <p className="text-sm text-brand-300">등록된 프로젝트가 없어요.</p>
          ) : (
            projects.map((project) => {
              const projectTasks = tasks.filter((t) => t.project_id === project.id);
              const doneCount = projectTasks.filter((t) => t.status === "done").length;
              return (
                <Link
                  key={project.id}
                  href={`/admin/tasks/${project.id}`}
                  className="rounded-2xl border border-brand-100 bg-white p-4 transition-colors hover:border-accent-500 hover:bg-brand-50"
                >
                  <h3 className="text-base font-bold text-brand-700">{project.title}</h3>
                  <p className="mt-1 text-xs text-brand-500">
                    {projectTasks.length === 0
                      ? "등록된 업무 단계가 없어요"
                      : `${doneCount}/${projectTasks.length}단계 완료`}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
