import { NextResponse } from "next/server";
import { prisma } from "@formflow/db";
import { getCurrentUser } from "@/lib/app-user";
import { jsonError } from "@/lib/http";

type Context = { params: Promise<{ formId: string }> };

export async function GET(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to view responses.", 401);
  const { formId } = await params;
  const url = new URL(request.url);
  const requestedPage = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25));
  const form = await prisma.form.findFirst({
    where: { id: formId, ownerId: user.id },
    include: {
      fields: { orderBy: { position: "asc" } },
      _count: { select: { submissions: true } }
    }
  });
  if (!form) return jsonError("Form not found.", 404);
  const totalPages = Math.ceil(form._count.submissions / pageSize);
  const page = Math.min(requestedPage, Math.max(1, totalPages));
  const submissions = await prisma.submission.findMany({
    where: { formId: form.id },
    include: { answers: true },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize
  });
  return NextResponse.json({ form, submissions, pagination: { page, pageSize, total: form._count.submissions, totalPages } });
}
