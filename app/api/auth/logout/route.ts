export const dynamic = "force-dynamic";

import { clearSessionCookie } from "@/lib/auth";
import { assertTrustedMutationRequest, badRequest, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertTrustedMutationRequest(request);
    await clearSessionCookie();
    return ok({ success: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "退出失败。");
  }
}
