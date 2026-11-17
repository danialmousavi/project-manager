import "server-only";

import { createNotificationsForUsers } from "@/lib/notifications";

type ProjectMemberAddedInput = {
  projectId: string;
  projectName: string;
  recipientIds: Iterable<string>;
  actorId: string;
};

export async function notifyProjectMembersAdded(input: ProjectMemberAddedInput) {
  try {
    await createNotificationsForUsers(input.recipientIds, {
      actorId: input.actorId,
      type: "PROJECT_MEMBER_ADDED",
      title: "به پروژه اضافه شدید",
      body: `شما به پروژه «${input.projectName}» اضافه شدید.`,
      href: `/projects/${input.projectId}`,
      projectId: input.projectId,
      dedupeKey: `project-member-added:${input.projectId}`,
    });
  } catch (error) {
    console.error("Create project-member notification:", error);
  }
}
