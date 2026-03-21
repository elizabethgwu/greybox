import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/prompts";
import { AnalysisResult } from "@/lib/types";

export const maxDuration = 60;

const ANALYZE_CODE_TOOL: Anthropic.Tool = {
  name: "analyze_code",
  description: "Decompose code into a structured visual graph with nodes, edges, and concept cards.",
  input_schema: {
    type: "object" as const,
    required: ["code", "language", "explanation", "nodes", "edges", "concepts", "critiques"],
    properties: {
      code: { type: "string" },
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
              items: {
                type: "object",
                required: ["text", "confidence"],
                properties: {
                  text: { type: "string" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  alternative: { type: "string" },
                },
              },
            },
            decision: {
              type: "object",
              required: ["chose", "because", "alternatives"],
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
      concepts: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title", "principle", "relevance", "difficulty"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            principle: { type: "string" },
            relevance: { type: "string" },
            difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
            nodeId: { type: "string" },
          },
        },
      },
      critiques: {
        type: "array",
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
            codeExample: { type: "string" },
          },
        },
      },
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      tools: [ANALYZE_CODE_TOOL],
      tool_choice: { type: "tool", name: "analyze_code" },
      messages: [{ role: "user", content: buildUserMessage(message) }],
    });

    const toolBlock = response.content.find((block) => block.type === "tool_use");

    if (!toolBlock || toolBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "No structured output returned from API" },
        { status: 500 }
      );
    }

    const analysis = toolBlock.input as AnalysisResult;

    if (!analysis.code || !analysis.nodes || !analysis.edges) {
      return NextResponse.json(
        { error: "Incomplete analysis result" },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Analysis error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
