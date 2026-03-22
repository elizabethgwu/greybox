"use client";

import { useEffect, useRef } from "react";
import { AnalysisResult, NODE_CONFIG, CodeNode } from "@/lib/types";

declare global {
  interface Window {
    Prism: {
      highlight: (code: string, grammar: unknown, language: string) => string;
      languages: Record<string, unknown>;
    };
  }
}

interface CodePanelProps {
  submittedCode: string | null;
  analysis: AnalysisResult | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  highlightedVariable?: string | null;
  colorblindMode?: boolean;
}

function getLanguageAlias(lang: string): string {
  const map: Record<string, string> = {
    javascript: "javascript", typescript: "typescript", python: "python",
    py: "python", js: "javascript", ts: "typescript", rust: "rust",
    go: "go", java: "java", cpp: "cpp", "c++": "cpp", c: "c",
    css: "css", html: "html", bash: "bash", sh: "bash", json: "json", sql: "sql",
  };
  return map[lang?.toLowerCase()] || "javascript";
}

function HighlightedLine({ code, language }: { code: string; language: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current && typeof window !== "undefined" && window.Prism) {
      const grammar = window.Prism.languages[language];
      if (grammar) {
        ref.current.innerHTML = window.Prism.highlight(code || " ", grammar, language);
      } else {
        ref.current.textContent = code || " ";
      }
    }
  }, [code, language]);
  return <code ref={ref} className={`language-${language}`}>{code || " "}</code>;
}

export default function CodePanel({ submittedCode, analysis, selectedNodeId, onNodeSelect, highlightedVariable, colorblindMode }: CodePanelProps) {
  const code = submittedCode ?? "";
  const language = analysis?.language ? getLanguageAlias(analysis.language) : "javascript";
  const lines = code.split("\n");

  const lineNodeMap = new Map<number, CodeNode[]>();
  if (analysis) {
    analysis.nodes.forEach((node) => {
      for (let i = node.codeRange.startLine; i <= node.codeRange.endLine; i++) {
        const existing = lineNodeMap.get(i) || [];
        existing.push(node);
        lineNodeMap.set(i, existing);
      }
    });
  }

  const decisionAnnotations = analysis
    ? analysis.nodes.filter((n) => n.type === "decision" && n.decision).map((n) => ({ node: n, line: n.codeRange.startLine }))
    : [];

  const getLineHighlight = (lineNum: number) => {
    const nodes = lineNodeMap.get(lineNum);
    if (!nodes || nodes.length === 0) return null;
    const type = nodes[0].type;
    const colorVar = `var(--accent-${type})`;
    return { ...NODE_CONFIG[type], colorVar };
  };

  const getNodeForLine = (lineNum: number): CodeNode | undefined => {
    return lineNodeMap.get(lineNum)?.[0];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#222] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#999]">{analysis?.language ?? "code"}</span>
          <span className="text-[#888]">|</span>
          <span className="text-xs text-[#999]">{lines.length} lines</span>
        </div>
        {analysis && (
          <div className="flex items-center gap-3">
            {(Object.entries(NODE_CONFIG) as [string, typeof NODE_CONFIG.scope][]).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: `var(--accent-${key})` }}>{cfg.icon}</span>
                <span className="text-[10px] font-mono text-[#888]">{cfg.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto font-mono text-sm leading-6">
        <div className="relative">
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const highlight = getLineHighlight(lineNum);
            const node = getNodeForLine(lineNum);
            const isBlockStart = node && node.codeRange.startLine === lineNum;
            const annotation = decisionAnnotations.find((a) => a.line === lineNum);

            const lineNodes = lineNodeMap.get(lineNum);
            const isThisNodeSelected = selectedNodeId
              ? lineNodes?.some((n) => n.id === selectedNodeId) ?? false
              : true;
            const dimmed = !!(selectedNodeId && !isThisNodeSelected);

            // Variable highlight: glow lines in selected node's range that contain the var name
            const varHighlight =
              highlightedVariable &&
              isThisNodeSelected &&
              !dimmed &&
              line.includes(highlightedVariable);

            return (
              <div key={i} style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 0.15s" }}>
                {annotation && annotation.node.decision && (
                  <div
                    className="flex items-center gap-2 px-4 py-1.5 text-xs border-l-2 ml-12 mr-4 my-1 rounded-r"
                    style={{ borderColor: "var(--accent-decision)", background: "color-mix(in srgb, var(--accent-decision) 7%, transparent)" }}
                  >
                    <span style={{ color: "var(--accent-decision)" }}>⟐</span>
                    <span className="text-[#888]">
                      <strong className="text-[#ccc] font-medium">Decision:</strong>{" "}
                      {annotation.node.decision.chose}
                      <span className="text-[#999]"> — {annotation.node.decision.because}</span>
                    </span>
                  </div>
                )}
                {isBlockStart && highlight && node && (
                  <div
                    className={`flex items-center gap-1.5 px-4 py-0.5 ml-12 ${analysis ? "cursor-pointer" : ""}`}
                    style={{ color: highlight.colorVar }}
                    onClick={() => { if (analysis) onNodeSelect(node.id === selectedNodeId ? null : node.id); }}
                  >
                    <span className="text-[10px]">{highlight.icon}</span>
                    <span className="text-[10px] font-mono tracking-wider opacity-70">{node.label.toUpperCase()}</span>
                  </div>
                )}
                <div
                  className={`flex items-start group transition-colors ${analysis ? "cursor-pointer" : ""} ${highlight ? "hover:bg-white/5" : "hover:bg-white/[0.02]"}`}
                  style={{
                    background: varHighlight
                      ? `color-mix(in srgb, var(--accent-decision) 18%, ${highlight ? `color-mix(in srgb, ${highlight.colorVar} 10%, transparent)` : "transparent"})`
                      : highlight
                      ? `color-mix(in srgb, ${highlight.colorVar} ${isThisNodeSelected ? 10 : 5}%, transparent)`
                      : undefined,
                    borderLeft: highlight
                      ? `3px solid color-mix(in srgb, ${highlight.colorVar} ${isThisNodeSelected ? 70 : 27}%, transparent)`
                      : "3px solid transparent",
                  }}
                  onClick={() => { if (node && analysis) onNodeSelect(node.id === selectedNodeId ? null : node.id); }}
                >
                  <span className="w-12 shrink-0 text-right pr-3 select-none text-[#888] text-xs leading-6">{lineNum}</span>
                  <pre className="flex-1 pr-4 whitespace-pre">
                    <HighlightedLine code={line} language={language} />
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
