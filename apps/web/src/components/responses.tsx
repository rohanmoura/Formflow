"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Field = { id: string; label: string; position: number };
type Answer = { fieldId: string; value: unknown };
type Submission = { id: string; submittedAt: string; respondent: { email?: string; name?: string } | null; respondentEmail: string | null; answers: Answer[] };
type Form = { id: string; title: string; slug: string; fields: Field[] };
function asText(value: unknown) { return Array.isArray(value) ? value.map(String).join(", ") : value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function csvCell(value: string) { const safeValue = /^[=+@-]/.test(value.trimStart()) ? `'${value}` : value; return `"${safeValue.replaceAll('"', '""')}"`; }

export function Responses() {
  const params = useParams<{ formId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exported, setExported] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetch(`/api/forms/${params.formId}/submissions?page=${page}&pageSize=25`).then(async (response) => {
      if (response.status === 401) { router.replace("/login"); return null; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load responses.");
      return data as { form: Form; submissions: Submission[]; pagination: { total: number; totalPages: number } };
    }).then((data) => { if (active && data) { setForm(data.form); setSubmissions(data.submissions); setTotal(data.pagination.total); setTotalPages(data.pagination.totalPages); } }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load responses. Please refresh."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.formId, router, page]);

  const fields = useMemo(() => [...(form?.fields ?? [])].sort((a, b) => a.position - b.position), [form]);
  const filtered = useMemo(() => submissions.filter((submission) => !search || [submission.respondentEmail ?? submission.respondent?.email ?? "", submission.respondent?.name ?? "", new Date(submission.submittedAt).toLocaleString(), ...submission.answers.map((answer) => asText(answer.value))].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))), [submissions, search]);

  function exportCsv() {
    if (!form) return;
    const rows = [["Submitted at", "Respondent name", "Respondent email", ...fields.map((field) => field.label)], ...filtered.map((submission) => [new Date(submission.submittedAt).toISOString(), submission.respondent?.name ?? "", submission.respondentEmail ?? submission.respondent?.email ?? "", ...fields.map((field) => asText(submission.answers.find((answer) => answer.fieldId === field.id)?.value))])];
    const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${form.slug}-responses-page-${page}.csv`; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true); window.setTimeout(() => setExported(false), 2500);
  }

  if (loading && !form) return <main className="grid min-h-screen place-items-center text-slate-500">Loading responses…</main>;
  if (error && !form) return <main className="grid min-h-screen place-items-center px-5 text-center"><div><p role="alert" className="text-sm text-rose-700">{error}</p><button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[#5b5bd6] px-4 py-2 text-sm font-semibold text-white">Try again</button></div></main>;
  if (!form) return null;

  return <main className="min-h-screen bg-[#f7f7f5] px-4 py-6 sm:px-5 md:px-10 md:py-8"><header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2"><Link href={`/forms/${form.id}/edit`} className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-black/[0.04]">Back to editor</Link><Link href="/dashboard/responses" className="ui-link rounded-lg px-2 py-2 text-sm">All response forms</Link></header><section className="mx-auto mt-8 max-w-6xl"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b5bd6]">Response inbox</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{form.title}</h1><p className="mt-2 text-sm text-slate-500">{total} {total === 1 ? "response" : "responses"}</p></div><button onClick={exportCsv} disabled={!filtered.length} className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{exported ? "CSV downloaded ✓" : `Export this page${search ? " results" : ""}`}</button></div>
  {total > 0 && <div className="mt-7 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="response-search">Search this page</label><input id="response-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page by email, answers or time…" className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 sm:max-w-md"/><p className="self-center text-xs text-slate-500">Showing {filtered.length} of {submissions.length} on this page</p></div>}
  {!filtered.length ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">{total ? <><h2 className="font-medium text-slate-800">No matches on this page</h2><button onClick={() => setSearch("")} className="mt-4 text-sm font-semibold text-[#5b5bd6]">Clear search</button></> : <><h2 className="font-medium text-slate-800">Waiting for your first response</h2><p className="mt-2 text-sm text-slate-500">Publish the form and share the link to start collecting answers.</p><Link href={`/forms/${form.id}/edit`} className="ui-link mt-4 inline-flex min-h-10 items-center rounded-lg px-3 text-sm">Go to form editor</Link></>}</div> : <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="max-h-[70vh] overflow-auto"><table className="w-full min-w-[720px] border-collapse text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50"><tr><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Respondent email</th>{fields.map((field) => <th key={field.id} className="max-w-56 px-4 py-3 font-semibold">{field.label}</th>)}<th className="px-4 py-3 font-semibold">Details</th></tr></thead><tbody>{filtered.map((submission) => <tr key={submission.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(submission.submittedAt).toLocaleString()}</td><td className="px-4 py-3 text-slate-600">{submission.respondentEmail ?? submission.respondent?.email ?? "Not provided"}</td>{fields.map((field) => <td key={field.id} className="max-w-56 whitespace-pre-wrap break-words px-4 py-3">{asText(submission.answers.find((answer) => answer.fieldId === field.id)?.value) || <span className="text-slate-300">—</span>}</td>)}<td className="px-4 py-3"><button onClick={() => setSelected(submission)} className="ui-link inline-flex min-h-9 items-center rounded-md px-2 text-xs">View response</button></td></tr>)}</tbody></table></div></div>}
  {totalPages > 1 && <div className="mt-4 flex items-center justify-between"><p className="text-xs text-slate-500">Page {page} of {totalPages}</p><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-40">Previous</button><button disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-40">Next</button></div></div>}
  </section>{selected && <div role="dialog" aria-modal="true" aria-labelledby="response-detail-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#5b5bd6]">Individual response</p><h2 id="response-detail-title" className="mt-1 text-lg font-semibold">{new Date(selected.submittedAt).toLocaleString()}</h2></div><button onClick={() => setSelected(null)} aria-label="Close response details" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button></div><dl className="mt-5 space-y-4"><div className="border-t border-slate-100 pt-3"><dt className="text-xs font-medium text-slate-500">Respondent email</dt><dd className="mt-1 text-sm text-slate-900">{selected.respondentEmail ?? selected.respondent?.email ?? "Not provided"}</dd></div>{fields.map((field) => <div key={field.id} className="border-t border-slate-100 pt-3"><dt className="text-xs font-medium text-slate-500">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{asText(selected.answers.find((answer) => answer.fieldId === field.id)?.value) || "No answer"}</dd></div>)}</dl></section></div>}</main>;
}
