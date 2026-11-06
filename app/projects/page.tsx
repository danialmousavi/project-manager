
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ArrowRight,
  FolderKanban,
  LoaderCircle,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import ProjectsManager from "@/components/projects/projects-manager";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

const taskWeights: Record<TaskStatus, number> = {
  TODO: 0,
  IN_PROGRESS: 50,
  IN_REVIEW: 90,
  DONE: 100,
};

type ProgressAccumulator = {
  total: number;
  weightedSum: number;
};

export default function ProjectsPage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7fcf9] px-4 py-8 text-slate-900 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
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

  const progressByProject = new Map<
    string,
    ProgressAccumulator
  >();

  // Initialize every project with zero progress.
  for (const projectId of projectIds) {
    progressByProject.set(projectId, {
      total: 0,
      weightedSum: 0,
    });
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
      },

      _count: {
        _all: true,
      },
    });

    for (const group of groupedTasks) {
      const status = group.status as TaskStatus;

      if (
        !Object.prototype.hasOwnProperty.call(
          taskWeights,
          status
        )
      ) {
        continue;
      }

      const current = progressByProject.get(
        group.projectId
      );

      if (!current) {
        continue;
      }

      const count = group._count._all;

      current.total += count;

      current.weightedSum +=
        count * taskWeights[status];
    }
  }

  const serializedProjects = projects.map(
    (project) => {
      const stats = progressByProject.get(
        project.id
      );

      const progress =
        stats && stats.total > 0
          ? Math.round(
              stats.weightedSum / stats.total
            )
          : 0;

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
      <Link
        href="/dashboard"
        className="mb-7 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600"
      >
        <ArrowRight size={17} />
        بازگشت به داشبورد
      </Link>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
          <FolderKanban size={27} />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            مدیریت پروژه‌ها
          </h1>

          <p className="mt-2 text-sm text-slate-500">
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
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-slate-500">
      <LoaderCircle
        size={24}
        className="animate-spin text-emerald-600"
      />
      در حال دریافت پروژه‌ها...
    </div>
  );
}
