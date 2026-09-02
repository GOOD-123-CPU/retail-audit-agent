import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth-screen";
import { getCurrentUser } from "@/lib/auth";
import { canPublicRegister, ensureSystemUsers } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  await ensureSystemUsers();
  const user = await getCurrentUser();

  if (user) {
    redirect("/projects");
  }

  const allowRegister = await canPublicRegister();
  return <AuthScreen allowRegister={allowRegister} />;
}
