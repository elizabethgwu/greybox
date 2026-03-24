"use client";

import { useState, useEffect } from "react";
import { AnalysisResult, NODE_CONFIG } from "@/lib/types";

interface VariablesPanelProps {
  panelId: string;
  analysis: AnalysisResult | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onVariableChange: (nodeId: string, varIndex: number, changes: { name?: string; value?: string }) => void;
  onShowInCode: (nodeId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  width: number;
  onDragStart: (e: React.MouseEvent) => void;
  onPanelDragStart: (id: string) => void;
  onPanelDragOver: (id: string) => void;
  onPanelDrop: () => void;
}

export default function VariablesPanel({
  panelId,
  analysis,
  selectedNodeId,
  onNodeSelect,
  onVariableChange,
  onShowInCode,
  isOpen,
  onToggle,
  width,
  onDragStart,
  onPanelDragStart,
  onPanelDragOver,
  onPanelDrop,
}: VariablesPanelProps) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editNames, setEditNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!analysis) return;
    const vals: Record<string, string> = {};
    const names: Record<string, string> = {};
    analysis.nodes.forEach((node) => {
      node.variables.forEach((v, vi) => {
        const key = `${node.id}:${vi}`;
        vals[key] = v.value ?? "";
        names[key] = v.name;
      });
    });
    setEditValues(vals);
    setEditNames(names);
  }, [analysis]);

  const commitValue = (nodeId: string, varIndex: number) => {
    if (!analysis) return;
    const key = `${nodeId}:${varIndex}`;
    const newValue = editValues[key] ?? "";
    const node = analysis.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const oldValue = node.variables[varIndex]?.value ?? "";
    if (newValue !== oldValue) {
      onVariableChange(nodeId, varIndex, { value: newValue });
    }
  };

  const commitName = (nodeId: string, varIndex: number) => {
    if (!analysis) return;
    const key = `${nodeId}:${varIndex}`;
    const newName = editNames[key] ?? "";
    const node = analysis.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const oldName = node.variables[varIndex]?.name ?? "";
    if (newName && newName !== oldName) {
      onVariableChange(nodeId, varIndex, { name: newName });
    }
  };

  const nodesWithVars = analysis?.nodes.filter((n) => n.variables.length > 0) ?? [];
  const totalVars = nodesWithVars.reduce((sum, n) => sum + n.variables.length, 0);

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
          className={`w-full flex justify-center text-[#999] hover:text-[#ccc] transition-colors border-b border-[#222] cursor-grab active:cursor-grabbing ${isOpen ? "items-center py-3 shrink-0" : "items-start pt-3 flex-1"}`}
          title={isOpen ? "Collapse variables" : "Expand variables"}
        >
          {isOpen ? (
            <span className="text-xs font-mono tracking-wider">
              VARIABLES {totalVars > 0 && <span className="text-[#888]">{totalVars}</span>} ›
            </span>
          ) : (
            <span className="text-xs font-mono" style={{ writingMode: "vertical-rl" }}>
              VARIABLES
            </span>
          )}
        </button>

        {isOpen && (
          <div className="flex-1 overflow-y-auto">
            {!analysis || nodesWithVars.length === 0 ? (
              <p className="text-xs text-[#888] text-center py-8">
                {analysis ? "No variables found" : "Analyze code to see variables"}
              </p>
            ) : (
              nodesWithVars.map((node) => {
                const config = NODE_CONFIG[node.type];
                const isNodeSelected = node.id === selectedNodeId;

                const colorVar = `var(--accent-${node.type})`;
                const colorAlpha = (pct: number) => `color-mix(in srgb, ${colorVar} ${pct}%, transparent)`;
                return (
                  <div
                    key={node.id}
                    className="border-b border-[#1e1e1e]"
                    style={{
                      borderLeft: `3px solid ${colorAlpha(isNodeSelected ? 75 : 18)}`,
                      background: colorAlpha(isNodeSelected ? 6 : 3),
                    }}
                  >
                    {/* Node group header */}
                    <button
                      className="w-full flex items-center gap-2 pl-3 pr-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                      onClick={() => onNodeSelect(isNodeSelected ? null : node.id)}
                    >
                      <span className="text-[12px]" style={{ color: colorVar }}>
                        {config.icon}
                      </span>
                      <span
                        className="text-[12px] font-mono tracking-wider truncate"
                        style={{ color: isNodeSelected ? colorVar : "#999" }}
                      >
                        {node.label.toUpperCase()}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] font-mono text-[#555]">
                        {node.variables.length} {node.variables.length === 1 ? "variable" : "variables"}
                      </span>
                    </button>

                    {/* Variable cards */}
                    <div className="pl-3 pr-3 pb-8 space-y-2">
                      {node.variables.map((v, vi) => {
                        const key = `${node.id}:${vi}`;
                        const currentEditValue = editValues[key] ?? v.value ?? "";
                        const currentEditName = editNames[key] ?? v.name;
                        const isValueDirty = currentEditValue !== (v.value ?? "");
                        const isNameDirty = currentEditName !== v.name;
                        const isDirty = isValueDirty || isNameDirty;

                        return (
                          <div
                            key={vi}
                            className="rounded-lg border border-[#222] bg-[#111] overflow-hidden"
                          >
                            {/* Card header — editable name */}
                            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                              <input
                                value={currentEditName}
                                onChange={(e) =>
                                  setEditNames((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                onBlur={() => commitName(node.id, vi)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitName(node.id, vi);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                  if (e.key === "Escape") {
                                    setEditNames((prev) => ({ ...prev, [key]: v.name }));
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="text-xs font-mono font-semibold bg-transparent border-b border-transparent hover:border-[#444] focus:border-[#666] focus:outline-none min-w-0 truncate transition-colors"
                                style={{ color: colorVar }}
                                spellCheck={false}
                              />
                              <span className="text-[12px] font-mono text-[#888] shrink-0">{v.type}</span>
                              {isDirty && (
                                <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--accent-process)" }}>edited</span>
                              )}
                              <button
                                onClick={() => onShowInCode(node.id)}
                                className="ml-auto shrink-0 text-[11px] font-mono text-[#888] transition-colors"
                                style={{ ["--hover-c" as string]: "var(--accent-process)" }}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent-process)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "#888")}
                                title="Show in code"
                              >
                                ↗ code
                              </button>
                            </div>

                            {/* Editable value */}
                            <div className="flex items-center gap-1.5 px-3 pb-2">
                              <span className="text-[12px] font-mono text-[#888] shrink-0">=</span>
                              <input
                                value={currentEditValue}
                                onChange={(e) =>
                                  setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                onBlur={() => commitValue(node.id, vi)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitValue(node.id, vi);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                  if (e.key === "Escape") {
                                    setEditValues((prev) => ({ ...prev, [key]: v.value ?? "" }));
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                placeholder="undefined"
                                className="flex-1 min-w-0 text-xs font-mono bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-[#d4d4d4] placeholder-[#666] focus:outline-none focus:border-[#444] transition-colors"
                                spellCheck={false}
                              />
                            </div>

                            {/* Description */}
                            {v.description && (
                              <div className="border-t border-[#1a1a1a] px-3 py-2">
                                <p className="text-[12px] text-[#999] leading-relaxed">{v.description}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
