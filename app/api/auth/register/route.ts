export const dynamic = "force-dynamic";

import { createUser, setSessionCookie, toSessionUser } from "@/lib/auth";
import { canPublicRegister, ensureSystemUsers } from "@/lib/bootstrap";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { sanitizePassword, sanitizeShortText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await ensureSystemUsers();
    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "auth-register",
      max: 4,
      windowMs: 10 * 60 * 1000
    });

    const allowRegister = await canPublicRegister();
    if (!allowRegister) {
      return badRequest("系统已关闭公开注册，请联系管理员创建账号。", 403);
    }

    const body = await readJsonBody<{ email?: string; name?: string; password?: string }>(request);
    const email = sanitizeShortText(body.email, "邮箱", {
      maxLength: 120
    }).toLowerCase();
    const name = sanitizeShortText(body.name || email.split("@")[0], "姓名", {
      maxLength: 40
    });
    const password = sanitizePassword(body.password);

    const user = await createUser({
      email,
      name,
      password
    });

    await setSessionCookie(toSessionUser(user));
    return ok({ user: toSessionUser(user) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "注册失败。");
  }
}
