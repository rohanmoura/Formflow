import { NextResponse } from "next/server";
import { FormStatus, Prisma, prisma } from "@formflow/db";
import { submissionSchema } from "@formflow/validation";
import { isTransactionConflict, jsonError } from "@/lib/http";

const MAX_REQUESTS_PER_WINDOW = 12;

async function checkRateLimit(request: Request, slug: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean);
  const address = request.headers.get("x-real-ip") || forwarded?.at(-1) || "unknown";
  const key = `${slug}:${address}`.slice(0, 190);
  const [bucket] = await prisma.$queryRaw<Array<{ count: number }>>`
    WITH bucket AS (
      INSERT INTO "SubmissionRateLimit" ("key", "windowStartedAt", "count")
      VALUES (${key}, NOW(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "SubmissionRateLimit"."windowStartedAt" <= NOW() - INTERVAL '1 minute' THEN 1 ELSE "SubmissionRateLimit"."count" + 1 END,
        "windowStartedAt" = CASE WHEN "SubmissionRateLimit"."windowStartedAt" <= NOW() - INTERVAL '1 minute' THEN NOW() ELSE "SubmissionRateLimit"."windowStartedAt" END
      RETURNING "count"
    ), cleanup AS (
      DELETE FROM "SubmissionRateLimit" WHERE "windowStartedAt" < NOW() - INTERVAL '1 day'
    )
    SELECT "count" FROM bucket
  `;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context) {
  const { slug } = await params;
  try {
    if (await checkRateLimit(request, slug)) return NextResponse.json({ error: "Too many attempts. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  } catch {
    return jsonError("Submissions are temporarily unavailable. Please try again shortly.", 503);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256_000) return jsonError("This response is too large. Please shorten your answers.", 413);
  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > 256_000) return jsonError("This response is too large. Please shorten your answers.", 413);
  let body: unknown;
  try { body = rawBody ? JSON.parse(rawBody) : null; }
  catch { return jsonError("The response could not be read. Please try again.", 400); }
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) return jsonError("Check your answers and try again.", 400);
  if (parsed.data.website?.trim()) return NextResponse.json({ message: "Thanks — your response was submitted." }, { status: 201 });
  const suppliedEmail = parsed.data.respondent?.email?.trim().toLowerCase() || null;
  if (new Set(parsed.data.answers.map((answer) => answer.fieldId)).size !== parsed.data.answers.length) return jsonError("Each question can only have one answer.", 400);

  let outcome;
  try { outcome = await prisma.$transaction(async (tx) => {
    const form = await tx.form.findFirst({ where: { slug, status: FormStatus.PUBLISHED }, include: { fields: { orderBy: { position: "asc" } } } });
    if (!form) return { error: "This form is unavailable.", status: 404 as const };
    const values = new Map(parsed.data.answers.map((answer) => [answer.fieldId, answer.value]));
    const emailField = form.fields.find((field) => field.type === "EMAIL");
    const emailAnswer = emailField ? values.get(emailField.id) : null;
    const respondentEmail = suppliedEmail ?? (typeof emailAnswer === "string" ? emailAnswer.trim().toLowerCase() : null);
    if (form.limitOneResponsePerEmail && !respondentEmail) return { error: "Enter your email to submit this form.", status: 400 as const };
    if (form.limitOneResponsePerEmail && respondentEmail) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${form.id}), hashtext(${respondentEmail}))`;
      const existing = await tx.submission.findFirst({ where: { formId: form.id, respondentEmail }, select: { id: true } });
      if (existing) return { error: "A response from this email has already been recorded.", status: 409 as const };
    }
    if (parsed.data.answers.length !== form.fields.length || form.fields.some((field) => !values.has(field.id))) return { error: "Please answer each question and try again.", status: 400 as const };
    for (const field of form.fields) {
      const value = values.get(field.id);
      const hasValue = value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);
      if (field.required && !hasValue) return { error: `“${field.label}” is required.`, status: 400 as const };
      if (!hasValue) continue;
      if (["SHORT_TEXT", "LONG_TEXT", "EMAIL", "SINGLE_CHOICE"].includes(field.type) && typeof value !== "string") return { error: `“${field.label}” has an invalid answer.`, status: 400 as const };
      if (field.type === "MULTIPLE_CHOICE" && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) return { error: `“${field.label}” has an invalid answer.`, status: 400 as const };
      const choices = Array.isArray(field.options) ? field.options.filter((item): item is string => typeof item === "string") : [];
      if (Array.isArray(value) && new Set(value).size !== value.length) return { error: `“${field.label}” contains a duplicate choice.`, status: 400 as const };
      if ((field.type === "SINGLE_CHOICE" && !choices.includes(value as string)) || (field.type === "MULTIPLE_CHOICE" && (value as string[]).some((item) => !choices.includes(item)))) return { error: `“${field.label}” contains an unavailable choice.`, status: 400 as const };
      const rules = field.validation as { minLength?: number; maxLength?: number } | null;
      if (typeof value === "string" && ["SHORT_TEXT", "LONG_TEXT", "EMAIL"].includes(field.type) && value.length > 10000) return { error: `“${field.label}” is too long.`, status: 400 as const };
      if (typeof value === "string" && ((rules?.minLength !== undefined && value.length < rules.minLength) || (rules?.maxLength !== undefined && value.length > rules.maxLength))) return { error: `“${field.label}” does not meet its length requirements.`, status: 400 as const };
      if (field.type === "EMAIL" && typeof value === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: `“${field.label}” must be a valid email address.`, status: 400 as const };
    }
    if (parsed.data.answers.some((answer) => !form.fields.some((field) => field.id === answer.fieldId))) return { error: "A response contains an unknown question.", status: 400 as const };
    const submission = await tx.submission.create({
      data: {
        formId: form.id,
        respondent: parsed.data.respondent ? { ...parsed.data.respondent, email: suppliedEmail ?? undefined } : Prisma.JsonNull,
        respondentEmail,
        answers: { create: parsed.data.answers.filter((answer) => answer.value !== undefined).map((answer) => ({ fieldId: answer.fieldId, value: answer.value as never })) }
      },
      select: { id: true }
    });
    return { submissionId: submission.id };
  }, { isolationLevel: "Serializable" }); }
  catch (error) {
    if (isTransactionConflict(error)) return jsonError("This form changed while you were responding. Refresh the page and try again.", 409);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return jsonError("A response from this email has already been recorded.", 409);
    throw error;
  }

  if ("error" in outcome && outcome.error) return jsonError(outcome.error, outcome.status);
  return NextResponse.json({ submissionId: outcome.submissionId, message: "Thanks — your response was submitted." }, { status: 201 });
}
