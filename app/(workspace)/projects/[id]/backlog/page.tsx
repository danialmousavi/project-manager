import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import BacklogBoard from "@/components/backlog/backlog-board";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

type Props = { params: Promise<{ id: string }> };

export default function BacklogPage({ params }: Props) {
  return (
    <main id="main-content" className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <Suspense fallback={<div className="min-h-64" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Content({ params }: Props) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  if (!(await getTaskProjectAccess(actor, id))) notFound();

  const project = await prisma.project.findFirst({
    where: { id, archivedAt: null },
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

  const assignees = project.members
    .map((member) => ({
      role: member.role,
      user: {
        id: member.user.id,
        name: member.user.name,
        role: member.user.role,
        companyRole: member.user.companyMemberships.find(
          (membership) => membership.companyId === project.companyId,
        )?.role ?? null,
      },
    }))
    .filter((member) =>
      (member.role === "MANAGER" && member.user.companyRole === "PROJECT_MANAGER") ||
      (member.role === "MEMBER" && member.user.companyRole === "EXPERT"),
    );

  return <BacklogBoard projectId={id} eligibleAssignees={assignees} />;
}
