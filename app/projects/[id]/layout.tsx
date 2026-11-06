
import { Suspense, type ReactNode } from "react";
import ProjectWorkspaceNav from "@/components/projects/project-workspace-nav";

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default function ProjectWorkspaceLayout({
  children,
  params,
}: Props) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f7fcf9]"
    >
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8">
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

  return <ProjectWorkspaceNav projectId={id} />;
}
