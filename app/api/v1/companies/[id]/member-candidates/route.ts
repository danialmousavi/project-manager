import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canManageCompany, getCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه شرکت نامعتبر است." }, { status: 400 });
  const access = await getCompanyAccess(actor, id);
  if (!access) return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
  if (!canManageCompany(access)) return NextResponse.json({ message: "اجازه جست‌وجوی کاربران را ندارید." }, { status: 403 });

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }],
      companyMemberships: { none: { companyId: id, isActive: true } },
    },
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json({ users });
}
