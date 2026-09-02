import ReactMarkdown from "react-markdown";

export function ReportView({ markdown }: { markdown: string }) {
  return (
    <div className="report-markdown">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
