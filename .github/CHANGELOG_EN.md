# 更新日志

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Report charts (monthly trends, risk matrix)
- English UI (i18n)
- OIDC / WeCom SSO

## [1.2.0] - 2026-09-02

### Added

- **SQLite storage mode** (`DATABASE_PROVIDER=sqlite`) with zero external
  dependencies; data layer unified into MySQL / SQLite / JSON provider interface
- **Docker deployment**: multi-stage Dockerfile (standalone output, non-root
  user, healthcheck), docker-compose with optional MySQL profile
- **Health endpoint** `GET /api/health`
- **User management center** `/admin/users` with create / role / delete and
  last-admin & self-delete protection
- **Rules engine expanded to 8 rules**: margin deterioration, return anomaly,
  revenue quality, expense anomaly
- **New financial signals**: gross-margin trend slope, return-rate half-period
  comparison, receivable turnover days, total expense rate
- **Unit test suite** (Vitest, 46 cases) covering rules, vector search,
  encoding, HTTP security, rate limit, validation, permissions, document
  extraction and analysis orchestration
- CI test gate; `test:coverage` script

### Fixed

- **Mojibake repair never worked** (critical): `stripControlChars` stripped
  C1 control characters (U+0080–009F) which are part of latin1 double-encoded
  garbled text, destroying data before the repair logic ran. Regression test added

### Changed

- AI requests: 25s timeout (AbortController), exponential backoff retry on
  408/429/5xx, immediate model switch on timeout
- Model fallback chain configurable via `QWEN_FALLBACK_MODELS`
- Risk AI explanations run with bounded concurrency (3) instead of serially
- User administration moved out of the projects page into its own section

## [1.1.0] - 2026-09-02

### Added

- Open-source repository infrastructure: MIT LICENSE, bilingual README,
  CONTRIBUTING / SECURITY / CODE_OF_CONDUCT, GitHub templates, Actions CI

### Security

- Fail-fast `JWT_SECRET` validation in production (>= 16 chars)
- Removed hardcoded third-party AI gateway / database password defaults;
  default AI endpoint switched to official DashScope compatible mode
- All demo data fictionalized; runtime data directories excluded from VCS

### Changed

- Demo passwords updated to `AdminDemo_2026` / `CompanyDemo_2026`

## [1.0.0] - 2026-04

### Initial release

- Next.js 15 + React 19 + TypeScript retail audit workbench
- Rule-driven risk detection, Qwen-compatible AI explanation & Q&A,
  multi-format document parsing (xlsx/csv/pdf/OCR), lightweight vector search,
  approval workflow, audit working papers, Markdown reports
- MySQL with automatic JSON-file fallback

[unreleased]: https://github.com/GOOD-123-CPU/retail-audit-agent/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/GOOD-123-CPU/retail-audit-agent/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/GOOD-123-CPU/retail-audit-agent/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/GOOD-123-CPU/retail-audit-agent/releases/tag/v1.0.0
