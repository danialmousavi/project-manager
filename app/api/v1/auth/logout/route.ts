
import { NextRequest, NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (
    !request.headers.get("origin") ||
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
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
