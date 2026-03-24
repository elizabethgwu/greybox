"use client";

import { useState, useRef, useEffect, useCallback } from "react";

declare global {
  interface Window {
    Prism: {
      highlight: (code: string, grammar: unknown, language: string) => string;
      languages: Record<string, unknown>;
    };
  }
}

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  variant?: "bottom" | "side";
}

function detectLanguage(code: string): string {
  if (/^\s*(def |from .+ import|import \w+\n|class \w+.*:)/m.test(code)) return "python";
  if (/^\s*(fn |use |struct |impl |pub |mod |let mut )/m.test(code)) return "rust";
  if (/^\s*(func |package |:= )/m.test(code)) return "go";
  if (/^\s*(public class |import java\.)/m.test(code)) return "java";
  if (/(: string|: number|: boolean|interface |type \w+ =|<\w+>)/m.test(code)) return "typescript";
  return "javascript";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function ChatInput({ onSubmit, isLoading, variant = "bottom" }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync textarea scroll to highlight overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Syntax highlight the input
  useEffect(() => {
    if (!input || variant !== "side") {
      setHighlightedHtml("");
      return;
    }
    const tryHighlight = () => {
      if (typeof window !== "undefined" && window.Prism) {
        const lang = detectLanguage(input);
        const grammar = window.Prism.languages[lang] || window.Prism.languages["javascript"];
        if (grammar) {
          setHighlightedHtml(window.Prism.highlight(input, grammar, lang));
          return true;
        }
      }
      return false;
    };
    if (!tryHighlight()) {
      // Prism not loaded yet — retry after a tick
      const t = setTimeout(tryHighlight, 300);
      return () => clearTimeout(t);
    }
  }, [input, variant]);

  // Bottom variant auto-resize
  useEffect(() => {
    if (variant === "bottom" && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input, variant]);


  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (variant === "side") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <span className="text-[12px] font-mono text-[#999] tracking-wider">
            PASTE CODE OR ASK A QUESTION
          </span>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {/* Syntax-highlighted overlay (behind textarea) */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 px-4 py-2 text-sm font-mono leading-6 overflow-hidden pointer-events-none"
            style={{ whiteSpace: "pre-wrap", tabSize: 2 }}
            dangerouslySetInnerHTML={{
              __html: highlightedHtml || escapeHtml(input),
            }}
          />

          {/* Transparent textarea on top */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            placeholder="Input your code here."
            disabled={isLoading}
            className="absolute inset-0 w-full h-full bg-transparent px-4 py-2 text-sm leading-6 placeholder-[#666] resize-none focus:outline-none font-mono"
            style={{ color: input ? "transparent" : undefined, caretColor: "#d4d4d4" }}
            spellCheck={false}
          />

        </div>

        <div className="shrink-0 p-4 border-t border-[#222]">
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-[#ddd] active:scale-[0.98]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Analyzing
              </span>
            ) : (
              "Analyze"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#222] bg-[#0a0a0a]">
      <div className="flex items-end gap-3 p-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste code or describe a coding problem..."
          disabled={isLoading}
          rows={1}
          className="flex-1 bg-[#151515] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-[#d4d4d4] placeholder-[#777] resize-none focus:outline-none focus:border-[#555] transition-colors font-mono disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="shrink-0 px-5 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-[#ddd] active:scale-[0.98]"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Analyzing
            </span>
          ) : (
            "Analyze"
          )}
        </button>
      </div>
    </div>
  );
}
