import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "FormFlow — Forms, without the fuss",
  description: "Create a form, share one link, and keep every response organized."
};

export const viewport: Viewport = { themeColor: "#f7f7f5" };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = <html lang="en"><body>{children}</body></html>;
  return process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
    ? <ClerkProvider publishableKey={process.env.CLERK_PUBLISHABLE_KEY}>{content}</ClerkProvider>
    : content;
}
