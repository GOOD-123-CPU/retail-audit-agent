type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  action: string;
  max: number;
  windowMs: number;
};

const globalState = globalThis as typeof globalThis & {
  __retailAuditRateLimitStore__?: Map<string, RateLimitState>;
};

function store() {
  if (!globalState.__retailAuditRateLimitStore__) {
    globalState.__retailAuditRateLimitStore__ = new Map<string, RateLimitState>();
  }

  return globalState.__retailAuditRateLimitStore__;
}

function clientFingerprintFromRequest(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return `ip:${realIp}`;
  }

  const userAgent = request.headers.get("user-agent")?.trim() || "unknown-agent";
  const language = request.headers.get("accept-language")?.trim() || "unknown-language";
  const platform = request.headers.get("sec-ch-ua-platform")?.trim() || "unknown-platform";
  return `ua:${userAgent}|lang:${language}|platform:${platform}`;
}

export function assertRateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const key = `${options.action}:${clientFingerprintFromRequest(request)}`;
  const limiterStore = store();
  const current = limiterStore.get(key);

  if (!current || current.resetAt <= now) {
    limiterStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs
    });
    return;
  }

  if (current.count >= options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new Error(`请求过于频繁，请在 ${retryAfterSeconds} 秒后再试。`);
  }

  current.count += 1;
  limiterStore.set(key, current);
}
