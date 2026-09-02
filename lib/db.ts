/**
 * 统一数据访问层：MySQL / SQLite / JSON 文件三模式。
 *
 * - `DATABASE_PROVIDER=mysql`（默认）：完整功能，适合生产与多人协作；
 * - `DATABASE_PROVIDER=sqlite`：零外部依赖，单文件存储，适合本地体验与小团队；
 * - 其他值（如 `json`）：纯文件存储兜底。
 *
 * 所有上层调用方只使用 queryRows / executeStatement / testDatabaseConnection /
 * initializeDatabaseSchema / closeDatabasePool / isDatabaseEnabled，
 * 不感知底层是 MySQL 还是 SQLite。SQL 均使用 `?` 占位符（两种引擎兼容）。
 */

import fs from "node:fs/promises";
import path from "node:path";

import mysql, { Pool, ResultSetHeader } from "mysql2/promise";

import { env } from "@/lib/env";

export type DatabaseProvider = "mysql" | "sqlite" | "json";

export function activeProvider(): DatabaseProvider {
  if (env.databaseProvider === "mysql" || env.databaseProvider === "sqlite") {
    return env.databaseProvider;
  }
  return "json";
}

/** 数据层是否启用（json 模式下上层自动回退到文件存储）。 */
export function isDatabaseEnabled() {
  return activeProvider() !== "json";
}

let pool: Pool | null = null;
let sqliteDb: import("better-sqlite3").Database | null = null;
let sqliteInitPromise: Promise<boolean> | null = null;

function sqliteFilePath() {
  return env.sqlitePath || path.join(process.cwd(), "data", "retail-audit.db");
}

/** SQLite 表结构（与 db/schema.sql 的 MySQL 版字段一致，索引按需精简）。 */
const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  owner_id VARCHAR(64),
  company_name VARCHAR(191),
  risk_count INTEGER NOT NULL DEFAULT 0,
  high_risk_count INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rule_configs (
  id VARCHAR(64) PRIMARY KEY,
  risk_code VARCHAR(128) NOT NULL UNIQUE,
  title VARCHAR(191) NOT NULL,
  category VARCHAR(128),
  is_enabled INTEGER NOT NULL DEFAULT 1,
  definition_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vector_chunks (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  record_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(255),
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content_text TEXT,
  embedding_json TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_project ON vector_chunks(project_id);
CREATE TABLE IF NOT EXISTS workpaper_templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  template_markdown TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS workpapers (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64),
  title VARCHAR(191),
  content_markdown TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  payload_json TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_workpapers_project ON workpapers(project_id);
CREATE TABLE IF NOT EXISTS approval_requests (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  payload_json TEXT,
  created_at TEXT,
  updated_at TEXT
);
`;

async function getSqlite() {
  if (sqliteDb) {
    return sqliteDb;
  }

  const { default: Database } = await import("better-sqlite3");
  const file = sqliteFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  sqliteDb = new Database(file);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.exec(SQLITE_SCHEMA);
  return sqliteDb;
}

async function ensureSqliteReady() {
  if (!sqliteInitPromise) {
    sqliteInitPromise = getSqlite().then(() => true);
  }
  return sqliteInitPromise;
}

function toMysqlStyle(sql: string) {
  // 统一把 `field_name` 风格的 MySQL 列名引用留给调用方；
  // SQLite 接受与 MySQL 相同的 `?` 占位符，无需改写。
  return sql;
}

function getMysqlPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.mysqlHost,
      port: env.mysqlPort,
      user: env.mysqlUser,
      password: env.mysqlPassword,
      database: env.mysqlDatabase,
      charset: "utf8mb4",
      connectionLimit: 10,
      namedPlaceholders: false,
      decimalNumbers: true
    });
  }
  return pool;
}

export async function queryRows<T>(sql: string, values: unknown[] = []): Promise<T> {
  if (activeProvider() === "sqlite") {
    await ensureSqliteReady();
    const db = await getSqlite();
    const stmt = db.prepare(toMysqlStyle(sql));
    return (values.length > 0 ? stmt.all(...values) : stmt.all()) as T;
  }

  const currentPool = getMysqlPool();
  const [rows] = await currentPool.query(sql, values as never[]);
  return rows as T;
}

export async function executeStatement(sql: string, values: unknown[] = []) {
  if (activeProvider() === "sqlite") {
    await ensureSqliteReady();
    const db = await getSqlite();
    const stmt = db.prepare(toMysqlStyle(sql));
    const info = values.length > 0 ? stmt.run(...values) : stmt.run();
    return { affectedRows: info.changes, insertId: Number(info.lastInsertRowid) } as ResultSetHeader;
  }

  const currentPool = getMysqlPool();
  const [result] = await currentPool.execute(sql, values as never[]);
  return result as ResultSetHeader;
}

export async function testDatabaseConnection() {
  if (!isDatabaseEnabled()) {
    return false;
  }

  try {
    if (activeProvider() === "sqlite") {
      await ensureSqliteReady();
      const db = await getSqlite();
      db.prepare("SELECT 1").get();
      return true;
    }

    await getMysqlPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function initializeDatabaseSchema() {
  if (activeProvider() === "sqlite") {
    await ensureSqliteReady();
    return;
  }

  if (activeProvider() !== "mysql") {
    return;
  }

  const adminPool = mysql.createPool({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    charset: "utf8mb4",
    connectionLimit: 2
  });

  try {
    await adminPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.mysqlDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
    );
  } finally {
    await adminPool.end();
  }

  const sql = await fs.readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  const currentPool = getMysqlPool();
  for (const statement of sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((item) => item.trim())
    .filter(Boolean)) {
    await currentPool.query(statement);
  }
}

export async function closeDatabasePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    sqliteInitPromise = null;
  }
}
