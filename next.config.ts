import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "tesseract.js", "xlsx", "better-sqlite3"],
  // Docker 多阶段构建使用 standalone 产物（详见 Dockerfile）
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false
};

export default nextConfig;
