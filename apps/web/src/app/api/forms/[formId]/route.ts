import { NextResponse } from "next/server";
import { FormStatus, prisma } from "@formflow/db";
import { formDefinitionSchema } from "@formflow/validation";
import { isTransactionConflict, jsonError } from "@/lib/http";
import { getCurrentUser } from "@/lib/app-user";

type Context = { params: Promise<{ formId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to view this form.", 401);
  const { formId } = await params;
  const form = await prisma.form.findFirst({ where: { id: formId, ownerId: user.id }, include: { fields: { orderBy: { position: "asc" } }, _count: { select: { submissions: true } } } });
  if (!form) return jsonError("Form not found.", 404);
  return NextResponse.json({ form });
}

export async function PUT(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to edit this form.", 401);
  const { formId } = await params;
  const parsed = formDefinitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Add a title and valid fields to your form.", 400);
  let result;
  try { result = await prisma.$transaction(async (tx) => {
    const existing = await tx.form.findFirst({ where: { id: formId, ownerId: user.id }, select: { id: true, status: true, _count: { select: { submissions: true } } } });
    if (!existing) return { error: "Form not found.", status: 404 as const };
    if (existing.status === FormStatus.CLOSED) return { error: "Closed forms cannot be edited.", status: 409 as const };
    if (existing._count.submissions > 0) return { error: "Forms with responses can’t be edited yet, to keep existing answers intact. Duplicate this form to make changes.", status: 409 as const };
    await tx.formField.deleteMany({ where: { formId } });
    const form = await tx.form.update({
      where: { id: formId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        limitOneResponsePerEmail: parsed.data.limitOneResponsePerEmail,
        fields: { create: parsed.data.fields.map((field, position) => ({ type: field.type, label: field.label, helpText: field.helpText, required: field.required, position, options: field.options, validation: field.validation })) }
      },
      include: { fields: { orderBy: { position: "asc" } }, _count: { select: { submissions: true } } }
    });
    return { form };
  }, { isolationLevel: "Serializable" }); }
  catch (error) { if (isTransactionConflict(error)) return jsonError("A response or form change happened at the same time. Refresh and try again.", 409); throw error; }
  if ("error" in result && result.error) return jsonError(result.error, result.status);
  return NextResponse.json({ form: result.form });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to change form status.", 401);
  const { formId } = await params;
  const body = await request.json().catch(() => null) as { status?: unknown; limitOneResponsePerEmail?: unknown } | null;
  if (body && body.status === undefined && typeof body.limitOneResponsePerEmail === "boolean") {
    const result = await prisma.form.updateMany({ where: { id: formId, ownerId: user.id }, data: { limitOneResponsePerEmail: body.limitOneResponsePerEmail } });
    if (!result.count) return jsonError("Form not found.", 404);
    return NextResponse.json({ form: { limitOneResponsePerEmail: body.limitOneResponsePerEmail } });
  }
  if (!body || typeof body.status !== "string" || !["PUBLISHED", "CLOSED", "DRAFT"].includes(body.status)) return jsonError("Choose a valid form status.", 400);
  const status = body.status as FormStatus;
  let result;
  try { result = await prisma.$transaction(async (tx) => {
    const form = await tx.form.findFirst({ where: { id: formId, ownerId: user.id }, include: { fields: { select: { id: true } } } });
    if (!form) return { error: "Form not found.", status: 404 as const };
    if (status === FormStatus.PUBLISHED && form.fields.length === 0) return { error: "Add at least one question before publishing.", status: 400 as const };
    const updated = await tx.form.update({ where: { id: form.id }, data: { status, publishedAt: status === FormStatus.PUBLISHED ? new Date() : form.publishedAt } });
    return { form: updated };
  }, { isolationLevel: "Serializable" }); }
  catch (error) { if (isTransactionConflict(error)) return jsonError("The form changed at the same time. Refresh and try again.", 409); throw error; }
  if ("error" in result && result.error) return jsonError(result.error, result.status);
  return NextResponse.json({ form: result.form });
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to delete this form.", 401);
  const { formId } = await params;
  const result = await prisma.form.deleteMany({ where: { id: formId, ownerId: user.id } });
  if (!result.count) return jsonError("Form not found.", 404);
  return NextResponse.json({ ok: true });
}
