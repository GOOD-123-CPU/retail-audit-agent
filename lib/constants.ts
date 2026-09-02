import { Permission, Role } from "@/lib/types";

export const SESSION_COOKIE_NAME = "retail_audit_session";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "users.manage",
    "projects.create",
    "projects.read:any",
    "projects.read:own",
    "projects.write:any",
    "projects.write:own",
    "reports.read:any",
    "reports.read:own"
  ],
  user: [
    "projects.create",
    "projects.read:own",
    "projects.write:own",
    "reports.read:own"
  ]
};

export const PROJECT_RECORD_CATEGORIES = [
  { value: "financials", label: "财务资料 / 台账" },
  { value: "documents", label: "票据 / 单据" },
  { value: "contracts", label: "合同 / 协议" },
  { value: "invoices", label: "发票 / 结算单" },
  { value: "operations", label: "经营 / 运营资料" },
  { value: "other", label: "其他" }
] as const;
