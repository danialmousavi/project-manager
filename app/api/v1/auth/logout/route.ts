
import { NextRequest, NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/security/origin";

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است" },
      { status: 403 }
    );
  }

  await deleteCurrentSession();

  return NextResponse.json({
    success: true,
    message: "با موفقیت خارج شدید",
  });
}
