
import { Suspense } from "react";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  LoaderCircle,
} from "lucide-react";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateProjectProgress } from "@/lib/project-progress";
import ProjectDetails from "@/components/projects/project-details";

type Props = {
  params: Promise<{ id: string }>;
};

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

export default function ProjectDetailsPage({
  params,
}: Props) {
  return (
    <main
      id="main-content"
      dir="rtl"
      className="px-4 py-5 text-slate-900 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1440px]">
        <Suspense fallback={<Loading />}>
          <Content params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Content({ params }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
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
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      priority: true,
      startDate: true,
      dueDate: true,
      createdAt: true,

      members: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },

      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
          sprints: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const canManage =
    user.role === "ADMIN" ||
    (
      user.role === "MANAGER" &&
      project.members.some(
        (member) =>
          member.user.id === user.id &&
          member.role === "MANAGER"
      )
    );

  // Count ALL project tasks regardless of the viewer's role
  // or the sprint each task belongs to.
  const groupedTasks = await prisma.task.groupBy({
    by: ["status"],
    where: {
      projectId: project.id,
      deletedAt: null,
    },
    _count: {
      _all: true,
    },
  });

  const taskStats = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };

  for (const group of groupedTasks) {
    const status = group.status as TaskStatus;

    if (Object.prototype.hasOwnProperty.call(
      taskStats,
      status
    )) {
      taskStats[status] = group._count._all;
    }
  }

  const automaticProgress = calculateProjectProgress(
    Object.entries(taskStats).map(([status, count]) => ({
      status: status as TaskStatus,
      count,
    }))
  );

  const serializedProject = {
    ...project,
    progress: automaticProgress,
    startDate:
      project.startDate?.toISOString() ?? null,
    dueDate:
      project.dueDate?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
  };

  return (
    <>
      <ProjectDetails
        project={serializedProject}
        taskStats={taskStats}
        canEdit={canManage}
        actorRole={user.role}
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
      در حال دریافت پروژه...
    </div>
  );
}
