# 贡献指南 / Contributing

感谢你对本项目的关注！欢迎通过 Issue 和 Pull Request 参与贡献。

## 提交 Issue

- **Bug 报告**：请附上复现步骤、期望行为、实际行为，以及运行环境（OS / Node 版本 / 是否启用 MySQL）。
- **功能建议**：请说明使用场景与预期收益。
- **安全漏洞**：请勿公开发布 Issue，按 [SECURITY.md](./SECURITY.md) 私密报告。

## 开发流程

```bash
git clone <your-fork>
cd retail-audit-agent
npm install
cp .env.example .env.local   # 本地配置，勿提交
npm run dev
```

### 分支命名

- `feat/xxx` — 新功能
- `fix/xxx` — 缺陷修复
- `docs/xxx` — 文档改进

### 提交信息

遵循 Conventional Commits 风格：

```
feat: 新增批量分析并发控制
fix: 修复审批历史时区显示错误
docs: 补充向量检索说明
```

### 提交前自查

- [ ] `npm run check`（TypeScript 类型检查）通过
- [ ] `npm run build` 通过
- [ ] 新增/变更逻辑有必要的错误处理与降级路径
- [ ] 未引入任何密钥、密码、真实公司数据
- [ ] 中文注释与文案保持统一风格

## 代码约定

- TypeScript 严格模式，优先复用 `lib/` 内既有工具函数。
- 服务端输入一律校验（复用 `lib/validation.ts`），错误走 `lib/http.ts` 统一响应。
- 涉及数据库的操作必须保留 JSON 文件回退路径，保证零 MySQL 可运行。
- 演示数据一律使用虚构公司名，禁止引入真实企业或个人信息。

## 许可

提交即表示你同意其贡献以 [MIT](./LICENSE) 许可发布。
