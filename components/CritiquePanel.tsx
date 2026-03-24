"use client";

import { useState, useEffect } from "react";
import { CritiqueCard } from "@/lib/types";
import CodeBlock from "@/components/CodeBlock";

interface CritiquePanelProps {
  panelId: string;
  critiques: CritiqueCard[];
  language: string;
  isOpen: boolean;
  onToggle: () => void;
  width: number;
  onDragStart: (e: React.MouseEvent) => void;
  onPanelDragStart: (id: string) => void;
  onPanelDragOver: (id: string) => void;
  onPanelDrop: () => void;
  onSelectNode?: (nodeId: string | null) => void;
  onExpand?: () => void;
}

const COMPLEXITY_LABEL: Record<CritiqueCard["complexity"], string> = {
  simpler: "SIMPLER",
  similar: "SIMILAR",
  "more complex": "MORE COMPLEX",
};

function CritiqueCardItem({ critique, language, onSelectNode, onExpand, panelOpen }: { critique: CritiqueCard; language: string; onSelectNode?: (nodeId: string | null) => void; onExpand?: () => void; panelOpen: boolean }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (!panelOpen) setExpanded(false); }, [panelOpen]);

  return (
    <div className="rounded-lg border border-[#222] bg-[#111] overflow-hidden">
      {/* Header — always visible, clicking expands */}
      <button
        className="w-full text-left px-3 pt-3 pb-2 flex items-start justify-between gap-2 hover:bg-white/[0.02] transition-colors"
        onClick={() => { const expanding = !expanded; setExpanded(expanding); if (expanding) onExpand?.(); }}
      >
        <h4 className="text-sm font-semibold text-white leading-tight">{critique.title}</h4>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-[#222] text-[#999]">
            {COMPLEXITY_LABEL[critique.complexity]}
          </span>
          <span className="text-[#888] text-[12px]">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {/* Summary — always visible */}
      <div className="px-3 pb-3">
        <p className="text-xs text-[#bbb] leading-relaxed">{critique.summary}</p>
      </div>

      {/* Expanded content — darker footer matching concepts panel */}
      {expanded && (
        <div className="border-t border-[#1e1e1e] bg-[#0d0d0d] px-3 py-2.5 space-y-2.5">
          {/* How it works */}
          <div>
            <p className="text-[12px] font-mono tracking-widest text-[#999] mb-1">HOW IT WORKS</p>
            <p className="text-xs text-[#bbb] leading-relaxed">{critique.explanation}</p>
          </div>

          {/* Code example */}
          {critique.codeExample && (
            <div
              className={`rounded border border-[#1e1e1e] overflow-hidden group ${onSelectNode && critique.nodeId ? "cursor-pointer hover:border-[#333] transition-colors" : ""}`}
              onClick={() => { if (critique.nodeId) onSelectNode?.(critique.nodeId); }}
            >
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1e1e1e]">
                <span className="text-[11px] font-mono tracking-widest text-[#999]">EXAMPLE</span>
                {critique.nodeId && (
                  <span className="text-[11px] font-mono text-[#888] group-hover:text-[#bbb] transition-colors">↗ jump</span>
                )}
              </div>
              <div className="px-2.5 py-2">
                <CodeBlock code={critique.codeExample} language={language} maxLines={20} />
              </div>
            </div>
          )}

          {/* Upside / Downside */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-[#999]">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L6 11M1 6L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <p className="text-xs text-[#bbb] leading-relaxed"><span className="font-semibold">Upside:</span> {critique.upside}</p>
            </div>
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-[#999]">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <p className="text-xs text-[#bbb] leading-relaxed"><span className="font-semibold">Downside:</span> {critique.downside}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CritiquePanel({
  panelId,
  critiques,
  language,
  isOpen,
  onToggle,
  width,
  onDragStart,
  onPanelDragStart,
  onPanelDragOver,
  onPanelDrop,
  onSelectNode,
  onExpand,
}: CritiquePanelProps) {
  return (
    <div className="shrink-0 flex">
      {/* Drag handle */}
      <div
        className="resize-handle"
        onMouseDown={onDragStart}
      />

      <div
        className={`flex flex-col border-l border-[#222] bg-[#0a0a0a] transition-[width] duration-300 overflow-hidden ${
          isOpen ? "" : "w-10"
        }`}
        style={isOpen ? { width } : undefined}
      >
        {/* Toggle / drag header */}
        <button
          onClick={onToggle}
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onPanelDragStart(panelId); }}
          onDragOver={(e) => { e.preventDefault(); onPanelDragOver(panelId); }}
          onDrop={(e) => { e.preventDefault(); onPanelDrop(); }}
          className={`w-full flex justify-center text-[#999] hover:text-[#aaa] transition-colors border-b border-[#222] cursor-grab active:cursor-grabbing ${isOpen ? "items-center py-3 shrink-0" : "items-start pt-3 flex-1"}`}
          title={isOpen ? "Collapse critique" : "Expand critique"}
        >
          {isOpen ? (
            <span className="text-xs font-mono tracking-wider">
              CRITIQUE {critiques.length > 0 && <span className="text-[#888]">{critiques.length}</span>} ›
            </span>
          ) : (
            <span className="text-xs font-mono" style={{ writingMode: "vertical-rl" }}>
              CRITIQUE
            </span>
          )}
        </button>

        {isOpen && (
          <div className="p-3 space-y-3 overflow-y-auto flex-1">
            {critiques.length === 0 ? (
              <p className="text-xs text-[#888] text-center py-8">
                Analyze code to see alternative approaches
              </p>
            ) : (
              critiques.map((c) => (
                <CritiqueCardItem key={c.id} critique={c} language={language} onSelectNode={onSelectNode} onExpand={onExpand} panelOpen={isOpen} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
