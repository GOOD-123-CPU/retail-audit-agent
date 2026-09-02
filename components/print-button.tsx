"use client";

export function PrintButton() {
  return (
    <button className="button button--primary" onClick={() => window.print()} type="button">
      打印 / 导出 PDF
    </button>
  );
}
