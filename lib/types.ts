export type Role = "admin" | "user";

export type ProjectCategory =
  | "financials"
  | "documents"
  | "contracts"
  | "invoices"
  | "operations"
  | "other";

export type Severity = "high" | "medium" | "low";
export type ParserType = "xlsx" | "csv" | "pdf" | "ocr" | "text";
export type ExtractedFieldConfidence = "high" | "medium" | "low";

export type Permission =
  | "users.manage"
  | "projects.create"
  | "projects.read:any"
  | "projects.read:own"
  | "projects.write:any"
  | "projects.write:own"
  | "reports.read:any"
  | "reports.read:own";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: ExtractedFieldConfidence;
  sourceSnippet: string;
}

export interface StructuredRow {
  [key: string]: string | number | null;
}

export interface ExtractedRecord {
  id: string;
  category: ProjectCategory;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  storedPath: string;
  parser: ParserType;
  text: string;
  structuredRows: StructuredRow[];
  extractedFields: ExtractedField[];
  encodingFixed: boolean;
}

export interface RiskEvidence {
  recordId: string;
  fileName: string;
  summary: string;
  sourceType: "text" | "structured" | "document";
  sourceExcerpt?: string;
}

export interface RiskHit {
  id: string;
  riskCode: string;
  title: string;
  severity: Severity;
  score: number;
  category: string;
  matchedKeywords: string[];
  financialSignals: string[];
  nonFinancialSignals: string[];
  validationLogic: string[];
  auditStandard: string;
  auditProcedures: string[];
  summary: string;
  evidence: RiskEvidence[];
  aiExplanation: string;
  createdAt: string;
}

export interface ProjectMetricSnapshot {
  revenueGrowthRate: number;
  returnRate: number;
  receivableGrowthRate: number;
  inventoryGrowthRate: number;
  inventoryTurnoverDays: number;
  grossMargin: number;
  /** 毛利率月度趋势斜率（每期平均变化，正为上升、负为下滑），无月度序列时为 0。 */
  grossMarginTrend: number;
  storeGrowthRate: number;
  revenuePerStoreGrowthRate: number;
  rebateExpenseRate: number;
  marketingExpenseRate: number;
  /** 返利 + 市场费用合计占收入比。 */
  totalExpenseRate: number;
  /** 应收周转天数（期末口径，按月均收入折算）。 */
  receivableTurnoverDays: number;
  signals: string[];
  notes: string[];
}

export interface ProjectChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  meta?: ProjectChatMeta;
}

export interface ProjectChatCitation {
  riskId: string;
  riskCode: string;
  riskTitle: string;
  fileName: string;
  summary: string;
  severity: Severity;
  score: number;
}

export interface ProjectChatRetrievalItem {
  id: string;
  type: "rule" | "vector";
  title: string;
  detail: string;
  fileName?: string;
  riskCode?: string;
  score?: number;
}

export interface ProjectChatMeta {
  confidence: "high" | "medium" | "low";
  insufficient: boolean;
  answeredBy: "ai" | "fallback";
  relatedRiskCodes: string[];
  citations: ProjectChatCitation[];
  suggestedQuestions: string[];
  retrievals: ProjectChatRetrievalItem[];
  feedback?: "up" | "down" | null;
}

export interface ProjectData {
  id: string;
  name: string;
  companyName: string;
  year: string;
  industry: string;
  ownerId: string;
  status: "draft" | "analyzed";
  createdAt: string;
  updatedAt: string;
  summary: string;
  records: ExtractedRecord[];
  risks: RiskHit[];
  metrics: ProjectMetricSnapshot;
  reportMarkdown: string;
  conversation: ProjectChatMessage[];
}

export interface ProjectListItem {
  id: string;
  name: string;
  companyName: string;
  year: string;
  industry: string;
  ownerId: string;
  updatedAt: string;
  riskCount: number;
  highRiskCount: number;
  status: ProjectData["status"];
}

export interface RuleDefinition {
  riskCode: string;
  title: string;
  category: string;
  triggerKeywords: string[];
  financialSignals: string[];
  nonFinancialSignals: string[];
  validationLogic: string[];
  auditStandard: string;
  auditProcedures: string[];
  summaryTemplate: string;
}
