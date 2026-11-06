
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canEditProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ id: string }>;
};

const dateSchema = z.union([
  z.iso.date(),
  z.null(),
]);

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(3).max(150),
    description: z.string().trim().max(3000),
    status: z.enum([
      "DRAFT",
      "PLANNED",
      "ACTIVE",
      "ON_HOLD",
      "COMPLETED",
      "CANCELLED",
    ]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    startDate: dateSchema,
    dueDate: dateSchema,
  })
  .strict();

function toDatabaseDate(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
    );
  }

  if (
    !request.headers.get("origin") ||
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه پروژه نامعتبر است" },
      { status: 400 }
    );
  }

  if (!(await canEditProject(actor, id))) {
    return NextResponse.json(
      { message: "اجازه ویرایش این پروژه را ندارید" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.issues[0]?.message ||
          "اطلاعات پروژه معتبر نیست",
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (
    data.startDate &&
    data.dueDate &&
    data.startDate > data.dueDate
  ) {
    return NextResponse.json(
      {
        message:
          "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد",
      },
      { status: 400 }
    );
  }

  try {
    await prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        startDate: toDatabaseDate(data.startDate),
        dueDate: toDatabaseDate(data.dueDate),
      },
    });

    return NextResponse.json({
      success: true,
      message: "اطلاعات پروژه ذخیره شد",
    });
  } catch {
    return NextResponse.json(
      { message: "خطا در ذخیره پروژه" },
      { status: 500 }
    );
  }
}
