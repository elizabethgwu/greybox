import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYZE_SYSTEM_PROMPT, ENRICH_SYSTEM_PROMPT, buildUserMessage, buildEnrichMessage } from "@/lib/prompts";
import { AnalysisResult } from "@/lib/types";

export const maxDuration = 300;

// First call: nodes + edges only (no concepts/critiques, trimmed assumptions)
const ANALYZE_CODE_TOOL: Anthropic.Tool = {
  name: "analyze_code",
  description: "Decompose code into a structured visual graph with nodes and edges.",
  input_schema: {
    type: "object" as const,
    required: ["language", "explanation", "nodes", "edges"],
    properties: {
      code: { type: "string", description: "Only include if you generated or modified the code. Omit if analyzing user-submitted code as-is." },
      language: { type: "string" },
      explanation: { type: "string" },
      nodes: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "label", "description", "codeRange", "variables", "assumptions", "dependencies"],
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["scope", "process", "output", "decision"] },
            label: { type: "string" },
            description: { type: "string" },
            codeRange: {
              type: "object",
              required: ["startLine", "endLine"],
              properties: {
                startLine: { type: "integer" },
                endLine: { type: "integer" },
              },
            },
            variables: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "type", "description"],
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  value: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
            assumptions: {
              type: "array",
              maxItems: 1,
              items: {
                type: "object",
                required: ["text", "confidence"],
                properties: {
                  text: { type: "string" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
              },
            },
            decision: {
              type: "object",
              required: ["chose", "because"],
              properties: {
                chose: { type: "string" },
                because: { type: "string" },
                alternatives: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["option", "tradeoff"],
                    properties: {
                      option: { type: "string" },
                      tradeoff: { type: "string" },
                    },
                  },
                },
              },
            },
            dependencies: { type: "array", items: { type: "string" } },
          },
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          required: ["source", "target"],
          properties: {
            source: { type: "string" },
            target: { type: "string" },
            label: { type: "string" },
          },
        },
      },
    },
  },
};

// Second call: concepts + critiques only
const ENRICH_ANALYSIS_TOOL: Anthropic.Tool = {
  name: "enrich_analysis",
  description: "Add concept cards and structural critique alternatives to a completed code analysis.",
  input_schema: {
    type: "object" as const,
    required: ["concepts", "critiques"],
    properties: {
      concepts: {
        type: "array",
        description: "1 to 3 concept cards. Maximum 3.",
        maxItems: 3,
        items: {
          type: "object",
          required: ["id", "title", "principle", "relevance", "difficulty", "nodeId"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            principle: { type: "string" },
            relevance: { type: "string" },
            difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
            nodeId: { type: "string", description: "ID of the node in the analysis that best demonstrates this concept" },
          },
        },
      },
      critiques: {
        type: "array",
        description: "1 to 2 alternative structural approaches.",
        maxItems: 2,
        items: {
          type: "object",
          required: ["id", "title", "summary", "explanation", "tradeoff", "complexity"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            explanation: { type: "string" },
            tradeoff: { type: "string" },
            complexity: { type: "string", enum: ["simpler", "similar", "more complex"] },
            codeExample: { type: "string", description: "Optional. 5–8 lines maximum. Omit if not needed." },
          },
        },
      },
    },
  },
};

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  if (!message || typeof message !== "string") {
    return new Response(
      `data: ${JSON.stringify({ error: "Message is required" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      const heartbeat = setInterval(() => send(": heartbeat\n\n"), 15000);

      try {
        // ── Call 1: core analysis (nodes + edges) ──────────────────────────
        const stream1 = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: ANALYZE_SYSTEM_PROMPT,
          tools: [ANALYZE_CODE_TOOL],
          tool_choice: { type: "tool", name: "analyze_code" },
          messages: [{ role: "user", content: buildUserMessage(message) }],
        });
        const response1 = await stream1.finalMessage();
        clearInterval(heartbeat);

        const toolBlock1 = response1.content.find((b) => b.type === "tool_use");
        if (!toolBlock1 || toolBlock1.type !== "tool_use") {
          send(`data: ${JSON.stringify({ error: "No structured output returned from API" })}\n\n`);
          return;
        }

        type RawAnalysis = Omit<AnalysisResult, "concepts" | "critiques"> & { code?: string };
        const coreAnalysis = toolBlock1.input as RawAnalysis;

        // If Claude generated code (question mode), emit it before the graph event
        if (coreAnalysis.code) {
          send(`data: ${JSON.stringify({ generatedCode: coreAnalysis.code })}\n\n`);
          delete coreAnalysis.code;
        }

        if (!coreAnalysis.nodes || !coreAnalysis.edges) {
          console.error("Incomplete analysis — stop_reason:", response1.stop_reason, "keys:", Object.keys(coreAnalysis));
          send(`data: ${JSON.stringify({ error: "Incomplete analysis result" })}\n\n`);
          return;
        }

        // Send the graph immediately — client renders while enrichment runs
        const partialAnalysis: AnalysisResult = {
          ...(coreAnalysis as AnalysisResult),
          concepts: [],
          critiques: [],
        };
        send(`data: ${JSON.stringify({ analysis: partialAnalysis })}\n\n`);

        // ── Call 2: enrichment (concepts + critiques) ──────────────────────
        const heartbeat2 = setInterval(() => send(": heartbeat\n\n"), 15000);
        try {
          const stream2 = client.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            system: ENRICH_SYSTEM_PROMPT,
            tools: [ENRICH_ANALYSIS_TOOL],
            tool_choice: { type: "tool", name: "enrich_analysis" },
            messages: [{ role: "user", content: buildEnrichMessage(message, coreAnalysis) }],
          });
          const response2 = await stream2.finalMessage();

          const toolBlock2 = response2.content.find((b) => b.type === "tool_use");
          if (toolBlock2 && toolBlock2.type === "tool_use") {
            send(`data: ${JSON.stringify({ enrichment: toolBlock2.input })}\n\n`);
          }
        } finally {
          clearInterval(heartbeat2);
        }
      } catch (error) {
        clearInterval(heartbeat);
        console.error("Analysis error:", error instanceof Error ? error.message : error);
        const isTimeout =
          error instanceof Error &&
          (error.message.includes("timeout") ||
            error.message.includes("timed out") ||
            (error as { status?: number }).status === 408);
        send(`data: ${JSON.stringify({
          error: isTimeout
            ? "Analysis timed out — please try again with a shorter snippet."
            : "Analysis failed. Please paste your code again.",
        })}\n\n`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
