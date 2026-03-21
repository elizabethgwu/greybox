"use client";

import { useEffect, useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  maxLines?: number;
  className?: string;
}

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  tsx: "typescript",
  jsx: "javascript",
};

function normaliseLang(lang: string): string {
  const lower = lang.toLowerCase();
  return LANG_ALIASES[lower] ?? lower;
}

export default function CodeBlock({ code, language = "javascript", maxLines, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const lang = normaliseLang(language);

  const lines = code.split("\n");
  const truncated = maxLines !== undefined && lines.length > maxLines;
  const visible = truncated ? lines.slice(0, maxLines).join("\n") : code;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prism = (window as any).Prism;
    if (!prism) return;
    const grammar = prism.languages[lang] ?? prism.languages.clike ?? null;
    if (!grammar) {
      setHtml(null);
      return;
    }
    setHtml(prism.highlight(visible, grammar, lang));
  }, [visible, lang]);

  return (
    <div className={`overflow-x-auto ${className ?? ""}`}>
      <pre
        className="!m-0 !p-0 !bg-transparent text-[11px] leading-[1.65] font-mono"
        style={{ background: "transparent" }}
      >
        <code
          className={`language-${lang}`}
          dangerouslySetInnerHTML={html ? { __html: html } : undefined}
        >
          {html ? undefined : visible}
        </code>
      </pre>
      {truncated && (
        <p className="text-[9px] font-mono text-[#555] pt-1">
          …{lines.length - maxLines!} more lines
        </p>
      )}
    </div>
  );
}
