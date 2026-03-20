"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnalysisResult, ChatMessage, ConceptCard, CodeNode } from "@/lib/types";
import ChatInput from "@/components/ChatInput";
import CodePanel from "@/components/CodePanel";
import NodeInspector from "@/components/NodeInspector";
import ConceptsSidebar from "@/components/ConceptsSidebar";

// Dynamic import for D3 components (SSR off)
const NodeMap = dynamic(() => import("@/components/NodeMap"), { ssr: false });
const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });

type ViewMode = "map" | "code" | "split";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [allConcepts, setAllConcepts] = useState<ConceptCard[]>([]);
  const [conceptsOpen, setConceptsOpen] = useState(true);
  const [mapDimensions, setMapDimensions] = useState({ width: 600, height: 500 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

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

  const selectedNode: CodeNode | null =
    currentAnalysis?.nodes.find((n) => n.id === selectedNodeId) || null;

  const handleSubmit = useCallback(async (message: string) => {
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setSelectedNodeId(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (data.error) {
        const errMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: `Error: ${data.error}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } else if (data.analysis) {
        const analysis = data.analysis as AnalysisResult;
        setCurrentAnalysis(analysis);

        // Accumulate concepts (dedup by title)
        setAllConcepts((prev) => {
          const existing = new Set(prev.map((c) => c.title));
          const newConcepts = (analysis.concepts ?? []).filter((c) => !existing.has(c.title));
          return [...prev, ...newConcepts];
        });

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: analysis.explanation,
          analysis,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "Error: Could not parse the response. Please try again.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      const errMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Something went wrong. Please check your API key and try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#222] bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-[#4A90D9] to-[#4CAF7D] flex items-center justify-center text-[10px] font-bold text-white">
              CM
            </div>
            <h1 className="text-sm font-semibold tracking-tight">CodeMap</h1>
          </div>
          <span className="text-[10px] font-mono text-[#555] tracking-wider border border-[#333] rounded px-1.5 py-0.5">
            PROTOTYPE
          </span>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-[#151515] rounded-lg p-0.5 border border-[#222]">
          {(["map", "split", "code"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-[11px] font-mono rounded-md transition-all ${
                viewMode === mode
                  ? "bg-[#252525] text-white"
                  : "text-[#666] hover:text-[#aaa]"
              }`}
            >
              {mode === "map" ? "◈ Map" : mode === "code" ? "⟩ Code" : "◈ Split"}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentAnalysis ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Node Map */}
              {(viewMode === "map" || viewMode === "split") && (
                <div
                  ref={mapContainerRef}
                  className={`relative overflow-hidden bg-[#0d0d0d] ${
                    viewMode === "split" ? "w-1/2 border-r border-[#222]" : "flex-1"
                  }`}
                >
                  <NodeMap
                    nodes={currentAnalysis.nodes}
                    edges={currentAnalysis.edges}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={handleNodeSelect}
                    width={mapDimensions.width}
                    height={mapDimensions.height}
                  />

                  {/* Node Inspector overlay */}
                  <NodeInspector
                    node={selectedNode}
                    onClose={() => setSelectedNodeId(null)}
                  />

                  {/* MiniMap (only in code-only view or when map is large) */}
                  {viewMode !== "map" && (
                    <MiniMap
                      nodes={currentAnalysis.nodes}
                      edges={currentAnalysis.edges}
                      selectedNodeId={selectedNodeId}
                      onNodeSelect={handleNodeSelect}
                    />
                  )}

                  {/* Explanation banner */}
                  <div className="absolute top-4 left-4 max-w-sm">
                    <div className="bg-[#111]/90 backdrop-blur-sm border border-[#222] rounded-lg px-4 py-3">
                      <p className="text-xs text-[#aaa] leading-relaxed">
                        {currentAnalysis.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Code Panel */}
              {(viewMode === "code" || viewMode === "split") && (
                <div
                  className={`overflow-hidden bg-[#0f0f0f] ${
                    viewMode === "split" ? "w-1/2" : "flex-1"
                  }`}
                >
                  <CodePanel
                    analysis={currentAnalysis}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={handleNodeSelect}
                  />

                  {/* MiniMap in code-only view */}
                  {viewMode === "code" && (
                    <div className="absolute bottom-20 right-80">
                      <MiniMap
                        nodes={currentAnalysis.nodes}
                        edges={currentAnalysis.edges}
                        selectedNodeId={selectedNodeId}
                        onNodeSelect={handleNodeSelect}
                      />
                    </div>
                  )}
                </div>
              )}
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
                    Paste code or describe a problem. CodeMap breaks it into navigable visual nodes
                    — showing scope, processing, output, and decision points — so you can see the
                    reasoning, not just the result.
                  </p>
                </div>
                <div className="flex justify-center gap-6 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#E05252]">◈</span>
                    <span className="text-[#888]">Scope</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#4A90D9]">⚙</span>
                    <span className="text-[#888]">Process</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#4CAF7D]">◉</span>
                    <span className="text-[#888]">Output</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#E5A832]">⟐</span>
                    <span className="text-[#888]">Decision</span>
                  </div>
                </div>

                {/* Loading state */}
                {isLoading && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#E05252] loading-node" style={{ animationDelay: "0s" }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#4A90D9] loading-node" style={{ animationDelay: "0.2s" }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#4CAF7D] loading-node" style={{ animationDelay: "0.4s" }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#E5A832] loading-node" style={{ animationDelay: "0.6s" }} />
                    </div>
                    <span className="text-xs text-[#666] font-mono">Mapping code structure...</span>
                  </div>
                )}

                {/* Error messages */}
                {!isLoading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                  <div className="mt-4 px-4 py-3 rounded-lg border border-[#E05252]/30 bg-[#E05252]/10 text-xs text-[#E05252] font-mono text-center">
                    {messages[messages.length - 1].content}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat input */}
          <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {/* Concepts sidebar */}
        <ConceptsSidebar
          concepts={allConcepts}
          isOpen={conceptsOpen}
          onToggle={() => setConceptsOpen(!conceptsOpen)}
        />
      </div>
    </div>
  );
}
