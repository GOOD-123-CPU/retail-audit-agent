import crypto from "node:crypto";

import { cleanText } from "@/lib/cleaners";
import { RULES } from "@/lib/rules";
import { queryRows, executeStatement, isDatabaseEnabled } from "@/lib/db";
import {
  ProjectData,
  ProjectListItem,
  Role,
  RuleDefinition,
  UserRecord
} from "@/lib/types";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  company_name: string;
  fiscal_year: string;
  industry: string;
  status: ProjectData["status"];
  summary: string;
  risk_count: number;
  high_risk_count: number;
  payload_json: string;
  report_markdown: string;
  created_at: string;
  updated_at: string;
};

type RuleRow = {
  id: string;
  risk_code: string;
  title: string;
  category: string;
  is_enabled: number;
  config_json: string;
  created_at: string;
  updated_at: string;
};

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: cleanText(row.email, { maxLength: 120, preserveNewlines: false }),
    name: cleanText(row.name, { maxLength: 80 }),
    role: row.role,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined
  };
}

export async function readUsersFromDatabase() {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    const rows = await queryRows<UserRow[]>(
      "SELECT * FROM users ORDER BY created_at ASC"
    );
    return rows.map(toUserRecord);
  } catch {
    return null;
  }
}

export async function writeUsersToDatabase(users: UserRecord[]) {
  if (!isDatabaseEnabled()) {
    return false;
  }

  try {
    for (const user of users) {
      await executeStatement(
        `INSERT INTO users (
        id, email, name, role, password_hash, password_salt, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        name = VALUES(name),
        role = VALUES(role),
        password_hash = VALUES(password_hash),
        password_salt = VALUES(password_salt),
        updated_at = VALUES(updated_at),
        last_login_at = VALUES(last_login_at)`,
      [
        user.id,
        user.email,
        user.name,
        user.role,
        user.passwordHash,
        user.passwordSalt,
        user.createdAt.slice(0, 19).replace("T", " "),
        user.updatedAt.slice(0, 19).replace("T", " "),
        user.lastLoginAt ? user.lastLoginAt.slice(0, 19).replace("T", " ") : null
        ]
      );
    }

    return true;
  } catch {
    return false;
  }
}

export async function readProjectsFromDatabase() {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    const rows = await queryRows<ProjectRow[]>(
      "SELECT * FROM projects ORDER BY updated_at DESC"
    );

    return rows.map((row) => JSON.parse(row.payload_json) as ProjectData);
  } catch {
    return null;
  }
}

export async function readProjectByIdFromDatabase(projectId: string) {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    const rows = await queryRows<ProjectRow[]>(
      "SELECT * FROM projects WHERE id = ? LIMIT 1",
      [projectId]
    );

    if (rows.length === 0) {
      return null;
    }

    return JSON.parse(rows[0].payload_json) as ProjectData;
  } catch {
    return null;
  }
}

export async function writeProjectToDatabase(project: ProjectData) {
  if (!isDatabaseEnabled()) {
    return false;
  }

  try {
    await executeStatement(
    `INSERT INTO projects (
      id, owner_id, name, company_name, fiscal_year, industry, status, summary,
      risk_count, high_risk_count, payload_json, report_markdown, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      owner_id = VALUES(owner_id),
      name = VALUES(name),
      company_name = VALUES(company_name),
      fiscal_year = VALUES(fiscal_year),
      industry = VALUES(industry),
      status = VALUES(status),
      summary = VALUES(summary),
      risk_count = VALUES(risk_count),
      high_risk_count = VALUES(high_risk_count),
      payload_json = VALUES(payload_json),
      report_markdown = VALUES(report_markdown),
      updated_at = VALUES(updated_at)`,
    [
      project.id,
      project.ownerId,
      project.name,
      project.companyName,
      project.year,
      project.industry,
      project.status,
      project.summary,
      project.risks.length,
      project.risks.filter((risk) => risk.severity === "high").length,
      JSON.stringify(project),
      project.reportMarkdown,
      project.createdAt.slice(0, 19).replace("T", " "),
      project.updatedAt.slice(0, 19).replace("T", " ")
      ]
    );

    return true;
  } catch {
    return false;
  }
}

export async function listProjectItemsFromDatabase(ownerId?: string) {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const sql = ownerId
    ? "SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC"
    : "SELECT * FROM projects ORDER BY updated_at DESC";
  try {
    const rows = await queryRows<ProjectRow[]>(sql, ownerId ? [ownerId] : []);

    return rows.map<ProjectListItem>((row) => ({
      id: row.id,
      name: cleanText(row.name, { maxLength: 160 }),
      companyName: cleanText(row.company_name, { maxLength: 191 }),
      year: cleanText(row.fiscal_year, { maxLength: 16, preserveNewlines: false }),
      industry: cleanText(row.industry, { maxLength: 80 }),
      ownerId: row.owner_id,
      updatedAt: new Date(row.updated_at).toISOString(),
      riskCount: row.risk_count,
      highRiskCount: row.high_risk_count,
      status: row.status
    }));
  } catch {
    return null;
  }
}

export async function ensureRuleConfigsInDatabase() {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    for (const rule of RULES) {
      await executeStatement(
      `INSERT INTO rule_configs (
        id, risk_code, title, category, is_enabled, config_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        category = VALUES(category),
        config_json = VALUES(config_json),
        updated_at = NOW()`,
      [
        crypto.createHash("md5").update(rule.riskCode).digest("hex"),
        rule.riskCode,
        rule.title,
        rule.category,
        JSON.stringify(rule)
        ]
      );
    }
  } catch {
    return;
  }
}

export async function readRuleConfigsFromDatabase() {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    const rows = await queryRows<RuleRow[]>(
      "SELECT * FROM rule_configs ORDER BY risk_code ASC"
    );

    return rows.map((row) => ({
      id: row.id,
      riskCode: cleanText(row.risk_code, { maxLength: 128, preserveNewlines: false }),
      title: cleanText(row.title, { maxLength: 191 }),
      category: cleanText(row.category, { maxLength: 128 }),
      isEnabled: row.is_enabled === 1,
      definition: JSON.parse(row.config_json) as RuleDefinition
    }));
  } catch {
    return null;
  }
}

export async function saveRuleConfigToDatabase(input: {
  riskCode: string;
  title: string;
  category: string;
  isEnabled: boolean;
  definition: RuleDefinition;
}) {
  if (!isDatabaseEnabled()) {
    return false;
  }

  try {
    await executeStatement(
    `INSERT INTO rule_configs (
      id, risk_code, title, category, is_enabled, config_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      category = VALUES(category),
      is_enabled = VALUES(is_enabled),
      config_json = VALUES(config_json),
      updated_at = NOW()`,
    [
      crypto.createHash("md5").update(input.riskCode).digest("hex"),
      input.riskCode,
      input.title,
      input.category,
      input.isEnabled ? 1 : 0,
      JSON.stringify(input.definition)
      ]
    );

    return true;
  } catch {
    return false;
  }
}
