
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

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
    <main id="main-content" className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <Suspense fallback={<Loading />}>
          <SprintsContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function SprintsContent({ params }: Props) {
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
      companyId: true,
      members: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              companyMemberships: {
                where: { isActive: true },
                select: { companyId: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  return (
    <SprintsManager
      projectId={project.id}
      members={project.members.map((member) => ({
        role: member.role,
        user: {
          id: member.user.id,
          name: member.user.name,
          role: member.user.role,
          companyRole: member.user.companyMemberships.find(
            (membership) => membership.companyId === project.companyId,
          )?.role ?? null,
        },
      }))}
      canManage={access.canManage}
      canDelete={access.canManage}
      view="SPRINTS"
    />
  );
}

function Loading() {
  return (
    <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-slate-500">
      <LoaderCircle
        size={23}
        className="animate-spin text-emerald-600"
      />
      در حال بارگذاری اسپرینت‌ها...
    </div>
  );
}
