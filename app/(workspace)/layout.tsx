import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import WorkspaceShell from "@/components/layout/workspace-shell";
import { canManageCompanyRole } from "@/lib/access-policy";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess } from "@/lib/workspace-access";

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

  const workspaceAccess = await getWorkspaceAccess(user);

  const [projects, initialUnreadCount] = await Promise.all([
    prisma.project.findMany({
      where: {
        archivedAt: null,
        ...(user.role === "ADMIN"
          ? {}
          : {
              OR: [
                { members: { some: { userId: user.id } } },
                {
                  company: {
                    status: "ACTIVE",
                    members: {
                      some: {
                        userId: user.id,
                        isActive: true,
                        role: { in: ["OWNER", "ADMIN"] },
                      },
                    },
                  },
                },
              ],
            }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        company: { select: { id: true, name: true } },
      },
      take: 100,
    }),
    prisma.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ]);

  return (
    <WorkspaceShell
      user={{
        name: user.name,
        roleLabel: workspaceAccess.primaryRoleLabel,
        isPlatformAdmin: workspaceAccess.isPlatformAdmin,
        manageableCompanies: workspaceAccess.companyMemberships
          .filter((membership) => canManageCompanyRole(membership.role))
          .map((membership) => ({
            id: membership.companyId,
            name: membership.companyName,
          })),
      }}
      projects={projects}
      initialUnreadCount={initialUnreadCount}
    >
      {children}
    </WorkspaceShell>
  );
}
