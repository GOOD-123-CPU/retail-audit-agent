"use client";

import { useState, useTransition } from "react";

type RuleConfigItem = {
  id: string;
  riskCode: string;
  title: string;
  category: string;
  isEnabled: boolean;
  definition: {
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
  };
};

export function RuleAdminPanel({
  initialRules
}: {
  initialRules: RuleConfigItem[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function save(rule: RuleConfigItem) {
    const response = await fetch("/api/admin/rules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(rule)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "保存规则失败。");
      return;
    }

    setRules(result.rules);
    setMessage(`规则 ${rule.riskCode} 已保存。`);
  }

  return (
    <section className="card stack">
      <div className="card__header">
        <div>
          <h3>规则配置后台</h3>
          <p className="muted">支持启停规则、维护关键词、摘要模板与主要审计逻辑，修改后立即进入规则库。</p>
        </div>
      </div>
      {message ? <div className="pill">{message}</div> : null}
      <div className="record-list">
        {rules.map((rule) => (
          <article className="card card--embedded stack" key={rule.id}>
            <div className="split">
              <div>
                <strong>{rule.riskCode}</strong>
                <p className="muted">
                  {rule.title} 路 {rule.category}
                </p>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                启用
                <input
                  checked={rule.isEnabled}
                  onChange={(event) => {
                    setRules((current) =>
                      current.map((item) =>
                        item.id === rule.id ? { ...item, isEnabled: event.target.checked } : item
                      )
                    );
                  }}
                  type="checkbox"
                />
              </label>
            </div>
            <label className="label">
              关键词
              <textarea
                className="textarea"
                onChange={(event) => {
                  const values = event.target.value
                    .split(/[，\n]/)
                    .map((item) => item.trim())
                    .filter(Boolean);
                  setRules((current) =>
                    current.map((item) =>
                      item.id === rule.id
                        ? {
                            ...item,
                            definition: { ...item.definition, triggerKeywords: values }
                          }
                        : item
                    )
                  );
                }}
                value={rule.definition.triggerKeywords.join("，")}
              />
            </label>
            <label className="label">
              摘要模板
              <textarea
                className="textarea"
                onChange={(event) => {
                  setRules((current) =>
                    current.map((item) =>
                      item.id === rule.id
                        ? {
                            ...item,
                            definition: { ...item.definition, summaryTemplate: event.target.value }
                          }
                        : item
                    )
                  );
                }}
                value={rule.definition.summaryTemplate}
              />
            </label>
            <div className="pill-row">
              {rule.definition.financialSignals.map((item) => (
                <span className="pill" key={`${rule.id}_${item}`}>
                  {item}
                </span>
              ))}
            </div>
            <button
              className="button button--primary"
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  void save(rules.find((item) => item.id === rule.id) ?? rule);
                });
              }}
              type="button"
            >
              保存规则
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
