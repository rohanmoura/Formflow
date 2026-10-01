import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/app-user";

export default function RegisterPage() {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,_#efedff_0%,_#f7f7f5_38%,_#f7f7f5_100%)] px-5 py-12"><section className="flex w-full max-w-[440px] flex-col items-center"><Link href="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-lg bg-[#6b63d9] text-white shadow-sm">f</span>formflow</Link>{clerkEnabled ? <SignUp routing="hash" signInUrl="/login" forceRedirectUrl="/" /> : <div className="rounded-xl border border-[#e8e7e3] bg-white p-7 text-center shadow-sm"><h1 className="text-lg font-semibold">Sign-up is being set up</h1><p className="mt-2 text-sm text-[#777671]">Clerk is not configured for this environment. Add your Clerk keys to enable sign-up.</p></div>}</section></main>;
}
