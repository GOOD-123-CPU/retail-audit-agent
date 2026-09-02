import {
  appendProjectChat,
  clearProjectChat,
  updateProjectChatFeedback
} from "@/lib/analysis";
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { getWritableProjectForUser, saveProject } from "@/lib/projects";
import { assertRateLimit } from "@/lib/rate-limit";
import { sanitizeQuestion, sanitizeShortText } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "project-chat",
      max: 30,
      windowMs: 10 * 60 * 1000
    });

    const { id } = await context.params;
    const project = await getWritableProjectForUser(id, user);

    if (!project) {
      return badRequest("项目不存在或无权修改。", 404);
    }

    const body = await readJsonBody<{ question?: string }>(request);
    const question = sanitizeQuestion(body.question);

    const nextProject = await appendProjectChat(project, question);
    const savedProject = await saveProject(nextProject);
    return ok({ project: savedProject });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "问答失败。");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "project-chat-feedback",
      max: 60,
      windowMs: 10 * 60 * 1000
    });

    const { id } = await context.params;
    const project = await getWritableProjectForUser(id, user);

    if (!project) {
      return badRequest("项目不存在或无权修改。", 404);
    }

    const body = await readJsonBody<{ messageId?: string; feedback?: "up" | "down" | null }>(
      request
    );
    const messageId = sanitizeShortText(body.messageId, "消息ID", { maxLength: 64 });
    const feedback = body.feedback ?? null;
    if (feedback !== null && !["up", "down"].includes(feedback)) {
      return badRequest("非法反馈类型。");
    }

    const nextProject = updateProjectChatFeedback(project, messageId, feedback);
    const savedProject = await saveProject(nextProject);
    return ok({ project: savedProject });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "保存反馈失败。");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "project-chat-clear",
      max: 10,
      windowMs: 10 * 60 * 1000
    });

    const { id } = await context.params;
    const project = await getWritableProjectForUser(id, user);

    if (!project) {
      return badRequest("项目不存在或无权修改。", 404);
    }

    const clearedProject = clearProjectChat(project);
    const savedProject = await saveProject(clearedProject);
    return ok({ project: savedProject });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "清空问答记录失败。");
  }
}
