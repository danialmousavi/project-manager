import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateProjectProgress, type TaskStatusCount } from "@/lib/project-progress";
import { TASK_CHANGE_PREFIX } from "@/lib/task-change-history";
import { ASSIGNMENT_PREFIX } from "@/lib/task-assignment-history";
import { canViewAllProjects, type AppRole } from "@/lib/role-access";

type DashboardActor = { id: string; role: AppRole };

function todayInTehran() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00.000Z`);
}

export async function getDashboardData(actor: DashboardActor) {
  const today = todayInTehran();
  const tomorrow = new Date(today.getTime() + 86400000);
  const nextWeek = new Date(today.getTime() + 7 * 86400000);

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      ...(canViewAllProjects(actor.role) ? {} : { members: { some: { userId: actor.id } } }),
    },
    select: {
      id: true,
      name: true,
      status: true,
      priority: true,
      dueDate: true,
      members: { where: { userId: actor.id }, select: { role: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const ids = projects.map((project) => project.id);
  const managedIds = actor.role === "ADMIN"
    ? ids
    : projects.filter((project) =>
      (actor.role === "MANAGER" && project.members.some((member) => member.role === "MANAGER")) ||
      actor.role === "CONTROLLER"
    ).map((project) => project.id);

  // The task-level permission matches the existing task API: admins and
  // project managers see team work; other members see their assignments.
  const taskWhere: Prisma.TaskWhereInput = {
    projectId: { in: ids },
    deletedAt: null,
    project: { archivedAt: null },
    ...(canViewAllProjects(actor.role) ? {} : {
      OR: [
        { projectId: { in: managedIds } },
        { assigneeId: actor.id },
      ],
    }),
  };
  const openWhere: Prisma.TaskWhereInput = { ...taskWhere, status: { not: "DONE" } };

  const [
    groupedProgress,
    groupedOverdue,
    openTasks,
    overdueTasks,
    dueSoonTasks,
    reviewTasks,
    myTasks,
    upcomingTasks,
    comments,
    workload,
    overdueWorkload,
  ] = await Promise.all([
    prisma.task.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: ids }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { ...openWhere, dueDate: { lt: today } },
      _count: { _all: true },
    }),
    prisma.task.count({ where: openWhere }),
    prisma.task.count({ where: { ...openWhere, dueDate: { lt: today } } }),
    prisma.task.count({ where: { ...openWhere, dueDate: { gte: today, lt: nextWeek } } }),
    prisma.task.count({ where: { ...taskWhere, status: "IN_REVIEW" } }),
    prisma.task.findMany({
      where: { ...openWhere, assigneeId: actor.id },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, projectId: true, project: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.task.findMany({
      where: { ...openWhere, dueDate: { not: null } },
      select: { id: true, title: true, startDate: true, dueDate: true, projectId: true, project: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    prisma.taskComment.findMany({
      where: { task: taskWhere, AND: [
        { content: { not: { startsWith: TASK_CHANGE_PREFIX } } },
        { content: { not: { startsWith: ASSIGNMENT_PREFIX } } },
      ] },
      select: { id: true, content: true, createdAt: true, author: { select: { name: true } }, task: { select: { id: true, title: true, projectId: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    actor.role === "EMPLOYEE" ? Promise.resolve([]) : prisma.task.groupBy({
      by: ["assigneeId"],
      where: { projectId: { in: managedIds }, deletedAt: null, status: { not: "DONE" } },
      _count: { _all: true },
    }),
    actor.role === "EMPLOYEE" ? Promise.resolve([]) : prisma.task.groupBy({
      by: ["assigneeId"],
      where: { projectId: { in: managedIds }, deletedAt: null, status: { not: "DONE" }, dueDate: { lt: today } },
      _count: { _all: true },
    }),
  ]);

  const progressById = new Map<string, TaskStatusCount[]>();
  for (const group of groupedProgress) {
    const counts = progressById.get(group.projectId) ?? [];
    counts.push({ status: group.status, count: group._count._all });
    progressById.set(group.projectId, counts);
  }
  const overdueById = new Map(groupedOverdue.map((group) => [group.projectId, group._count._all]));
  const totalByAssignee = new Map(workload.map((group) => [group.assigneeId, group._count._all]));
  const overdueByAssignee = new Map(overdueWorkload.map((group) => [group.assigneeId, group._count._all]));
  const teamIds = Array.from(totalByAssignee.keys()).filter((id): id is string => id !== null);
  const team = teamIds.length ? await prisma.user.findMany({
    where: { id: { in: teamIds } }, select: { id: true, name: true },
  }) : [];
  const names = new Map(team.map((member) => [member.id, member.name]));

  return {
    today,
    tomorrow,
    metrics: { projects: projects.length, openTasks, overdueTasks, dueSoonTasks, reviewTasks },
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      dueDate: project.dueDate,
      progress: calculateProjectProgress(progressById.get(project.id) ?? []),
      overdue: overdueById.get(project.id) ?? 0,
    })).sort((a, b) => b.overdue - a.overdue || (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)).slice(0, 6),
    myTasks,
    upcomingTasks,
    comments,
    workload: Array.from(totalByAssignee, ([id, count]) => ({
      id,
      name: id ? names.get(id) ?? "کاربر" : "بدون مسئول",
      count,
      overdue: overdueByAssignee.get(id) ?? 0,
    })).sort((a, b) => b.count - a.count).slice(0, 6),
  };
}
