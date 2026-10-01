"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";

type Form = { id: string; slug: string; title: string; description: string | null; status: string; updatedAt: string; _count: { submissions: number; fields: number } };
type User = { id: string; name: string | null; email: string };

const demoForms: Form[] = [
  { id: "demo-feedback", slug: "sample-customer-feedback", title: "Customer feedback", description: "", status: "PUBLISHED", updatedAt: "2026-09-28T10:00:00.000Z", _count: { submissions: 24, fields: 5 } },
  { id: "demo-event", slug: "sample-event-registration", title: "Event registration", description: "", status: "PUBLISHED", updatedAt: "2026-09-26T10:00:00.000Z", _count: { submissions: 18, fields: 4 } },
  { id: "demo-draft", slug: "sample-product-survey", title: "Product survey", description: "", status: "DRAFT", updatedAt: "2026-09-24T10:00:00.000Z", _count: { submissions: 0, fields: 6 } }
];

export function Dashboard({ view = "forms" }: { view?: "forms" | "responses" }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const filteredForms = useMemo(() => forms.filter((form) => form.title.toLowerCase().includes(query.trim().toLowerCase()) && (statusFilter === "ALL" || form.status === statusFilter)), [forms, query, statusFilter]);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      try {
        const sessionResponse = await fetch("/api/workspace/session");
        const session = await sessionResponse.json();
        if (!active) return;
        if (!session.user) {
          setDemoMode(true);
          setForms(demoForms);
          setLoaded(true);
          return;
        }
        setUser(session.user);
        const formsResponse = await fetch("/api/forms");
        const data = await formsResponse.json();
        if (!formsResponse.ok) throw new Error(data.error ?? "Could not load your forms.");
        if (!active) return;
        setForms(data.forms ?? []);
        setLoaded(true);
      } catch {
        if (!active) return;
        setLoadError("We couldn’t load this workspace. Please refresh and try again.");
        setLoaded(true);
      }
    }
    void loadWorkspace();
    return () => { active = false; };
  }, []);

  function requireSignIn() {
    router.push("/login");
  }

  async function createForm() {
    if (demoMode || !user) return requireSignIn();
    setCreateBusy(true); setActionError("");
    try {
      const response = await fetch("/api/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Untitled form", description: "", fields: [{ type: "SHORT_TEXT", label: "Your question", position: 0, required: true }] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create your form. Please try again.");
      router.push(`/forms/${data.form.id}/edit`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not create your form. Please try again.");
      setCreateBusy(false);
    }
  }

  if (!loaded) return <main className="grid min-h-screen place-items-center text-slate-500">Loading your workspace…</main>;
  const responseCount = forms.reduce((total, form) => total + form._count.submissions, 0);

  return <main className="min-h-screen bg-[#f7f7f5] lg:flex">
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#e7e6e2] bg-[#f1f0ed] px-4 py-5 lg:flex">
      <Link href="/" className="mb-9 flex items-center gap-2 rounded-lg px-2 py-1 text-[15px] font-semibold tracking-tight transition-colors hover:bg-black/[0.04]"><span className="grid size-7 place-items-center rounded-lg bg-[#252523] text-sm font-bold text-white">f</span>formflow</Link>
      {user ? <div className="mb-7 flex items-center gap-2 rounded-lg border border-[#e5e4e0] bg-white/70 px-3 py-2.5"><span className="grid size-7 place-items-center rounded-md bg-[#e9e7fb] text-xs font-bold text-[#625ac7]">{(user.name || user.email).slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-xs font-medium">{user.name || "My workspace"}</span><span className="block truncate text-[10px] text-[#858580]">Personal workspace</span></span><span className="ml-auto text-[#858580]">⌄</span></div> : <div className="mb-7 flex items-center gap-2 rounded-lg border border-[#e5e4e0] bg-white/70 px-3 py-2.5"><span className="grid size-7 place-items-center rounded-md bg-[#e9e7fb] text-xs font-bold text-[#625ac7]">F</span><span className="text-xs font-medium">Sample workspace</span><span className="ml-auto text-[#858580]">⌄</span></div>}
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#92918c]">Workspace</p>
      <nav aria-label="Workspace" className="space-y-1 text-[13px]"><Link href="/dashboard" aria-current={view === "forms" ? "page" : undefined} className={`group flex items-center gap-2 rounded-lg px-2.5 py-2.5 font-medium transition-colors hover:bg-[#e2e1de] ${view === "forms" ? "bg-[#e7e6e2]" : "text-[#666560]"}`}><svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/></svg> All forms <span className="ml-auto rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] text-[#858580]">{forms.length}</span></Link>{user && forms.length > 0 && <Link href="/dashboard/responses" aria-current={view === "responses" ? "page" : undefined} className={`group flex items-center gap-2 rounded-lg px-2.5 py-2.5 font-medium transition-colors hover:bg-[#e2e1de] ${view === "responses" ? "bg-[#e7e6e2]" : "text-[#666560]"}`}><svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4.5h12v11H4z"/><path d="M7 8h6M7 11h6M7 14h3"/></svg> Responses <span className="ml-auto rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] text-[#858580]">{responseCount}</span></Link>}</nav>
      <div className="mt-auto rounded-lg border border-[#e2e1dd] bg-white/60 p-3"><p className="text-xs font-semibold">Forms, in flow.</p><p className="mt-1 text-[11px] leading-5 text-[#858580]">Create a form, share one link, and keep your responses together.</p></div>
    </aside>
    <div className="min-w-0 flex-1">
    <nav className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#e9e8e4] bg-[#f8f8f7]/90 px-5 backdrop-blur md:px-9"><Link href="/" className="flex items-center gap-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-75 lg:hidden"><span className="grid size-7 place-items-center rounded-lg bg-[#252523] text-white">f</span>formflow</Link><div className="hidden items-center gap-2 text-xs text-[#858580] lg:flex"><span>Workspace</span><span aria-hidden="true">/</span><span className="text-[#383835]">{view === "responses" ? "Responses" : "All forms"}</span></div><div className="ml-auto flex items-center gap-4">{user ? <><span className="hidden text-xs text-[#777671] sm:block">{user.email}</span><SignOutButton signOutOptions={{ redirectUrl: "/" }}><button className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[#666560] hover:bg-black/[0.04] hover:text-[#252523]">Sign out</button></SignOutButton></> : <Link href="/login" className="ui-link rounded-md px-2.5 py-1.5 text-xs hover:bg-[#efedff]">Sign in</Link>}</div></nav>
    <section className="mx-auto max-w-6xl px-5 pb-12 pt-8 md:px-9 md:pt-11">
      <nav aria-label="Workspace sections" className="mb-6 flex gap-2 lg:hidden"><Link href="/dashboard" aria-current={view === "forms" ? "page" : undefined} className={`rounded-lg px-3 py-2 text-xs font-medium ${view === "forms" ? "bg-[#e7e6e2] text-[#252523]" : "text-[#777671] hover:bg-black/[0.04]"}`}>All forms</Link>{user && forms.length > 0 && <Link href="/dashboard/responses" aria-current={view === "responses" ? "page" : undefined} className={`rounded-lg px-3 py-2 text-xs font-medium ${view === "responses" ? "bg-[#e7e6e2] text-[#252523]" : "text-[#777671] hover:bg-black/[0.04]"}`}>Responses <span className="ml-1 text-[#858580]">{responseCount}</span></Link>}</nav>
      {demoMode && <div className="mb-7 flex flex-col justify-between gap-3 rounded-xl border border-[#e6e3da] bg-[#f2f0e9] px-4 py-3.5 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold text-[#484740]">Preview workspace <span className="ml-2 rounded bg-[#e4e1d7] px-1.5 py-0.5 text-[10px] font-medium text-[#716e64]">SAMPLE DATA</span></p><p className="mt-1 text-xs text-[#79776f]">Sample content only. Sign in or create an account to start your own forms.</p></div><Link href="/register" className="ui-button-primary shrink-0 rounded-lg bg-[#6b63d9] px-3.5 py-2.5 text-center text-xs font-semibold text-white shadow-sm">Create your workspace</Link></div>}
      {loadError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{loadError}</div> : <>
        {view === "responses" ? <>
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium text-[#777671]">Your workspace</p><h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[#252523]">Responses</h1><p className="mt-1.5 text-[13px] text-[#858580]">Choose a form to review its submissions.</p></div><p className="text-sm text-[#777671]"><span className="font-semibold text-[#252523]">{responseCount}</span> total {responseCount === 1 ? "response" : "responses"}</p></div>
          {demoMode ? <div className="rounded-xl border border-[#e8e7e3] bg-white p-8 text-center"><h2 className="text-sm font-semibold">Sign in to manage responses</h2><p className="mt-2 text-xs text-[#858580]">Preview responses are examples only; your private response inbox is available after signing in.</p><Link href="/login" className="ui-button-primary mt-4 inline-flex rounded-lg bg-[#6b63d9] px-4 py-2.5 text-xs font-semibold text-white">Sign in</Link></div> : forms.length === 0 ? <div className="rounded-xl border border-dashed border-[#d9d8d3] bg-white/70 p-12 text-center"><h2 className="text-sm font-semibold">Create a form to collect responses</h2><p className="mt-2 text-xs text-[#858580]">Once you have a form, it will appear here so you can open its response inbox.</p><button onClick={createForm} disabled={createBusy} className="ui-button-primary mt-4 rounded-lg bg-[#6b63d9] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-70">{createBusy ? "Creating…" : "Create form"}</button></div> : <div className="overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">{[...forms].sort((left, right) => right._count.submissions - left._count.submissions || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).map((form, index) => <article key={form.id} className={`flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-[#f8f8fc] sm:flex-row sm:items-center sm:justify-between ${index > 0 ? "border-t border-[#efeeeb]" : ""}`}><div className="min-w-0"><h2 className="truncate text-[13px] font-medium text-[#353532]">{form.title}</h2><p className="mt-1 text-[11px] text-[#858580]">{form._count.fields} questions <span className="px-1">·</span> {form.status.toLowerCase()}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className="text-xs text-[#777671]">{form._count.submissions} {form._count.submissions === 1 ? "response" : "responses"}</span>{form._count.submissions > 0 ? <Link href={`/forms/${form.id}/responses`} className="ui-link rounded-md px-3 py-2 text-xs font-medium">View responses</Link> : <span className="rounded-md bg-[#f3f2ef] px-3 py-2 text-xs text-[#858580]">No responses yet</span>}</div></article>)}</div>}
        </> : <>
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium text-[#777671]">{demoMode ? "Workspace preview" : "Your workspace"}</p><h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[#252523]">{demoMode ? "Good morning" : `Hi, ${user?.name || "there"}`}</h1><p className="mt-1.5 text-[13px] text-[#858580]">A clear view of your forms and responses.</p></div><button onClick={createForm} disabled={createBusy} className="ui-button-primary rounded-lg bg-[#6b63d9] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">{createBusy ? "Creating…" : <>＋ {demoMode ? "Create your first form" : "Create form"}</>}</button></div>
        {actionError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</p>}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[13px] font-semibold text-[#393936]">{demoMode ? "Example forms" : "Your forms"}</h2><span className="text-[11px] text-[#858580]">{filteredForms.length}{filteredForms.length !== forms.length ? ` of ${forms.length}` : ""} forms</span></div>{forms.length > 0 && <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="form-search">Search forms</label><input id="form-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search forms…" className="w-40 rounded-lg border border-[#e3e2de] bg-white px-3 py-2 text-xs outline-none focus:border-[#8b84e8]"/><label className="sr-only" htmlFor="form-status">Filter by status</label><select id="form-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-[#e3e2de] bg-white px-3 py-2 text-xs"><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="CLOSED">Closed</option></select></div>}</div>
        {forms.length === 0 ? <div className="rounded-xl border border-dashed border-[#d9d8d3] bg-white/70 p-12 text-center"><div className="mx-auto grid size-10 place-items-center rounded-lg bg-[#f0efec] text-lg text-[#777671]">＋</div><h3 className="mt-4 text-sm font-semibold">Your first form starts here</h3><p className="mt-1.5 text-xs text-[#858580]">Create a form, add your questions, then publish it to share the link.</p><button onClick={createForm} disabled={createBusy} className="ui-button-primary mt-4 rounded-lg bg-[#6b63d9] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">{createBusy ? "Creating…" : "Create your first form"}</button></div> : filteredForms.length === 0 ? <div className="rounded-xl border border-dashed border-[#d9d8d3] bg-white/70 p-10 text-center"><h3 className="text-sm font-semibold">No forms match those filters</h3><p className="mt-1 text-xs text-[#858580]">Try another name or status.</p><button onClick={() => { setQuery(""); setStatusFilter("ALL"); }} className="ui-link mt-3 rounded-md px-2 py-1 text-xs">Clear filters</button></div> : <div className="overflow-hidden rounded-xl border border-[#e8e7e3] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)]">{filteredForms.map((form, index) => <article key={form.id} className={`group flex flex-col gap-4 px-4 py-4 transition-colors duration-150 hover:bg-[#f8f8fc] sm:flex-row sm:items-center sm:justify-between ${index > 0 ? "border-t border-[#efeeeb]" : ""}`}><Link href={demoMode ? "/login" : `/forms/${form.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-indigo-500"><span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#eeede9] bg-[#f8f8f6] text-sm text-[#73716c]">{form.status === "PUBLISHED" ? <svg aria-label="Published" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="6.5"/><path d="M6.5 10.2 9 12.5l4.7-5"/></svg> : <svg aria-label="Draft" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 14.8 13.8 5a1.6 1.6 0 0 1 2.2 2.2L6.2 17H4z"/><path d="m12.6 6.2 2.2 2.2"/></svg>}</span><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-[#353532] group-hover:text-[#5149c9]">{form.title}</span><span className="mt-1 block text-[11px] text-[#8c8b85]">{form._count.fields} questions <span className="px-1">·</span> Edited {new Date(form.updatedAt).toLocaleDateString()}</span></span></Link><div className="flex items-center gap-3 pl-12 sm:pl-0"><span className={`rounded-md px-2 py-1 text-[10px] font-medium ${form.status === "PUBLISHED" ? "bg-[#edf5ef] text-[#547d5c]" : form.status === "CLOSED" ? "bg-[#efeeeb] text-[#777671]" : "bg-[#f5f0e5] text-[#8a7446]"}`}>{form.status.toLowerCase()}</span><span className="min-w-[72px] text-right text-[11px] text-[#777671]">{form._count.submissions} responses</span>{form.status === "PUBLISHED" && <Link href={`/f/${form.slug}`} title="Open shareable form" className="ui-link inline-flex min-h-9 items-center rounded-md px-2 text-xs sm:opacity-70 sm:group-hover:opacity-100">Share</Link>}</div></article>)}</div>}
        <section className="mt-8 flex flex-col justify-between gap-2 rounded-lg border border-[#e8e7e3] bg-white px-4 py-4 sm:flex-row sm:items-center"><div><p className="text-xs font-medium text-[#393936]">{demoMode ? "Sample workspace" : "Response overview"}</p><p className="mt-1 text-[11px] text-[#858580]">{demoMode ? "Preview only · Sample data is never saved to your account." : "All responses across your forms."}</p></div><p className="text-xl font-semibold tracking-tight text-[#292927]">{responseCount}<span className="ml-2 text-[11px] font-normal text-[#858580]">total responses</span></p></section>
      </>}
      </>}
    </section>
    </div>
  </main>;
}
