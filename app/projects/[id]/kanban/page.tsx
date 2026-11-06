
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  ArrowRight,
  LoaderCircle,
  Layers3,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

import KanbanBoard from "@/components/kanban/kanban-board";

type Props = {
  params: Promise<{ id: string }>;
};

export default function KanbanPage({ params }: Props) {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f8fc] px-4 py-8 text-slate-900 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1600px]">
        <Suspense fallback={<KanbanLoading />}>
          <KanbanContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function KanbanContent({ params }: Props) {
  const actor = await getCurrentUser();

  if (!actor) {
    redirect("/login");
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const access = await getTaskProjectAccess(
    actor,
    id
  );

  if (!access) {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
        >
          <ArrowRight size={17} />
          بازگشت به جزئیات پروژه
        </Link>
      </div>

      <KanbanBoard
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}

function KanbanLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Layers3 size={24} />
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            برد کانبان
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            در حال دریافت اطلاعات پروژه...
          </p>
        </div>
      </div>

      <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle
            size={30}
            className="animate-spin text-indigo-600"
          />

          <p className="text-sm text-slate-500">
            در حال بارگذاری برد کانبان...
          </p>
        </div>
      </div>
    </div>
  );
}
