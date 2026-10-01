import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@formflow/db";

export const clerkEnabled = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export async function getCurrentUser() {
  if (!clerkEnabled) return null;
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const email = clerkUser.emailAddresses.find((address) => address.id === clerkUser.primaryEmailAddressId);
  if (!email || email.verification?.status !== "verified") return null;
  const data = { email: email.emailAddress.toLowerCase(), name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null };
  const existingClerkUser = await prisma.user.findUnique({ where: { clerkId: clerkUser.id } });
  if (existingClerkUser) return prisma.user.update({ where: { id: existingClerkUser.id }, data, select: { id: true, name: true, email: true } });
  const existingEmailUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingEmailUser) {
    if (existingEmailUser.clerkId) throw new Error("This email is already connected to another Clerk account.");
    return prisma.user.update({ where: { id: existingEmailUser.id }, data: { ...data, clerkId: clerkUser.id }, select: { id: true, name: true, email: true } });
  }
  return prisma.user.create({ data: { ...data, clerkId: clerkUser.id }, select: { id: true, name: true, email: true } });
}
