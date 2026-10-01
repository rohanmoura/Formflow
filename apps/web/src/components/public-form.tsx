"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Field = { id: string; type: string; label: string; helpText: string | null; required: boolean; options: unknown; validation: unknown };
type Form = { id: string; title: string; description: string | null; limitOneResponsePerEmail: boolean; fields: Field[] };

export function PublicForm() {
  const params = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionId, setSubmissionId] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/public/forms/${params.slug}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "This form is unavailable.");
      return data.form as Form;
    }).then((data) => { if (active) setForm(data); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load this form. Please refresh."); });
    return () => { active = false; };
  }, [params.slug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const answers = form.fields.map((field) => {
      const values = data.getAll(field.id);
      const value = field.type === "MULTIPLE_CHOICE" ? values : values[0] ?? "";
      return { fieldId: field.id, value: typeof value === "string" ? value.trim() : value };
    });
    try {
      const emailQuestion = form.fields.find((field) => field.type === "EMAIL");
      const respondentEmail = (data.get("respondentEmail")?.toString() || (emailQuestion ? data.get(emailQuestion.id)?.toString() : ""))?.trim();
      const response = await fetch(`/api/public/forms/${params.slug}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, respondent: respondentEmail ? { email: respondentEmail } : undefined, website: data.get("website")?.toString() ?? "" }) });
      const result = await response.json();
      if (!response.ok) {
        const label = typeof result.error === "string" ? result.error.match(/^“(.+?)”/)?.[1] : undefined;
        if (label) document.getElementById(`field-${form.fields.find((field) => field.label === label)?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        throw new Error(result.error ?? "Please check your answers.");
      }
      setSubmissionId(result.submissionId ?? "");
      setSubmitted(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit your response. Please try again."); }
    finally { setBusy(false); }
  }

  if (error && !form) return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-6 text-center"><div className="max-w-md"><h1 className="text-2xl font-semibold">Form unavailable</h1><p className="mt-2 text-sm text-slate-500">{error}</p><button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[#5b5bd6] px-4 py-2 text-sm font-semibold text-white">Try again</button></div></main>;
  if (!form) return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] text-slate-500">Loading form…</main>;
  if (submitted) return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-6"><section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm md:p-10"><span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-700">✓</span><p className="mt-5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Response received</p><h1 className="mt-2 text-2xl font-semibold">Thank you for responding</h1><p className="mt-2 text-sm text-slate-500">Your response has been saved successfully.</p>{submissionId && <p className="mt-5 text-xs text-slate-400">Reference: {submissionId.slice(-8).toUpperCase()}</p>}</section></main>;

  return <main className="min-h-screen bg-[#f7f7f5] px-5 py-10 md:py-14"><form onSubmit={submit} className="mx-auto max-w-2xl space-y-4"><header className="rounded-2xl border border-slate-200 border-t-4 border-t-[#5b5bd6] bg-white p-6 shadow-sm md:p-8"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b5bd6]">FormFlow</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{form.title}</h1>{form.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{form.description}</p>}<p className="mt-5 text-xs text-slate-500"><span className="text-rose-600">*</span> Required</p></header>
    <label aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">Leave this field empty<input name="website" tabIndex={-1} autoComplete="off"/></label>{form.limitOneResponsePerEmail && !form.fields.some((field) => field.type === "EMAIL") && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label htmlFor="respondent-email" className="text-sm font-semibold text-slate-900">Your email <span className="text-rose-600">*</span></label><p className="mt-1 text-xs text-slate-500">Only one response per entered email. Email ownership is not verified.</p><input id="respondent-email" name="respondentEmail" type="email" autoComplete="email" required className="mt-3 w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></section>}
    {form.fields.map((field) => {
      const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string") : [];
      const required = field.required || (form.limitOneResponsePerEmail && field.type === "EMAIL");
      const describedBy = field.helpText ? `${field.id}-help` : undefined;
      return <section id={`field-${field.id}`} key={field.id} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><label htmlFor={field.id} className="text-sm font-semibold text-slate-900">{field.label}{required && <span className="ml-1 text-rose-600" aria-label="required">*</span>}</label>{field.helpText && <p id={`${field.id}-help`} className="mt-1 text-sm text-slate-500">{field.helpText}</p>}{field.type === "LONG_TEXT" ? <textarea id={field.id} name={field.id} required={required} aria-describedby={describedBy} className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-3 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" rows={4}/> : field.type === "SINGLE_CHOICE" || field.type === "MULTIPLE_CHOICE" ? <fieldset className="mt-4 space-y-2"><legend className="sr-only">{field.label}</legend>{options.map((option, index) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"><input type={field.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} name={field.id} value={option} required={required && field.type === "SINGLE_CHOICE" && index === 0} className="size-4 accent-[#5b5bd6]"/>{option}</label>)}</fieldset> : <input id={field.id} name={field.id} type={field.type === "EMAIL" ? "email" : "text"} required={required} aria-describedby={describedBy} autoComplete={field.type === "EMAIL" ? "email" : undefined} className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-3 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/>}</section>;
    })}
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<button disabled={busy} className="ui-button-primary min-h-11 rounded-xl bg-[#5b5bd6] px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{busy ? "Submitting response…" : "Submit response"}</button><p className="pt-3 text-center text-xs text-slate-400">Powered by FormFlow</p></form></main>;
}
