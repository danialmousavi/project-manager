import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getTaskProjectAccess } from "@/lib/task-access";
import Letters from "@/components/letters/letters";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !(await getTaskProjectAccess(actor, id))) notFound();
  return <Letters projectId={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <main id="main-content" className="mx-auto max-w-6xl p-4 sm:p-6"><Suspense fallback={<p>در حال بارگذاری...</p>}><Content params={params} /></Suspense></main>;
}
