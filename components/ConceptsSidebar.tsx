"use client";

import { useState, useEffect } from "react";
import { ConceptCard } from "@/lib/types";
import CodeBlock from "@/components/CodeBlock";

interface ConceptsSidebarProps {
  panelId: string;
  concepts: ConceptCard[];
  isOpen: boolean;
  onToggle: () => void;
  width: number;
  onDragStart: (e: React.MouseEvent) => void;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onScrollRequest?: () => void;
  onCardExpand?: () => void;
  onPanelDragStart: (id: string) => void;
  onPanelDragOver: (id: string) => void;
  onPanelDrop: () => void;
}

type FilterLevel = "all" | "beginner" | "intermediate" | "advanced";

const LEVELS: { value: FilterLevel; label: string }[] = [
  { value: "all", label: "All" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Inter." },
  { value: "advanced", label: "Advanced" },
];

const MAX_SNIPPET_LINES = 8;

function CodeSnippet({
  code,
  language,
  nodeId,
  isActive,
  onNodeSelect,
  onScrollRequest,
}: {
  code: string;
  language?: string;
  nodeId: string;
  isActive: boolean;
  onNodeSelect?: (nodeId: string | null) => void;
  onScrollRequest?: () => void;
}) {

  return (
    <button
      className={`w-full text-left rounded border transition-colors group ${
        isActive
          ? "border-[#444] bg-[#1a1a1a]"
          : "border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#333] hover:bg-[#141414]"
      }`}
      onClick={() => { onNodeSelect?.(nodeId); onScrollRequest?.(); }}
      title="Jump to in code"
    >
      {/* snippet header */}
      <div className={`flex items-center justify-between px-2.5 py-1.5 border-b ${isActive ? "border-[#333]" : "border-[#1e1e1e] group-hover:border-[#2a2a2a]"}`}>
        <span className="text-[11px] font-mono tracking-widest text-[#999]">IN THIS CODE</span>
        <span className={`text-[11px] font-mono transition-colors ${isActive ? "text-[#bbb]" : "text-[#888] group-hover:text-[#bbb]"}`}>
          {isActive ? "↑ active" : "↗ jump"}
        </span>
      </div>

      {/* code lines */}
      <div className="px-2.5 py-2">
        <CodeBlock
          code={code}
          language={language}
          maxLines={MAX_SNIPPET_LINES}
        />
      </div>
    </button>
  );
}

function ConceptCardItem({
  concept,
  selectedNodeId,
  onNodeSelect,
  onScrollRequest,
  onCardExpand,
  panelOpen,
}: {
  concept: ConceptCard;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onScrollRequest?: () => void;
  onCardExpand?: () => void;
  panelOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (!panelOpen) setExpanded(false); }, [panelOpen]);

  return (
    <div className="rounded-lg border border-[#222] bg-[#111] overflow-hidden">
      {/* Header — always visible, clicking expands */}
      <button
        className="w-full text-left px-3 pt-3 pb-2 flex items-start justify-between gap-2 hover:bg-white/[0.02] transition-colors"
        onClick={() => { const next = !expanded; setExpanded(next); if (next) onCardExpand?.(); }}
      >
        <h4 className="text-sm font-semibold text-white leading-tight">{concept.title}</h4>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-[#222] text-[#999]">
            {concept.difficulty.toUpperCase()}
          </span>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(concept.title + " examples")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-process)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            onClick={(e) => e.stopPropagation()}
            title={`Search "${concept.title} examples"`}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
              <line x1="7.8" y1="7.8" x2="11" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </a>
          <span className="text-[#888] text-[12px]">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <>
          {/* Principle */}
          <div className="px-3 pb-3">
            <p className="text-[12px] font-mono tracking-widest text-[#999] mb-1">PRINCIPLE</p>
            <p className="text-xs text-[#bbb] leading-relaxed">{concept.principle}</p>
          </div>

          {/* Relevance + code snippet — darker footer */}
          <div className="border-t border-[#1e1e1e] bg-[#0d0d0d] px-3 py-2.5 space-y-2.5">
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-[#999]">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L6 11M1 6L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
              <p className="text-xs text-[#999] leading-relaxed">{concept.relevance}</p>
            </div>

            {concept.codeSnippet && concept.nodeId && (
              <CodeSnippet
                code={concept.codeSnippet}
                language={concept.language}
                nodeId={concept.nodeId}
                isActive={selectedNodeId === concept.nodeId}
                onNodeSelect={onNodeSelect}
                onScrollRequest={onScrollRequest}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ConceptsSidebar({
  panelId,
  concepts,
  isOpen,
  onToggle,
  width,
  onDragStart,
  selectedNodeId,
  onNodeSelect,
  onScrollRequest,
  onCardExpand,
  onPanelDragStart,
  onPanelDragOver,
  onPanelDrop,
}: ConceptsSidebarProps) {
  const [filter, setFilter] = useState<FilterLevel>("all");

  const filtered = filter === "all" ? concepts : concepts.filter((c) => c.difficulty === filter);

  return (
    <div className="shrink-0 flex">
      {/* Drag handle — always visible so it can be grabbed even when collapsed */}
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
          title={isOpen ? "Collapse concepts" : "Expand concepts"}
        >
          {isOpen ? (
            <span className="text-xs font-mono tracking-wider">
              CONCEPTS {concepts.length > 0 && <span className="text-[#888]">{concepts.length}</span>} ›
            </span>
          ) : (
            <span className="text-xs font-mono" style={{ writingMode: "vertical-rl" }}>
              CONCEPTS
            </span>
          )}
        </button>

        {isOpen && (
          <>
            {/* Segmented control — only shown when there are concepts */}
            {concepts.length > 0 && (
              <div className="p-2 border-b border-[#222] shrink-0">
                <div className="flex rounded-md bg-[#111] p-0.5 gap-0.5">
                  {LEVELS.map(({ value, label }) => {
                    const count =
                      value === "all"
                        ? concepts.length
                        : concepts.filter((c) => c.difficulty === value).length;
                    const active = filter === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={`flex-1 text-[12px] font-mono tracking-wide py-1 rounded transition-colors ${
                          active ? "bg-[#222] text-[#eee]" : "text-[#888] hover:text-[#888]"
                        }`}
                      >
                        {label}
                        {count > 0 && (
                          <span className={`ml-1 ${active ? "text-[#888]" : "text-[#999]"}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              {concepts.length === 0 ? (
                <p className="text-xs text-[#888] text-center py-8">
                  Concepts will appear here as you analyze code
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-[#888] text-center py-8">
                  No {filter} concepts yet
                </p>
              ) : (
                filtered.map((concept) => (
                  <ConceptCardItem
                    key={concept.id}
                    concept={concept}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={onNodeSelect}
                    onScrollRequest={onScrollRequest}
                    onCardExpand={onCardExpand}
                    panelOpen={isOpen}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
