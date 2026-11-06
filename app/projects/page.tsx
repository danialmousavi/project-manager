
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

export default function ProjectsPage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f8fc] px-4 py-8 text-slate-900 sm:px-8"
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
      progress: true,
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

  return (
    <>
      <Link
        href="/dashboard"
        className="mb-7 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600"
      >
        <ArrowRight size={17} />
        بازگشت به داشبورد
      </Link>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <FolderKanban size={27} />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            مدیریت پروژه‌ها
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            پروژه‌ها، اعضا و پیشرفت فعالیت‌ها
          </p>
        </div>
      </div>

      <ProjectsManager
        initialProjects={projects.map((project) => ({
          ...project,
          createdAt: project.createdAt.toISOString(),
        }))}
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
        className="animate-spin text-indigo-600"
      />
      در حال دریافت پروژه‌ها...
    </div>
  );
}
