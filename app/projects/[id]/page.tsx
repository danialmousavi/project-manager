
import { Suspense } from "react";
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProjectDetails from "@/components/projects/project-details";

type Props = {
  params: Promise<{ id: string }>;
};

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

export default function ProjectDetailsPage({
  params,
}: Props) {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7fcf9] px-4 py-8 text-slate-900 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
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
          tasks: true,
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

  const totalTasks =
    taskStats.TODO +
    taskStats.IN_PROGRESS +
    taskStats.IN_REVIEW +
    taskStats.DONE;

  const weightedProgress =
    taskStats.TODO * taskWeights.TODO +
    taskStats.IN_PROGRESS *
      taskWeights.IN_PROGRESS +
    taskStats.IN_REVIEW *
      taskWeights.IN_REVIEW +
    taskStats.DONE * taskWeights.DONE;

  const automaticProgress =
    totalTasks === 0
      ? 0
      : Math.round(weightedProgress / totalTasks);

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
      <Link
        href="/projects"
        className="mb-7 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600"
      >
        <ArrowRight size={17} />
        بازگشت به پروژه‌ها
      </Link>

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
