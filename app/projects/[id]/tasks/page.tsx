
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
    <main className="px-4 py-7 sm:px-8">
      <div className="mx-auto max-w-6xl">
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
      name: true,
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
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ListTodo size={27} />
          </div>

          <div>
            <p className="text-xs font-semibold text-emerald-600">
              فضای کاری پروژه
            </p>

            <h1 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              وظایف {project.name}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              برنامه‌ریزی، واگذاری و پیگیری فعالیت‌ها
            </p>
          </div>
        </div>
      </header>

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
