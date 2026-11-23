
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";

type Context = {
  params: Promise<{ id: string }>;
};

const statusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "PLANNED",
    "ACTIVE",
    "ON_HOLD",
    "COMPLETED",
    "CANCELLED",
  ]),
}).strict();

const adminSchema = statusSchema.extend({
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().max(3000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  startDate: z.iso.date().nullable(),
  dueDate: z.iso.date().nullable(),
}).strict();

function toDate(value: string | null) {
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
      { message: "ابتدا وارد حساب شوید." },
      { status: 401 }
    );
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه پروژه نامعتبر است." },
      { status: 400 }
    );
  }

  const access = await getTaskProjectAccess(actor, id);

  if (!access?.canChangeStatus) {
    return NextResponse.json(
      { message: "دسترسی به این پروژه مجاز نیست." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!access.canManageSettings) {
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message:
            "مدیر پروژه فقط می‌تواند وضعیت پروژه را تغییر دهد.",
        },
        { status: 403 }
      );
    }

    const result = await prisma.project.updateMany({
      where: {
        id,
        archivedAt: null,
      },
      data: {
        status: parsed.data.status,
      },
    });

    return NextResponse.json(
      {
        success: result.count === 1,
        message:
          result.count === 1
            ? "وضعیت پروژه ثبت شد."
            : "دسترسی مجاز نیست.",
      },
      { status: result.count === 1 ? 200 : 403 }
    );
  }

  const parsed = adminSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات پروژه معتبر نیست." },
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
          "تاریخ پایان نمی‌تواند قبل از شروع باشد.",
      },
      { status: 400 }
    );
  }

  const result = await prisma.project.updateMany({
    where: {
      id,
      archivedAt: null,
    },
    data: {
      name: data.name,
      description: data.description || null,
      priority: data.priority,
      status: data.status,
      startDate: toDate(data.startDate),
      dueDate: toDate(data.dueDate),
    },
  });

  return NextResponse.json(
    {
      success: result.count === 1,
      message:
        result.count === 1
          ? "اطلاعات پروژه ذخیره شد."
          : "پروژه یافت نشد.",
    },
    { status: result.count === 1 ? 200 : 404 }
  );
}
