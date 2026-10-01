"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Field = { id?: string; type: string; label: string; helpText?: string | null; required: boolean; options?: string[]; validation?: { minLength?: number; maxLength?: number }; position: number };
type Form = { id: string; title: string; description: string | null; slug: string; status: string; limitOneResponsePerEmail: boolean; fields: Field[]; _count: { submissions: number } };
const types = [{ value: "SHORT_TEXT", label: "Short text" }, { value: "LONG_TEXT", label: "Long text" }, { value: "EMAIL", label: "Email" }, { value: "SINGLE_CHOICE", label: "Single choice" }, { value: "MULTIPLE_CHOICE", label: "Multiple choice" }];
type SaveState = "saved" | "unsaved" | "saving" | "error";

function snapshot(form: Form) {
  return JSON.stringify({ title: form.title, description: form.description, limitOneResponsePerEmail: form.limitOneResponsePerEmail, fields: form.fields.map((field, position) => ({ type: field.type, label: field.label, helpText: field.helpText ?? "", required: field.required, position, options: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(field.type) ? (field.options ?? []).map((option) => option.trim()).filter(Boolean) : undefined })) });
}

export function FormEditor() {
  const params = useParams<{ formId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailPolicyBusy, setEmailPolicyBusy] = useState(false);
  const [action, setAction] = useState<"publish" | "close" | "duplicate" | "delete" | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [focusField, setFocusField] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const formRef = useRef<Form | null>(null);
  const savingRef = useRef(false);
  const dirty = Boolean(form && snapshot(form) !== savedSnapshot);

  useEffect(() => {
    let active = true;
    fetch(`/api/forms/${params.formId}`).then(async (response) => {
      if (response.status === 401) { router.replace("/login"); return null; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load this form.");
      return data.form as Form;
    }).then((loaded) => {
      if (!active || !loaded) return;
      formRef.current = loaded;
      setForm(loaded);
      setSavedSnapshot(snapshot(loaded));
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load this form. Check your connection and refresh."); });
    return () => { active = false; };
  }, [params.formId, router]);

  useEffect(() => {
    if (!dirty || form?._count.submissions || form?.status === "CLOSED") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty, form?._count.submissions, form?.status]);

  useEffect(() => { setSaveState(busy ? "saving" : dirty ? "unsaved" : "saved"); }, [busy, dirty]);

  const updateForm = useCallback((update: (current: Form) => Form) => {
    setForm((current) => {
      if (!current) return current;
      const next = update(current);
      formRef.current = next;
      return next;
    });
  }, []);

  function updateField(index: number, changes: Partial<Field>) { updateForm((current) => ({ ...current, fields: current.fields.map((field, itemIndex) => itemIndex === index ? { ...field, ...changes } : field) })); }
  function addField(type = "SHORT_TEXT") {
    const isChoice = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(type);
    updateForm((current) => ({ ...current, fields: [...current.fields, { type, label: "", helpText: "", required: false, options: isChoice ? ["Option 1", "Option 2"] : undefined, position: current.fields.length }] }));
    setFocusField((formRef.current?.fields.length ?? 1) - 1);
  }
  function moveField(index: number, direction: -1 | 1) {
    updateForm((current) => {
      if (index + direction < 0 || index + direction >= current.fields.length) return current;
      const fields = [...current.fields];
      [fields[index], fields[index + direction]] = [fields[index + direction], fields[index]];
      return { ...current, fields: fields.map((field, position) => ({ ...field, position })) };
    });
    setFocusField(index + direction);
  }
  function removeField(index: number) {
    const label = form?.fields[index]?.label || `Question ${index + 1}`;
    if (!window.confirm(`Remove “${label}” from this form?`)) return;
    updateForm((current) => ({ ...current, fields: current.fields.filter((_, itemIndex) => itemIndex !== index).map((field, position) => ({ ...field, position })) }));
    setFocusField(null);
  }
  function duplicateField(index: number) {
    updateForm((current) => {
      const copy = { ...current.fields[index], id: undefined, label: current.fields[index].label ? `${current.fields[index].label} (copy)` : "", options: current.fields[index].options ? [...current.fields[index].options] : undefined };
      const fields = [...current.fields]; fields.splice(index + 1, 0, copy);
      return { ...current, fields: fields.map((field, position) => ({ ...field, position })) };
    });
    setFocusField(index + 1);
  }

  async function save() {
    const currentForm = formRef.current;
    if (!currentForm || savingRef.current) return false;
    savingRef.current = true; setBusy(true); setSaveState("saving"); setError(""); setNotice("");
    try {
      const body = snapshot(currentForm);
      const response = await fetch(`/api/forms/${currentForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save this form.");
      const saved = data.form as Form;
      formRef.current = saved; setForm(saved); setSavedSnapshot(snapshot(saved)); setSaveState("saved"); setNotice("All changes saved.");
      return true;
    } catch (caught) {
      setSaveState("error"); setError(caught instanceof Error ? caught.message : "Could not save this form. Check your connection and try again.");
      return false;
    } finally { savingRef.current = false; setBusy(false); }
  }

  async function changeStatus(status: string) {
    const currentForm = formRef.current;
    if (!currentForm) return;
    setError(""); setNotice(""); setAction(status === "PUBLISHED" ? "publish" : "close");
    try {
      if (status === "PUBLISHED" && dirty && !(await save())) return;
      const response = await fetch(`/api/forms/${currentForm.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update form status.");
      updateForm((current) => ({ ...current, ...data.form }));
      if (status === "PUBLISHED") setShowShare(true);
      setNotice(status === "PUBLISHED" ? "Your form is live. Share the link with respondents." : "Form closed. New responses are no longer accepted.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update form status."); }
    finally { setAction(null); }
  }
  async function copyLink() {
    const currentForm = formRef.current;
    if (!currentForm) return;
    setError(""); setCopyState("idle");
    try { await navigator.clipboard.writeText(`${window.location.origin}/f/${currentForm.slug}`); setCopyState("copied"); setNotice("Share link copied to clipboard."); }
    catch { setCopyState("error"); setError("Could not copy automatically. Select and copy the link shown below."); }
  }
  async function updateEmailPolicy(enabled: boolean) {
    const currentForm = formRef.current;
    if (!currentForm || emailPolicyBusy) return;
    setEmailPolicyBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/forms/${currentForm.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limitOneResponsePerEmail: enabled }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update respondent email settings.");
      const updated = { ...currentForm, limitOneResponsePerEmail: data.form.limitOneResponsePerEmail };
      updateForm(() => updated);
      setSavedSnapshot(snapshot(updated));
      setNotice(enabled ? "Email is required for new responses; repeat emails are blocked." : "Email collection and repeat-email blocking are off for new responses.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update respondent email settings."); }
    finally { setEmailPolicyBusy(false); }
  }
  async function duplicateForm() {
    const currentForm = formRef.current;
    if (!currentForm) return;
    setAction("duplicate"); setError("");
    try {
      const fields = currentForm.fields.map((field, position) => {
        const isChoice = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(field.type);
        const options = isChoice ? [...new Set((field.options ?? []).map((option) => option.trim()).filter(Boolean))] : undefined;
        return { type: field.type, label: field.label.trim(), helpText: field.helpText?.trim() || null, required: field.required, position, options, validation: field.validation ?? undefined };
      });
      if (fields.some((field) => !field.label || (["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(field.type) && (field.options?.length ?? 0) < 2))) {
        throw new Error("This form has an incomplete question. Add a question label and at least two distinct options for each choice question, then try again.");
      }
      const response = await fetch("/api/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `Copy of ${currentForm.title}`.slice(0, 160), description: currentForm.description?.trim() || null, limitOneResponsePerEmail: currentForm.limitOneResponsePerEmail, fields }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not duplicate the form.");
      router.push(`/forms/${data.form.id}/edit`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not duplicate the form."); setAction(null); }
  }
  async function deleteForm() {
    const currentForm = formRef.current;
    if (!currentForm || (dirty && !window.confirm("You have unsaved changes. Continue to delete this form?"))) return;
    if (!window.confirm(`Delete “${currentForm.title}” and all its responses? This can’t be undone.`)) return;
    setAction("delete"); setError("");
    try {
      const response = await fetch(`/api/forms/${currentForm.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete this form.");
      router.replace("/dashboard");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete this form."); setAction(null); }
  }

  if (!form) return <main className="grid min-h-screen place-items-center text-slate-500">{error || "Loading form…"}</main>;
  const locked = form._count.submissions > 0 || form.status === "CLOSED";
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/f/${form.slug}`;
  const statusText = saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed" : "All changes saved";

  const respondentSettings = <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">Respondent email</h2><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={form.limitOneResponsePerEmail} disabled={emailPolicyBusy} onChange={(event) => updateEmailPolicy(event.target.checked)}/><span>{emailPolicyBusy ? "Saving email settings…" : "Require email; limit to one response per email"}</span></label><p className="mt-2 text-xs text-slate-500">Applies to future responses. Existing responses without an email stay anonymous. Email ownership is not verified.</p></section>;
  return <main className="min-h-screen bg-[#f7f7f5] px-4 pb-16 md:px-8">
    <header className="sticky top-0 z-20 -mx-4 border-b border-[#e9e8e4] bg-[#f7f7f5]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Link href="/dashboard" aria-label="Back to all forms" className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-black/[0.04] hover:text-slate-900"><svg aria-hidden="true" viewBox="0 0 20 20" className="mr-1.5 size-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12.5 4.5-5.5 5.5 5.5 5.5"/><path d="M7.5 10h9"/></svg><span className="hidden sm:inline">All forms</span></Link><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{form.title || "Untitled form"}</p><p aria-live="polite" className={`text-xs ${saveState === "error" ? "text-rose-600" : saveState === "unsaved" ? "text-amber-700" : "text-slate-500"}`}>{statusText}</p></div><div className="flex shrink-0 items-center gap-2">{form._count.submissions > 0 ? <Link href={`/forms/${form.id}/responses`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold sm:text-sm">Responses <span className="text-slate-500">{form._count.submissions}</span></Link> : <button disabled title="Responses appear after someone submits your published form." className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400 sm:text-sm">Responses 0</button>}<button onClick={save} disabled={!dirty || busy || action !== null || locked} className="rounded-lg bg-[#5b5bd6] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4d4dc1] disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-4 sm:text-sm">{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button></div></div></header>
    <div className="mx-auto mt-8 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="lg:col-span-2">{respondentSettings}</div>
      <section className="min-w-0"><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b5bd6]">Form builder</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Build your form</h1><p className="mt-1 text-sm text-slate-500">Add questions, then preview before you publish.</p></div><button onClick={() => setShowPreview(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"><svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 10s2.5-5 7.5-5 7.5 5 7.5 5-2.5 5-7.5 5-7.5-5-7.5-5Z"/><circle cx="10" cy="10" r="2"/></svg>Preview</button></div></div>
        {form._count.submissions > 0 && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">This form already has {form._count.submissions} {form._count.submissions === 1 ? "response" : "responses"}.</p><p className="mt-1 text-amber-900">Questions are locked to protect submitted answers. Create a copy if you want to reuse these questions in a separate form.</p><button onClick={duplicateForm} disabled={action !== null} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-60">{action === "duplicate" ? "Creating copy…" : "Create a copy"}</button></div>}
        {form.status === "CLOSED" && <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">This form is closed. Reopen it from the publish panel to accept responses again.</div>}
        <fieldset disabled={locked} className="space-y-4 disabled:opacity-75"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"><label htmlFor="form-title" className="sr-only">Form title</label><input id="form-title" value={form.title} maxLength={160} onChange={(event) => updateForm((current) => ({ ...current, title: event.target.value }))} className="w-full border-0 text-2xl font-semibold tracking-tight outline-none placeholder:text-slate-300" placeholder="Untitled form"/><label htmlFor="form-description" className="sr-only">Form description</label><textarea id="form-description" value={form.description ?? ""} maxLength={2000} onChange={(event) => updateForm((current) => ({ ...current, description: event.target.value }))} className="mt-3 min-h-16 w-full resize-y border-0 text-sm text-slate-600 outline-none placeholder:text-slate-400" placeholder="Add a description to help people understand this form"/></div>
        {form.fields.map((field, index) => <article key={field.id ?? `new-${index}`} className={`rounded-2xl border bg-white p-5 shadow-sm transition-shadow md:p-6 ${focusField === index ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"}`} onFocusCapture={() => setFocusField(index)}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Question {index + 1}</span><div className="flex flex-wrap items-center gap-1"><button type="button" onClick={() => moveField(index, -1)} disabled={index === 0 || locked} aria-label={`Move question ${index + 1} up`} className="rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">↑</button><button type="button" onClick={() => moveField(index, 1)} disabled={index === form.fields.length - 1 || locked} aria-label={`Move question ${index + 1} down`} className="rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">↓</button><button type="button" onClick={() => duplicateField(index)} disabled={locked} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40">Duplicate</button><button type="button" onClick={() => removeField(index)} disabled={locked} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">Remove</button></div></div><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]"><input aria-label={`Question ${index + 1} label`} value={field.label} maxLength={160} onChange={(event) => updateField(index, { label: event.target.value })} className="min-w-0 rounded-lg border border-slate-200 px-3.5 py-3 text-sm font-medium outline-none focus:border-indigo-400" placeholder="Write your question"/><select aria-label={`Question ${index + 1} type`} value={field.type} onChange={(event) => { const type = event.target.value; updateField(index, { type, options: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(type) ? field.options ?? ["Option 1", "Option 2"] : undefined }); }} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400">{types.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></div><input aria-label={`Question ${index + 1} help text`} value={field.helpText ?? ""} maxLength={500} onChange={(event) => updateField(index, { helpText: event.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400" placeholder="Help text (optional)"/>{["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(field.type) && <div className="mt-4 space-y-2"><p className="text-xs font-medium text-slate-600">Options</p>{(field.options ?? []).map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><span className="text-slate-400">{field.type === "SINGLE_CHOICE" ? "◯" : "□"}</span><input aria-label={`Question ${index + 1}, option ${optionIndex + 1}`} value={option} maxLength={120} onChange={(event) => updateField(index, { options: (field.options ?? []).map((item, itemIndex) => itemIndex === optionIndex ? event.target.value : item) })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" placeholder={`Option ${optionIndex + 1}`}/><button type="button" aria-label={`Remove option ${optionIndex + 1}`} disabled={(field.options?.length ?? 0) <= 2} onClick={() => updateField(index, { options: field.options?.filter((_, itemIndex) => itemIndex !== optionIndex) })} className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">×</button></div>)}<button type="button" onClick={() => updateField(index, { options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })} disabled={(field.options?.length ?? 0) >= 30} className="text-xs font-semibold text-[#5b5bd6] hover:text-[#4242ad] disabled:opacity-40">＋ Add option</button></div>}<label className="mt-4 flex w-fit items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} className="size-4 accent-[#5b5bd6]"/>Required</label></article>)}
        </fieldset>
        {!locked && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => addField()} className="rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 px-4 py-3 text-sm font-semibold text-[#5b5bd6] hover:bg-indigo-50">＋ Add question</button><select aria-label="Add question type" defaultValue="" onChange={(event) => { if (event.target.value) { addField(event.target.value); event.currentTarget.value = ""; } }} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="" disabled>Choose question type…</option>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>}
        {(error || notice) && <p role={error ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${error ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || notice}</p>}
      </section>
      <aside className="h-fit space-y-4 lg:sticky lg:top-24"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Publish</p><h2 className="mt-2 text-base font-semibold">{form.status === "PUBLISHED" ? "Your form is live" : form.status === "CLOSED" ? "Form closed" : "Ready when you are"}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{form.status === "PUBLISHED" ? "Anyone with your link can submit a response." : form.status === "CLOSED" ? "Reopen the form to accept new responses." : "Preview your questions, save, then publish to share."}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => changeStatus(form.status === "PUBLISHED" ? "CLOSED" : "PUBLISHED")} disabled={action !== null || busy || (form.status !== "PUBLISHED" && (!form.fields.length || dirty && !form.title.trim()))} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{action === "publish" ? "Publishing…" : action === "close" ? "Closing…" : form.status === "PUBLISHED" ? "Close form" : form.status === "CLOSED" ? "Reopen form" : "Publish form"}</button>{form.status === "PUBLISHED" && <button onClick={() => setShowShare(true)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50">Share</button>}</div>{form.status === "PUBLISHED" && <div className="mt-3 flex gap-2"><button onClick={() => setShowPreview(true)} className="text-xs font-medium text-[#5b5bd6]">Preview</button>{form._count.submissions > 0 && <Link href={`/forms/${form.id}/responses`} className="ml-auto text-xs font-medium text-[#5b5bd6]">Responses ({form._count.submissions})</Link>}</div>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Form overview</p><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Questions</span><span className="font-medium">{form.fields.length}</span></div><div className="flex justify-between"><span className="text-slate-500">Responses</span><span className="font-medium">{form._count.submissions}</span></div><div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-medium capitalize">{form.status.toLowerCase()}</span></div></div></section><button onClick={duplicateForm} disabled={action !== null} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{action === "duplicate" ? "Duplicating…" : "Duplicate form"}</button><button onClick={deleteForm} disabled={action !== null || busy} className="w-full rounded-lg px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">{action === "delete" ? "Deleting…" : "Delete form"}</button></aside>
    </div>
    {showShare && <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowShare(false); }}><section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="share-title" className="text-lg font-semibold">Your form is live</h2><p className="mt-1 text-sm text-slate-500">Share this link so people can respond.</p></div><button onClick={() => setShowShare(false)} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button></div><label htmlFor="share-url" className="mt-5 block text-xs font-medium text-slate-600">Public form link</label><div className="mt-2 flex gap-2"><input id="share-url" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"/><button onClick={copyLink} className="shrink-0 rounded-lg bg-[#5b5bd6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4d4dc1]">{copyState === "copied" ? "Copied ✓" : "Copy link"}</button></div><div className="mt-5 flex justify-end"><Link href={`/f/${form.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#5b5bd6]">Preview form ↗</Link></div></section></div>}
    {showPreview && <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPreview(false); }}><section className="mx-auto w-full max-w-2xl rounded-2xl bg-[#f7f7f5] p-5 shadow-2xl md:p-8"><div className="mb-5 flex items-start justify-between"><div><h2 id="preview-title" className="text-lg font-semibold">Form preview</h2><p className="mt-1 text-sm text-slate-500">This is what respondents will see.</p></div><button onClick={() => setShowPreview(false)} aria-label="Close preview" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-200">✕</button></div><div className="space-y-3"><header className="rounded-xl border-t-4 border-[#5b5bd6] bg-white p-6"><h3 className="text-2xl font-semibold">{form.title || "Untitled form"}</h3>{form.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{form.description}</p>}<p className="mt-4 text-xs text-slate-500">* Indicates a required question</p></header>{form.fields.length ? form.fields.map((field, index) => <section key={field.id ?? index} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium">{field.label || `Question ${index + 1}`}{field.required && <span className="ml-1 text-rose-600">*</span>}</p>{field.helpText && <p className="mt-1 text-xs text-slate-500">{field.helpText}</p>}{field.type === "LONG_TEXT" ? <div className="mt-3 h-20 rounded-lg border border-slate-200"/> : ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(field.type) ? <div className="mt-3 space-y-2">{(field.options ?? []).map((option, optionIndex) => <p key={optionIndex} className="text-sm text-slate-600">{field.type === "SINGLE_CHOICE" ? "◯" : "□"} <span className="ml-2">{option}</span></p>)}</div> : <div className="mt-3 h-10 rounded-lg border border-slate-200"/>}</section>) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Add a question to preview the form.</p>}<button disabled className="rounded-lg bg-[#5b5bd6] px-5 py-2.5 text-sm font-semibold text-white opacity-80">Submit response</button></div></section></div>}
  </main>;
}
