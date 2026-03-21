"use client";

import { useState } from "react";
import { CodeNode, NODE_CONFIG } from "@/lib/types";

interface NodeInspectorProps {
  node: CodeNode | null;
  onClose: () => void;
  onVariableClick?: (name: string | null) => void;
  activeVariable?: string | null;
}

export default function NodeInspector({ node, onClose, onVariableClick, activeVariable }: NodeInspectorProps) {
  if (!node) return null;

  const config = NODE_CONFIG[node.type];
  const colorVar = `var(--accent-${node.type})`;
  const colorAlpha = (pct: number) => `color-mix(in srgb, ${colorVar} ${pct}%, transparent)`;

  return (
    <div
      className="absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] overflow-y-auto rounded-lg border bg-[#0f0f0f]/95 backdrop-blur-md shadow-2xl"
      style={{ borderColor: colorAlpha(27) }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: colorAlpha(20) }}>
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold"
            style={{ background: colorAlpha(13), color: colorVar }}
          >
            {config.icon}
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{node.label}</div>
            <div className="text-[10px] font-mono tracking-wider" style={{ color: colorVar }}>
              {config.label} · Lines {node.codeRange.startLine}–{node.codeRange.endLine}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-[#888] hover:text-white hover:bg-[#333] transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Description */}
      <div className="px-4 py-3 border-b border-[#222]">
        <p className="text-sm text-[#c0c0c0] leading-relaxed">{node.description}</p>
      </div>

      {/* Variables */}
      {node.variables.length > 0 && (
        <div className="px-4 py-3 border-b border-[#222]">
          <h4 className="text-[10px] font-mono tracking-wider text-[#888] uppercase mb-2">
            Variables at this point
          </h4>
          <div className="space-y-1.5">
            {node.variables.map((v, i) => {
              const isActive = activeVariable === v.name;
              return (
                <button
                  key={i}
                  className="w-full flex items-center gap-2 text-xs text-left rounded px-1.5 py-1 transition-colors"
                  style={{
                    background: isActive ? colorAlpha(12) : "transparent",
                    outline: isActive ? `1px solid ${colorAlpha(30)}` : "none",
                  }}
                  onClick={() => onVariableClick?.(isActive ? null : v.name)}
                  title="Click to highlight in code"
                >
                  <code className="font-mono shrink-0 px-1.5 py-0.5 rounded" style={{ color: colorVar, background: colorAlpha(10) }}>
                    {v.name}
                  </code>
                  <span className="text-[#666]">:</span>
                  <span className="text-[#888] font-mono">{v.type}</span>
                  {v.value && (
                    <span className="text-[#777] ml-auto shrink-0">= {v.value}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {node.assumptions.length > 0 && (
        <div className="px-4 py-3 border-b border-[#222]">
          <h4 className="text-[10px] font-mono tracking-wider text-[#888] uppercase mb-2">
            Assumptions
          </h4>
          <div className="space-y-2">
            {node.assumptions.map((a, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      a.confidence === "high"
                        ? "bg-green-400"
                        : a.confidence === "medium"
                        ? "bg-yellow-400"
                        : "bg-red-400"
                    }`}
                  />
                  <span className="text-[#c0c0c0]">{a.text}</span>
                </div>
                {a.alternative && (
                  <div className="ml-3.5 mt-1 text-[#888] italic">
                    Alt: {a.alternative}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision (only for decision nodes) */}
      {node.decision && (
        <div className="px-4 py-3">
          <h4 className="text-[10px] font-mono tracking-wider uppercase mb-2" style={{ color: "var(--accent-decision)" }}>
            ⟐ Decision Made
          </h4>
          <div className="text-xs space-y-2">
            <div>
              <span className="text-[#999]">Chose: </span>
              <span className="text-white font-medium">{node.decision.chose}</span>
            </div>
            <div>
              <span className="text-[#999]">Because: </span>
              <span className="text-[#c0c0c0]">{node.decision.because}</span>
            </div>
            {node.decision.alternatives.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="text-[10px] font-mono tracking-wider text-[#999] uppercase">
                  Alternatives considered
                </div>
                {node.decision.alternatives.map((alt, i) => (
                  <div key={i} className="pl-3 border-l-2 border-[#333]">
                    <div className="text-[#bbb]">{alt.option}</div>
                    <div className="text-[#888] mt-0.5">↳ {alt.tradeoff}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
