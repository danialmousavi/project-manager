
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import ProjectWorkspaceNav from "@/components/projects/project-workspace-nav";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllProjects } from "@/lib/role-access";

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default function ProjectWorkspaceLayout({
  children,
  params,
}: Props) {
  return (
    <div dir="rtl" className="min-h-dvh bg-[var(--background)]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-8">
            <div className="h-28 animate-pulse rounded-2xl bg-white" />
          </div>
        }
      >
        <WorkspaceNavigation params={params} />
      </Suspense>

      {children}
    </div>
  );
}

async function WorkspaceNavigation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) notFound();
  const project = await prisma.project.findFirst({
    where: {
      id,
      archivedAt: null,
      ...(canViewAllProjects(user.role) ? {} : { members: { some: { userId: user.id } } }),
    },
    select: { name: true },
  });
  if (!project) notFound();
  return <ProjectWorkspaceNav projectId={id} projectName={project.name} />;
}
