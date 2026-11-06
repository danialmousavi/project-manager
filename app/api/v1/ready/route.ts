
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      success: true,
      status: "ready",
      database: "connected",
      message: "اتصال به دیتابیس برقرار است",
    });
  } catch {
    console.error("Database connection failed");

    return NextResponse.json(
      {
        success: false,
        status: "not_ready",
        database: "disconnected",
        message: "اتصال به دیتابیس برقرار نیست",
      },
      { status: 503 }
    );
  }
}
