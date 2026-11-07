
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import {
  ListTodo,
  LoaderCircle,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import ProjectTasks from "@/components/tasks/project-tasks";

type Props = {
  params: Promise<{ id: string }>;
};

export default function TasksPage({ params }: Props) {
  return (
    <main id="main-content" className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <Suspense fallback={<Loading />}>
          <TasksContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function TasksContent({ params }: Props) {
  const actor = await getCurrentUser();

  if (!actor) redirect("/login");

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const access = await getTaskProjectAccess(actor, id);

  if (!access) notFound();

  const project = await prisma.project.findFirst({
    where: {
      id,
      archivedAt: null,
    },
    select: {
      id: true,
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
    },
  });

  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListTodo size={19} className="text-emerald-700" aria-hidden="true" />
        <h2 className="text-lg font-extrabold">وظایف پروژه</h2>
        <span className="text-xs text-[var(--muted)]">برنامه‌ریزی و پیگیری کارها</span>
      </div>

      <ProjectTasks
        projectId={project.id}
        members={project.members}
        canManage={access.canManage}
        actorRole={actor.role}
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-slate-500">
      <LoaderCircle
        size={23}
        className="animate-spin text-emerald-600"
      />
      در حال بارگذاری وظایف...
    </div>
  );
}
