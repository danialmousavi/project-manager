
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

export default function ProjectDetailsPage({
  params,
}: Props) {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f8fc] px-4 py-8 text-slate-900 sm:px-8"
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
              some: { userId: user.id },
            },
          }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      priority: true,
      progress: true,
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

      progressHistory: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          progress: true,
          note: true,
          createdAt: true,
          updatedBy: {
            select: {
              name: true,
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

  const serializedProject = {
    ...project,
    startDate:
      project.startDate?.toISOString() ?? null,
    dueDate:
      project.dueDate?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    progressHistory:
      project.progressHistory.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
  };

  return (
    <>
      <Link
        href="/projects"
        className="mb-7 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600"
      >
        <ArrowRight size={17} />
        بازگشت به پروژه‌ها
      </Link>

      <ProjectDetails
        project={serializedProject}
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
        className="animate-spin text-indigo-600"
      />
      در حال دریافت پروژه...
    </div>
  );
}
