import { NextResponse } from "next/server";
import { prisma } from "@formflow/db";
import { formDefinitionSchema } from "@formflow/validation";
import { createSlug, jsonError } from "@/lib/http";
import { getCurrentUser } from "@/lib/app-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to view your forms.", 401);
  const forms = await prisma.form.findMany({ where: { ownerId: user.id }, include: { _count: { select: { submissions: true, fields: true } } }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ forms });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to create a form.", 401);
  const parsed = formDefinitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Add a title and valid fields to your form.", 400);
  const form = await prisma.form.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      limitOneResponsePerEmail: parsed.data.limitOneResponsePerEmail,
      slug: createSlug(),
      ownerId: user.id,
      fields: { create: parsed.data.fields.map((field, position) => ({ type: field.type, label: field.label, helpText: field.helpText, required: field.required, position, options: field.options, validation: field.validation })) }
    }
  });
  return NextResponse.json({ form }, { status: 201 });
}
