import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canManageCompany, getCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

type Context = { params: Promise<{ id: string }> };

const memberRoleSchema = z.enum(["ADMIN", "PROJECT_MANAGER", "EXPERT", "CONTROLLER"]);
const addMemberSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: memberRoleSchema,
}).strict();

function memberSelect() {
  return {
    id: true,
    role: true,
    isActive: true,
    joinedAt: true,
    user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
  } as const;
}

async function requireActiveCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, status: true } });
  if (!company) return "NOT_FOUND" as const;
  return company.status === "ACTIVE" ? company : "SUSPENDED" as const;
}

export async function GET(_request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه شرکت نامعتبر است." }, { status: 400 });

  const access = await getCompanyAccess(actor, id);
  if (!access) return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
  if (!canManageCompany(access)) return NextResponse.json({ message: "اجازه مشاهده اعضای شرکت را ندارید." }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      members: {
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
        select: {
          ...memberSelect(),
        },
      },
    },
  });

  if (!company) return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
  return NextResponse.json({ company });
}

export async function POST(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه شرکت نامعتبر است." }, { status: 400 });
  const access = await getCompanyAccess(actor, id);
  if (!access) return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
  if (!canManageCompany(access)) return NextResponse.json({ message: "اجازه مدیریت اعضای شرکت را ندارید." }, { status: 403 });
  const parsed = addMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "اطلاعات عضو معتبر نیست." }, { status: 400 });
  const company = await requireActiveCompany(id);
  if (company === "NOT_FOUND") return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
  if (company === "SUSPENDED") return NextResponse.json({ message: "شرکت تعلیق‌شده است." }, { status: 409 });

  const user = await prisma.user.findFirst({ where: { email: parsed.data.email, isActive: true }, select: { id: true } });
  if (!user) return NextResponse.json({ message: "کاربر فعال با این ایمیل پیدا نشد." }, { status: 404 });
  const existing = await prisma.companyMember.findUnique({ where: { companyId_userId: { companyId: id, userId: user.id } }, select: { isActive: true } });
  if (existing?.isActive) return NextResponse.json({ message: "این کاربر هم‌اکنون عضو فعال شرکت است." }, { status: 409 });

  const member = await prisma.companyMember.upsert({
    where: { companyId_userId: { companyId: id, userId: user.id } },
    update: { role: parsed.data.role, isActive: true },
    create: { companyId: id, userId: user.id, role: parsed.data.role },
    select: memberSelect(),
  });
  return NextResponse.json({ success: true, member, message: "عضو به شرکت اضافه شد." }, { status: 201 });
}
