import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerkConfigured = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default clerkConfigured
  ? clerkMiddleware({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY })
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|pdf|zip|webmanifest)).*)", "/(api|trpc)(.*)", "/__clerk/(.*)"]
};
