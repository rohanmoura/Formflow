import { NextResponse } from "next/server";
import { FormStatus, prisma } from "@formflow/db";
import { jsonError } from "@/lib/http";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const form = await prisma.form.findFirst({ where: { slug, status: FormStatus.PUBLISHED }, select: { id: true, title: true, description: true, limitOneResponsePerEmail: true, fields: { orderBy: { position: "asc" }, select: { id: true, type: true, label: true, helpText: true, required: true, position: true, options: true, validation: true } } } });
  if (!form) return jsonError("This form is unavailable.", 404);
  return NextResponse.json({ form });
}
