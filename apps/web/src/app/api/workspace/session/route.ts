import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/app-user";

export async function GET() {
  return NextResponse.json({ user: await getCurrentUser() });
}
