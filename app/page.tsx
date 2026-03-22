"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnalysisResult, ChatMessage, ConceptCard, CodeNode } from "@/lib/types";
import ChatInput from "@/components/ChatInput";
import CodePanel from "@/components/CodePanel";
import NodeInspector from "@/components/NodeInspector";
import ConceptsSidebar from "@/components/ConceptsSidebar";
import VariablesPanel from "@/components/VariablesPanel";
import CritiquePanel from "@/components/CritiquePanel";
import CatLoader from "@/components/CatLoader";

// Dynamic import for D3 components (SSR off)
const NodeMap = dynamic(() => import("@/components/NodeMap"), { ssr: false });
const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [allConcepts, setAllConcepts] = useState<ConceptCard[]>([]);
  const [conceptsOpen, setConceptsOpen] = useState(false);
  const [conceptsWidth, setConceptsWidth] = useState(288);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [variablesWidth, setVariablesWidth] = useState(272);
  const [critiqueOpen, setCritiqueOpen] = useState(false);
  const [critiqueWidth, setCritiqueWidth] = useState(288);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [highlightedVariable, setHighlightedVariable] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const [explanationCollapsed, setExplanationCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(500);
  const [mapDimensions, setMapDimensions] = useState({ width: 600, height: 500 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const isPanelDragging = useRef(false);
  const isConceptsDragging = useRef(false);
  const isVariablesDragging = useRef(false);
  const isCritiqueDragging = useRef(false);
  const [panelOrder, setPanelOrder] = useState<Array<'variables' | 'concepts' | 'critique'>>(['variables', 'concepts', 'critique']);
  const panelDragIdRef = useRef<string | null>(null);
  const submittedCodeRef = useRef<string | null>(null);
  useEffect(() => { submittedCodeRef.current = submittedCode; }, [submittedCode]);

  // Resize observer for the map container
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMapDimensions({
          width: Math.max(entry.contentRect.width, 300),
          height: Math.max(entry.contentRect.height, 300),
        });
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!infoOpen) return;
    const handler = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [infoOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle("colorblind", colorblindMode);
  }, [colorblindMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", lightMode);
    const link = document.getElementById("prism-theme") as HTMLLinkElement | null;
    if (link) {
      link.href = lightMode
        ? "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
    }
  }, [lightMode]);

  const selectedNode: CodeNode | null =
    currentAnalysis?.nodes.find((n) => n.id === selectedNodeId) || null;

  const handleCatComplete = useCallback(() => {}, []);

  const handleSubmit = useCallback(async (message: string) => {
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedNodeId(null);
    setSubmittedCode(message);
    setExplanationCollapsed(false);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Track core analysis so the enrichment handler can reference it
      let latestAnalysis: AnalysisResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process all complete SSE lines from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.generatedCode) {
            setSubmittedCode(data.generatedCode);
          } else if (data.error) {
            setErrorMessage(data.error);
            setIsLoading(false);
          } else if (data.analysis) {
            // First event: core analysis (nodes + edges). Render the graph immediately.
            const analysis = data.analysis as AnalysisResult;
            latestAnalysis = analysis;
            setCurrentAnalysis(analysis);
            setIsLoading(false);
          } else if (data.enrichment && latestAnalysis) {
            // Second event: concepts + critiques. Merge into the rendered analysis.
            const { concepts, critiques } = data.enrichment as Pick<AnalysisResult, "concepts" | "critiques">;

            setCurrentAnalysis((prev) =>
              prev ? { ...prev, concepts, critiques } : prev
            );

            // Accumulate concepts (dedup by title), attaching code snippets
            setAllConcepts((prev) => {
              const existing = new Set(prev.map((c) => c.title));
              const codeLines = message.split("\n");
              const newConcepts = concepts
                .filter((c) => !existing.has(c.title))
                .map((c) => {
                  if (c.nodeId) {
                    const node = latestAnalysis!.nodes.find((n) => n.id === c.nodeId);
                    if (node) {
                      c.codeSnippet = codeLines
                        .slice(node.codeRange.startLine - 1, node.codeRange.endLine)
                        .join("\n");
                      c.language = latestAnalysis!.language;
                    }
                  }
                  return c;
                });
              return [...prev, ...newConcepts];
            });

            // Add assistant message once the full picture is available
            const fullAnalysis: AnalysisResult = { ...latestAnalysis, concepts, critiques };
            const assistantMsg: ChatMessage = {
              id: `msg_${Date.now()}`,
              role: "assistant",
              content: latestAnalysis.explanation,
              analysis: fullAnalysis,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setErrorMessage("Something went wrong. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setHighlightedVariable(null);
  }, []);

  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isPanelDragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isPanelDragging.current) return;
      setPanelWidth(Math.max(280, Math.min(ev.clientX, window.innerWidth - 400)));
    };
    const onMouseUp = () => {
      isPanelDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleConceptsDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isConceptsDragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isConceptsDragging.current) return;
      setConceptsWidth(Math.max(240, Math.min(window.innerWidth - ev.clientX, window.innerWidth - 400)));
    };
    const onMouseUp = () => {
      isConceptsDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleVariablesDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isVariablesDragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isVariablesDragging.current) return;
      setVariablesWidth(Math.max(220, Math.min(window.innerWidth - ev.clientX, window.innerWidth - 400)));
    };
    const onMouseUp = () => {
      isVariablesDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleCritiqueDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isCritiqueDragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isCritiqueDragging.current) return;
      setCritiqueWidth(Math.max(240, Math.min(window.innerWidth - ev.clientX, window.innerWidth - 400)));
    };
    const onMouseUp = () => {
      isCritiqueDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const handlePanelReorderDragStart = useCallback((id: string) => {
    panelDragIdRef.current = id;
  }, []);

  const handlePanelReorderDragOver = useCallback((id: string) => {
    if (!panelDragIdRef.current || panelDragIdRef.current === id) return;
    setPanelOrder((prev) => {
      const from = prev.indexOf(panelDragIdRef.current as 'variables' | 'concepts' | 'critique');
      const to = prev.indexOf(id as 'variables' | 'concepts' | 'critique');
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, panelDragIdRef.current as 'variables' | 'concepts' | 'critique');
      return next;
    });
  }, []);

  const handlePanelReorderDrop = useCallback(() => {
    panelDragIdRef.current = null;
  }, []);

  const handleNew = useCallback(() => {
    setCurrentAnalysis(null);
    setSubmittedCode(null);
    setSelectedNodeId(null);
    setExplanationCollapsed(false);
    setErrorMessage(null);
  }, []);

  // Update a variable name and/or value, reflecting changes in the code
  const handleVariableChange = useCallback((
    nodeId: string,
    varIndex: number,
    changes: { name?: string; value?: string }
  ) => {
    setCurrentAnalysis((prev) => {
      if (!prev) return prev;
      const nodeIdx = prev.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIdx === -1) return prev;

      const node = prev.nodes[nodeIdx];
      const variable = node.variables[varIndex];
      let newCode = submittedCodeRef.current ?? "";
      const lines = newCode.split("\n");
      const start = node.codeRange.startLine - 1;
      const end = Math.min(node.codeRange.endLine, lines.length);

      // Replace old name with new name across the node's code range
      if (changes.name !== undefined && changes.name !== variable.name) {
        const oldName = variable.name;
        for (let i = start; i < end; i++) {
          if (lines[i].includes(oldName)) {
            lines[i] = lines[i].replaceAll(oldName, changes.name);
          }
        }
      }

      // Replace old value with new value (first occurrence)
      if (changes.value !== undefined && changes.value !== (variable.value ?? "")) {
        const oldValue = variable.value ?? "";
        if (oldValue) {
          for (let i = start; i < end; i++) {
            if (lines[i].includes(oldValue)) {
              lines[i] = lines[i].replace(oldValue, changes.value);
              break;
            }
          }
        }
      }

      newCode = lines.join("\n");

      const updatedNodes = prev.nodes.map((n, i) => {
        if (i !== nodeIdx) return n;
        const updatedVars = n.variables.map((v, vi) => {
          if (vi !== varIndex) return v;
          return {
            ...v,
            ...(changes.name !== undefined ? { name: changes.name } : {}),
            ...(changes.value !== undefined ? { value: changes.value } : {}),
          };
        });
        return { ...n, variables: updatedVars };
      });

      setSubmittedCode(newCode);
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  // First sentence of the explanation for collapsed view
  const shortExplanation = currentAnalysis?.explanation
    ? (() => {
        const first = currentAnalysis.explanation.split(/\.\s+/)[0];
        return first.endsWith(".") ? first : first + ".";
      })()
    : "";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#222] bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">Greybox</h1>
          <span className="text-[10px] font-mono text-[#999] tracking-wider border border-[#444] rounded px-1.5 py-0.5">
            PROTOTYPE
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark / Light mode toggle */}
          <button
            onClick={() => setLightMode((v) => !v)}
            className={`h-7 px-2.5 rounded-full border flex items-center gap-1.5 text-[10px] font-mono tracking-wide transition-colors ${
              lightMode
                ? "border-[#666] text-[#555] bg-[#ddd]"
                : "border-[#444] text-[#888] hover:text-[#ccc] hover:border-[#666]"
            }`}
            title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
          >
            {lightMode ? (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="6" y1="0.5" x2="6" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="6" y1="10" x2="6" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="0.5" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="10" y1="6" x2="11.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="1.9" y1="1.9" x2="2.9" y2="2.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="9.1" y1="9.1" x2="10.1" y2="10.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="9.1" y1="1.9" x2="10.1" y2="0.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="1.9" y1="10.1" x2="2.9" y2="9.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M10 6.5A4.5 4.5 0 015.5 2a4.5 4.5 0 100 9A4.5 4.5 0 0010 6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            )}
            {lightMode ? "light mode" : "dark mode"}
          </button>

          {/* Colorblind mode toggle */}
          <button
            onClick={() => setColorblindMode((v) => !v)}
            className={`h-7 px-2.5 rounded-full border flex items-center gap-1.5 text-[10px] font-mono tracking-wide transition-colors ${
              colorblindMode
                ? "border-[#56B4E9] text-[#56B4E9] bg-[#56B4E9]/10"
                : "border-[#444] text-[#888] hover:text-[#ccc] hover:border-[#666]"
            }`}
            title={colorblindMode ? "Disable colorblind mode" : "Enable colorblind mode"}
          >
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
              <ellipse cx="6" cy="5" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="6" cy="5" r="2" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="1" y1="9" x2="11" y2="1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={colorblindMode ? "hidden" : ""}/>
            </svg>
            colorblind mode
          </button>

          {/* Info button + popover */}
          <div ref={infoRef} className="relative">
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs transition-colors ${
              infoOpen ? "border-[#555] text-[#ccc] bg-[#1a1a1a]" : "border-[#444] text-[#888] hover:text-[#ccc] hover:border-[#555]"
            }`}
            title="How to use Greybox"
          >
            ?
          </button>

          {infoOpen && (
            <div className="absolute right-0 top-10 w-80 bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e1e1e]">
                <p className="text-sm font-semibold text-white">How to use Greybox</p>
                <p className="text-xs text-[#888] mt-0.5">A visual code reasoning prototype</p>
              </div>

              <div className="p-4 space-y-4">
                {[
                  {
                    step: "1",
                    title: "Submit code or a question",
                    body: "Paste any code snippet into the left panel, or describe a coding concept. Greybox will generate working code and analyze it.",
                  },
                  {
                    step: "2",
                    title: "Explore the node map",
                    body: "The center panel shows your code as a graph. Each node is a logical block — click any node to inspect its variables, assumptions, and decisions.",
                  },
                  {
                    step: "3",
                    title: "Read the annotated code",
                    body: "The left panel highlights which lines belong to which node. Colored borders show scope (◈), process (■), output (◉), and decision (⟐) blocks.",
                  },
                  {
                    step: "4",
                    title: "Review concepts",
                    body: "Open the Concepts panel on the right to see programming principles extracted from your code. Filter by difficulty and click a snippet to jump to it in the code.",
                  },
                ].map(({ step, title, body }) => (
                  <div key={step} className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-[10px] font-mono text-[#888]">
                      {step}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[#ddd] mb-0.5">{title}</p>
                      <p className="text-xs text-[#999] leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left panel — always visible, resizable */}
        <div className="shrink-0 flex" style={{ width: panelWidth }}>
          <div className="flex-1 flex flex-col bg-[#0f0f0f] overflow-hidden">
            {currentAnalysis ? (
              <>
                {/* Header */}
                <div className="flex items-center border-b border-[#222] shrink-0">
                  <span className="px-4 py-2 text-[10px] font-mono tracking-wider text-[#aaa]">
                    YOUR CODE
                  </span>
                  <button
                    onClick={handleNew}
                    className="ml-auto px-4 py-2 text-[10px] font-mono text-[#888] hover:text-[#ccc] transition-colors flex items-center gap-1"
                  >
                    ↩ New
                  </button>
                </div>

                <CodePanel
                  submittedCode={submittedCode}
                  analysis={currentAnalysis}
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={handleNodeSelect}
                  highlightedVariable={highlightedVariable}
                  colorblindMode={colorblindMode}
                />
              </>
            ) : (
              <ChatInput onSubmit={handleSubmit} isLoading={isLoading} variant="side" />
            )}
          </div>
          {/* Resize handle */}
          <div
            className="w-1 shrink-0 cursor-col-resize bg-[#222] hover:bg-[#4A90D9]/50 transition-colors"
            onMouseDown={handlePanelDragStart}
          />
        </div>

        {/* Main workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentAnalysis ? (
            <div
              ref={mapContainerRef}
              className="relative flex-1 overflow-hidden bg-[#0d0d0d]"
            >
              <NodeMap
                nodes={currentAnalysis.nodes}
                edges={currentAnalysis.edges}
                selectedNodeId={selectedNodeId}
                onNodeSelect={handleNodeSelect}
                width={mapDimensions.width}
                height={mapDimensions.height}
                colorblindMode={colorblindMode}
                lightMode={lightMode}
              />

              {/* Node Inspector overlay */}
              <NodeInspector
                node={selectedNode}
                onClose={() => { setSelectedNodeId(null); setHighlightedVariable(null); }}
                onVariableClick={setHighlightedVariable}
                activeVariable={highlightedVariable}
              />

              {/* MiniMap */}
              <MiniMap
                nodes={currentAnalysis.nodes}
                edges={currentAnalysis.edges}
                selectedNodeId={selectedNodeId}
                onNodeSelect={handleNodeSelect}
                colorblindMode={colorblindMode}
              />

              {/* Collapsible explanation banner */}
              <div className="absolute top-4 left-4 max-w-xs">
                <div className="bg-[#111]/90 backdrop-blur-sm border border-[#222] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExplanationCollapsed((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-[#888] hover:text-[#bbb] transition-colors tracking-wider"
                  >
                    <span>SUMMARY</span>
                    <span>{explanationCollapsed ? "▸" : "▾"}</span>
                  </button>
                  {!explanationCollapsed && (
                    <div className="px-3 pb-3">
                      <p className="text-xs text-[#aaa] leading-relaxed">
                        {shortExplanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : errorMessage ? (
            /* Error state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm space-y-5 animate-fade-in">
                <p className="text-[80px] font-bold leading-none tracking-tighter text-[#222]">500</p>
                <div>
                  <p className="text-sm font-semibold text-[#ddd] mb-1">Analysis failed</p>
                  <p className="text-xs text-[#888] leading-relaxed">{errorMessage}</p>
                </div>
                <button
                  onClick={handleNew}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#333] text-xs font-mono text-[#999] hover:text-[#ccc] hover:border-[#555] transition-colors"
                >
                  ↩ paste new code
                </button>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md space-y-6 animate-fade-in">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#4A90D9]/20 to-[#4CAF7D]/20 border border-[#222] flex items-center justify-center">
                  <span className="text-2xl">◈</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Visual Code Reasoning</h2>
                  <p className="text-sm text-[#888] leading-relaxed">
                    Paste code or describe a problem. Greybox breaks it into navigable visual nodes
                    — showing scope, processing, output, and decision points — so you can see the
                    reasoning, not just the result.
                  </p>
                </div>
                <div className="flex justify-center gap-6 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: "var(--accent-scope)" }}>◈</span>
                    <span className="text-[#999]">Scope</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: "var(--accent-process)" }}>■</span>
                    <span className="text-[#999]">Process</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: "var(--accent-output)" }}>◉</span>
                    <span className="text-[#999]">Output</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: "var(--accent-decision)" }}>⟐</span>
                    <span className="text-[#999]">Decision</span>
                  </div>
                </div>

                {/* Cat loading animation */}
                <CatLoader isLoading={isLoading} onComplete={handleCatComplete} />
              </div>
            </div>
          )}
        </div>

        {/* Orderable sidebars */}
        {panelOrder.map((panelId) => {
          if (panelId === 'variables') return (
            <VariablesPanel
              key="variables"
              panelId="variables"
              analysis={currentAnalysis}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              onVariableChange={handleVariableChange}
              onShowInCode={(nodeId) => { setSelectedNodeId(nodeId); }}
              isOpen={variablesOpen}
              onToggle={() => setVariablesOpen((v) => !v)}
              width={variablesWidth}
              onDragStart={handleVariablesDragStart}
              onPanelDragStart={handlePanelReorderDragStart}
              onPanelDragOver={handlePanelReorderDragOver}
              onPanelDrop={handlePanelReorderDrop}
            />
          );
          if (panelId === 'concepts') return (
            <ConceptsSidebar
              key="concepts"
              panelId="concepts"
              concepts={allConcepts}
              isOpen={conceptsOpen}
              onToggle={() => setConceptsOpen(!conceptsOpen)}
              width={conceptsWidth}
              onDragStart={handleConceptsDragStart}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              onPanelDragStart={handlePanelReorderDragStart}
              onPanelDragOver={handlePanelReorderDragOver}
              onPanelDrop={handlePanelReorderDrop}
            />
          );
          if (panelId === 'critique') return (
            <CritiquePanel
              key="critique"
              panelId="critique"
              critiques={currentAnalysis?.critiques ?? []}
              language={currentAnalysis?.language ?? "javascript"}
              isOpen={critiqueOpen}
              onToggle={() => setCritiqueOpen((v) => !v)}
              width={critiqueWidth}
              onDragStart={handleCritiqueDragStart}
              onPanelDragStart={handlePanelReorderDragStart}
              onPanelDragOver={handlePanelReorderDragOver}
              onPanelDrop={handlePanelReorderDrop}
            />
          );
          return null;
        })}
      </div>
    </div>
  );
}
