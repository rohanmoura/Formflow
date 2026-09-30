const examples = [
  { title: "Customer feedback", detail: "8 questions · Updated 2 hours ago", responses: "128", color: "lavender" },
  { title: "Workshop registration", detail: "5 questions · Updated yesterday", responses: "64", color: "mint" },
  { title: "Product research", detail: "12 questions · Updated Monday", responses: "37", color: "peach" }
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-12">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#5b5bd6] text-white">f</span>formflow</a>
        <div className="flex items-center gap-3"><button className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600">Sign in</button><button className="rounded-lg bg-[#5b5bd6] px-4 py-2 text-sm font-semibold text-white shadow-sm">Create account</button></div>
      </nav>
      <section className="mx-auto mt-16 max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#5b5bd6]">Your workspace</p><h1 className="text-4xl font-bold tracking-tight md:text-5xl">Good morning, Rohan <span aria-hidden="true">✳</span></h1><p className="mt-3 text-lg text-slate-500">Make a form. Share your link. Get the answers.</p></div>
          <button className="rounded-xl bg-[#5b5bd6] px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-200">＋ Create a form</button>
        </div>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Recent forms</h2><button className="text-sm font-semibold text-[#5b5bd6]">View all →</button></div>
        <div className="grid gap-4 md:grid-cols-3">{examples.map((form) => <article key={form.title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className={`mb-5 grid h-28 place-items-center rounded-xl ${form.color === "lavender" ? "bg-indigo-50" : form.color === "mint" ? "bg-emerald-50" : "bg-orange-50"}`}><div className="w-2/3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="h-2 w-2/3 rounded bg-slate-200"/><div className="h-2 w-full rounded bg-slate-100"/><div className="h-5 w-1/2 rounded border border-slate-200"/></div></div><h3 className="font-bold">{form.title}</h3><p className="mt-1 text-sm text-slate-500">{form.detail}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Published</span><span className="text-sm text-slate-600">↗ {form.responses} responses</span></div></article>)}</div>
        <section className="mt-12 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-7 md:flex md:items-center md:justify-between"><div><p className="text-sm font-semibold text-[#5b5bd6]">A little progress goes a long way</p><h2 className="mt-2 text-2xl font-bold">You’ve collected 229 responses</h2><p className="mt-1 text-slate-500">Your forms are out there doing the asking.</p></div><div className="mt-5 flex -space-x-2 md:mt-0"><span className="grid size-10 place-items-center rounded-full border-2 border-white bg-amber-100">😊</span><span className="grid size-10 place-items-center rounded-full border-2 border-white bg-rose-100">🙂</span><span className="grid size-10 place-items-center rounded-full border-2 border-white bg-sky-100">👋</span><span className="grid size-10 place-items-center rounded-full border-2 border-white bg-[#5b5bd6] text-xs font-bold text-white">+226</span></div></section>
      </section>
      <footer className="mx-auto mt-16 max-w-6xl border-t border-slate-200 py-6 text-sm text-slate-400">FormFlow · Thoughtful forms, clearer answers.</footer>
    </main>
  );
}
