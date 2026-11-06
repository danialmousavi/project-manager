
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarRange,
  LoaderCircle,
} from "lucide-react";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import SprintsManager from "@/components/sprints/sprints-manager";

type Props = {
  params: Promise<{ id: string }>;
};

export default function ProjectSprintsPage({
  params,
}: Props) {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f8fc] px-4 py-8 text-slate-900 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<Loading />}>
          <SprintsContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function SprintsContent({ params }: Props) {
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
    where: { id },
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
      <Link
        href={`/projects/${project.id}`}
        className="mb-7 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600"
      >
        <ArrowRight size={17} />
        بازگشت به جزئیات پروژه
      </Link>

      <header className="mb-8 flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <CalendarRange size={27} />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            مدیریت اسپرینت‌ها
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            پروژه: {project.name}
          </p>
        </div>
      </header>

      <SprintsManager
        projectId={project.id}
        canManage={access.canManage}
        canDelete={actor.role === "ADMIN"}
      />
    </>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-slate-500">
      <LoaderCircle
        size={24}
        className="animate-spin text-indigo-600"
      />
      در حال بارگذاری اسپرینت‌ها...
    </div>
  );
}
