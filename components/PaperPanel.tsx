"use client";

import { useEffect, useRef, useMemo } from "react";
import { AnalysisResult, CodeNode, NODE_CONFIG } from "@/lib/types";

interface PaperPanelProps {
  submittedCode: string | null;
  analysis: AnalysisResult | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  colorblindMode?: boolean;
}

interface Paragraph {
  number: number;
  text: string;
}

function parseParagraphs(text: string): Paragraph[] {
  const parts = text.split(/\[PARAGRAPH (\d+)\]\n?/);
  const result: Paragraph[] = [];
  // parts = ["", "1", "text1", "2", "text2", ...]
  for (let i = 1; i < parts.length - 1; i += 2) {
    const number = parseInt(parts[i], 10);
    const raw = parts[i + 1] ?? "";
    const trimmed = raw.replace(/\n+$/, "").trim();
    if (trimmed) result.push({ number, text: trimmed });
  }
  return result;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function PaperPanel({
  submittedCode,
  analysis,
  selectedNodeId,
  onNodeSelect,
  colorblindMode: _colorblindMode,
}: PaperPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const paragraphs = useMemo(
    () => (submittedCode ? parseParagraphs(submittedCode) : []),
    [submittedCode]
  );

  // Map paragraph number → [primary node, ...secondary nodes]
  const paraNodeMap = useMemo(() => {
    const map = new Map<number, CodeNode[]>();
    if (!analysis) return map;
    for (const node of analysis.nodes) {
      for (let p = node.codeRange.startLine; p <= node.codeRange.endLine; p++) {
        const existing = map.get(p) ?? [];
        map.set(p, [...existing, node]);
      }
    }
    return map;
  }, [analysis]);

  // Scroll to the first paragraph of the selected node
  useEffect(() => {
    if (!selectedNodeId || !analysis) return;
    const node = analysis.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    const firstPara = node.codeRange.startLine;
    const el = paraRefs.current.get(firstPara);
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedNodeId, analysis]);

  if (!paragraphs.length || !analysis) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs font-mono">
        no paper text
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header strip */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-mono text-[#555] tracking-wider">
          {paragraphs.length} PARAGRAPHS
        </span>
        <span className="text-[11px] font-mono text-[#444] tracking-wider">ACADEMIC</span>
      </div>

      {/* Scrollable paragraph list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {paragraphs.map((para) => {
          const nodes = paraNodeMap.get(para.number) ?? [];
          const primaryNode = nodes[0] ?? null;
          const isBlockStart = primaryNode?.codeRange.startLine === para.number;
          const isSelected = primaryNode ? primaryNode.id === selectedNodeId : false;
          const isAnySelected = selectedNodeId !== null;
          const belongsToSelected = nodes.some((n) => n.id === selectedNodeId);

          const nodeColor = primaryNode ? NODE_CONFIG[primaryNode.type].color : null;
          const rgb = nodeColor ? hexToRgb(nodeColor) : null;

          const borderOpacity = !isAnySelected || isSelected ? 0.7 : 0.27;
          const bgOpacity = !isAnySelected || isSelected ? 0.08 : 0.04;
          const dimmed = isAnySelected && !belongsToSelected;

          return (
            <div
              key={para.number}
              ref={(el) => {
                if (el) paraRefs.current.set(para.number, el);
                else paraRefs.current.delete(para.number);
              }}
              onClick={() => {
                if (primaryNode) {
                  onNodeSelect(primaryNode.id === selectedNodeId ? null : primaryNode.id);
                }
              }}
              className="relative px-4 py-3 transition-opacity duration-150"
              style={{
                opacity: dimmed ? 0.4 : 1,
                borderLeft: rgb
                  ? `3px solid rgba(${rgb}, ${borderOpacity})`
                  : "3px solid transparent",
                backgroundColor: rgb
                  ? `rgba(${rgb}, ${bgOpacity})`
                  : "transparent",
                cursor: primaryNode ? "pointer" : "default",
              }}
            >
              {/* Block-start node label */}
              {isBlockStart && primaryNode && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className="text-[12px]"
                    style={{ color: nodeColor ?? undefined }}
                  >
                    {NODE_CONFIG[primaryNode.type].icon}
                  </span>
                  <span
                    className="text-[11px] font-mono tracking-wider uppercase"
                    style={{
                      color: nodeColor ?? undefined,
                      opacity: 0.85,
                    }}
                  >
                    {primaryNode.label}
                  </span>
                </div>
              )}

              {/* Paragraph text */}
              <p className="text-sm text-[#ccc] leading-relaxed pr-7">
                {para.text}
              </p>

              {/* Paragraph number */}
              <span className="absolute right-3 top-3 text-[11px] font-mono text-[#444] select-none">
                ¶{para.number}
              </span>
            </div>
          );
        })}
        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
