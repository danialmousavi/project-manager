import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import WorkspaceShell from "@/components/layout/workspace-shell";
import { prisma } from "@/lib/prisma";
import { canViewAllProjects } from "@/lib/role-access";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-16 border-b border-[var(--border)] bg-white" />}>
      <WorkspaceContent>{children}</WorkspaceContent>
    </Suspense>
  );
}

async function WorkspaceContent({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [projects, initialUnreadCount] = await Promise.all([
    prisma.project.findMany({
      where: {
        archivedAt: null,
        ...(canViewAllProjects(user.role)
          ? {}
          : { members: { some: { userId: user.id } } }),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 100,
    }),
    prisma.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ]);

  return (
    <WorkspaceShell
      user={{ name: user.name, role: user.role }}
      projects={projects}
      initialUnreadCount={initialUnreadCount}
    >
      {children}
    </WorkspaceShell>
  );
}
