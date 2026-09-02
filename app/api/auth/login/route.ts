export const dynamic = "force-dynamic";

import { authenticateUser, setSessionCookie, toSessionUser } from "@/lib/auth";
import { ensureSystemUsers } from "@/lib/bootstrap";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { sanitizePassword, sanitizeShortText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await ensureSystemUsers();
    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "auth-login",
      max: 8,
      windowMs: 10 * 60 * 1000
    });

    const body = await readJsonBody<{ email?: string; password?: string }>(request);
    const email = sanitizeShortText(body.email, "邮箱", {
      maxLength: 120
    }).toLowerCase();
    const password = sanitizePassword(body.password);

    const user = await authenticateUser(email, password);
    if (!user) {
      return badRequest("邮箱或密码错误。", 401);
    }

    await setSessionCookie(toSessionUser(user));
    return ok({ user: toSessionUser(user) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "登录失败。");
  }
}
