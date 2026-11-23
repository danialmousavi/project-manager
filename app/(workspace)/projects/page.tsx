
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
import { pageGuides } from "@/lib/page-guides";

import ProjectsManager from "@/components/projects/projects-manager";
import PageGuide from "@/components/ui/page-guide";

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

  const createCompanies = user.role === "ADMIN"
    ? await prisma.company.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : await prisma.companyMember.findMany({
        where: {
          userId: user.id,
          isActive: true,
          role: { in: ["OWNER", "ADMIN", "PROJECT_MANAGER"] },
          company: { status: "ACTIVE" },
        },
        select: {
          company: {
            select: { id: true, name: true },
          },
        },
        orderBy: { company: { name: "asc" } },
      }).then((memberships) => memberships.map((membership) => membership.company));

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      ...(user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { members: { some: { userId: user.id } } },
              {
                company: {
                  status: "ACTIVE",
                  members: {
                    some: {
                      userId: user.id,
                      isActive: true,
                      role: { in: ["OWNER", "ADMIN"] },
                    },
                  },
                },
              },
            ],
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
      company: {
        select: {
          id: true,
          name: true,
        },
      },

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <FolderKanban size={19} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-lg font-extrabold sm:text-xl">
              مدیریت پروژه‌ها
            </h1>

            <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
              پروژه‌ها، اعضا و پیشرفت واقعی فعالیت‌ها
            </p>
          </div>
        </div>
        <PageGuide guide={pageGuides.projects} />
      </div>

      <ProjectsManager
        initialProjects={serializedProjects}
        canCreate={createCompanies.length > 0}
        createCompanies={createCompanies}
        canFilterByCompany={user.role === "ADMIN"}
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
