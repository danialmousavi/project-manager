import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  canStartOvertime,
  overtimeStartErrorMessage,
} from "@/lib/overtime-policy";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START"), workMode: z.enum(["ONSITE", "REMOTE"]) }).strict(),
  z.object({ action: z.literal("PAUSE") }).strict(),
  z.object({ action: z.literal("RESUME") }).strict(),
  z.object({ action: z.literal("SAVE") }).strict(),
]);

const entrySelect = {
  id: true,
  workMode: true,
  status: true,
  totalSeconds: true,
  startedAt: true,
  savedAt: true,
  segments: {
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, stoppedAt: true },
  },
} as const;

class OvertimeStateError extends Error {}

function unauthenticated() {
  return NextResponse.json({ message: "ابتدا وارد حساب شوید" }, { status: 401 });
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();

  const [draft, history] = await Promise.all([
    prisma.overtimeEntry.findFirst({
      where: { userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
      select: entrySelect,
    }),
    prisma.overtimeEntry.findMany({
      where: { userId: user.id, status: "SAVED" },
      orderBy: { savedAt: "desc" },
      take: 100,
      select: entrySelect,
    }),
  ]);

  return NextResponse.json({ draft, history });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ message: "درخواست نامعتبر است" }, { status: 403 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "عملیات اضافه‌کار نامعتبر است" }, { status: 400 });
  }

  const now = new Date();
  try {
    if (parsed.data.action === "START") {
      const eligibility = canStartOvertime(parsed.data.workMode, now);
      if (!eligibility.allowed) {
        return NextResponse.json({ message: overtimeStartErrorMessage(eligibility.reason) }, { status: 422 });
      }

      const entry = await prisma.overtimeEntry.create({
        data: {
          userId: user.id,
          workMode: parsed.data.workMode,
          startedAt: now,
          segments: { create: { startedAt: now } },
        },
        select: entrySelect,
      });
      return NextResponse.json({ success: true, entry }, { status: 201 });
    }

    if (parsed.data.action === "PAUSE") {
      const entry = await prisma.$transaction(async (tx) => {
        const running = await tx.overtimeEntry.findFirst({
          where: { userId: user.id, status: "RUNNING" },
          select: { id: true },
        });
        if (!running) throw new OvertimeStateError("تایمر فعالی برای توقف وجود ندارد");

        const segment = await tx.overtimeSegment.findFirst({
          where: { entryId: running.id, stoppedAt: null },
          select: { id: true, startedAt: true },
        });
        if (!segment) throw new OvertimeStateError("بازهٔ فعال تایمر پیدا نشد");

        const seconds = Math.max(0, Math.floor((now.getTime() - segment.startedAt.getTime()) / 1000));
        const paused = await tx.overtimeEntry.updateMany({
          where: { id: running.id, status: "RUNNING" },
          data: { status: "PAUSED", totalSeconds: { increment: seconds } },
        });
        if (paused.count === 0) throw new OvertimeStateError("وضعیت تایمر تغییر کرده است");

        await tx.overtimeSegment.update({ where: { id: segment.id }, data: { stoppedAt: now } });
        return tx.overtimeEntry.findUniqueOrThrow({ where: { id: running.id }, select: entrySelect });
      });
      return NextResponse.json({ success: true, entry });
    }

    if (parsed.data.action === "RESUME") {
      const entry = await prisma.$transaction(async (tx) => {
        const paused = await tx.overtimeEntry.findFirst({
          where: { userId: user.id, status: "PAUSED" },
          select: { id: true },
        });
        if (!paused) throw new OvertimeStateError("تایمر متوقف‌شده‌ای برای ادامه وجود ندارد");

        const resumed = await tx.overtimeEntry.updateMany({
          where: { id: paused.id, status: "PAUSED" },
          data: { status: "RUNNING" },
        });
        if (resumed.count === 0) throw new OvertimeStateError("وضعیت تایمر تغییر کرده است");

        await tx.overtimeSegment.create({ data: { entryId: paused.id, startedAt: now } });
        return tx.overtimeEntry.findUniqueOrThrow({ where: { id: paused.id }, select: entrySelect });
      });
      return NextResponse.json({ success: true, entry });
    }

    const saved = await prisma.overtimeEntry.updateMany({
      where: { userId: user.id, status: "PAUSED" },
      data: { status: "SAVED", savedAt: now },
    });
    if (saved.count === 0) {
      return NextResponse.json({ message: "ابتدا تایمر را متوقف کنید، سپس ذخیره کنید" }, { status: 409 });
    }

    const entry = await prisma.overtimeEntry.findFirstOrThrow({
      where: { userId: user.id, status: "SAVED", savedAt: now },
      select: entrySelect,
    });
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    if (error instanceof OvertimeStateError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ message: "یک ثبت اضافه‌کار ذخیره‌نشده دارید" }, { status: 409 });
    }
    console.error("Overtime timer operation failed");
    return NextResponse.json({ message: "عملیات اضافه‌کار انجام نشد" }, { status: 500 });
  }
}
