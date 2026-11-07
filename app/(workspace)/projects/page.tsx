
import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  FolderKanban,
  LoaderCircle,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateProjectProgress,
  type TaskStatusCount,
} from "@/lib/project-progress";

import ProjectsManager from "@/components/projects/projects-manager";

export default function ProjectsPage() {
  return (
    <main
      id="main-content"
      dir="rtl"
      className="min-h-dvh bg-[var(--background)] px-4 py-5 text-slate-900 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1440px]">
        <Suspense fallback={<Loading />}>
          <ProjectsContent />
        </Suspense>
      </div>
    </main>
  );
}

async function ProjectsContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      ...(user.role === "ADMIN"
        ? {}
        : {
            members: {
              some: {
                userId: user.id,
              },
            },
          }),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,

      members: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const projectIds = projects.map(
    (project) => project.id
  );

  const progressByProject = new Map<string, TaskStatusCount[]>();

  // Initialize every project with zero progress.
  for (const projectId of projectIds) {
    progressByProject.set(projectId, []);
  }

  // Read only grouped task counts.
  // No need to load every task into memory.
  if (projectIds.length > 0) {
    const groupedTasks = await prisma.task.groupBy({
      by: ["projectId", "status"],

      where: {
        projectId: {
          in: projectIds,
        },
        deletedAt: null,
      },

      _count: {
        _all: true,
      },
    });

    for (const group of groupedTasks) {
      const current = progressByProject.get(
        group.projectId
      );

      if (!current) {
        continue;
      }

      current.push({
        status: group.status,
        count: group._count._all,
      });
    }
  }

  const serializedProjects = projects.map(
    (project) => {
      const progress = calculateProjectProgress(
        progressByProject.get(project.id) ?? []
      );

      return {
        ...project,

        // Real progress calculated from Task statuses.
        // This replaces the old manual Project.progress.
        progress,

        createdAt:
          project.createdAt.toISOString(),
      };
    }
  );

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <FolderKanban size={21} aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">
            مدیریت پروژه‌ها
          </h1>

          <p className="mt-0.5 text-sm text-[var(--muted)]">
            پروژه‌ها، اعضا و پیشرفت واقعی فعالیت‌ها
          </p>
        </div>
      </div>

      <ProjectsManager
        initialProjects={serializedProjects}
        canCreate={user.role === "ADMIN"}
      />
    </>
  );
}

function Loading() {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-[var(--muted)]">
      <LoaderCircle
        size={24}
        className="animate-spin text-emerald-600"
      />
      در حال دریافت پروژه‌ها...
    </div>
  );
}
