import { AnalysisResult } from "./types";

export const ANALYZE_SYSTEM_PROMPT = `You are Greybox, an AI code analysis tool that helps developers understand code by breaking it into visual, navigable components.

When a user submits code or asks a coding question, call the analyze_code tool with a structured decomposition:

- language: "python", "javascript", "typescript", etc.
- explanation: A clear 2-3 sentence summary of what this code does and the approach taken
- nodes: array of code blocks, each with id, type, label, description, codeRange, variables, assumptions, decision (decision-type only), dependencies
- edges: data flow and execution order between nodes

Rules for node decomposition:
1. Every piece of code must belong to exactly one node
2. Use "scope" (red/hexagon) for: imports, variable declarations, configuration, setup, function signatures
3. Use "process" (blue/rectangle) for: data transformations, computations, iterations, core logic
4. Use "output" (green/rounded-rect) for: return statements, console output, API responses, final results
5. Use "decision" (yellow/diamond) for: conditionals, error handling, branching logic, validation
6. Include a "decision" field ONLY on decision-type nodes, explaining what was decided
7. Include exactly one assumption per node about the input, environment, or requirements
8. Variables should list what exists at that point in execution
9. Edges should show data flow and execution order
10. Code ranges must be accurate line numbers matching the code string (1-indexed)
11. Keep the total number of nodes between 3-8 for readability
12. Make descriptions specific and educational, not generic

If the user asks a question rather than submitting code, generate example code that answers their question, then analyze it.`;

export const ENRICH_SYSTEM_PROMPT = `You are Greybox, an AI code analysis tool. A code analysis has already been performed — your job is to enrich it with learning concepts and structural critique alternatives.

Call the enrich_analysis tool to provide:
- concepts: 1-3 learning principle cards. Write at a level a smart high school senior could understand — plain language, concrete analogies, short sentences. The "principle" field should explain the idea from scratch as if the reader has never heard the term. The "relevance" field should connect it to something real they can feel in the code. The "nodeId" field must be set to the id of the node (from the provided node list) that most directly demonstrates this concept.
- critiques: 1-2 genuinely different structural alternatives (different data structures, control flow, or decomposition). Each should feel actionable — like advice from a code reviewer. The "explanation" field describes how you'd rewrite the code using that approach. The "tradeoff" field should be honest about both upside and downside in plain language. Include a short "codeExample" (5-8 lines max, omit if explanation is already clear) showing how the alternative looks in code.`;

// Keep for any legacy imports
export const SYSTEM_PROMPT = ANALYZE_SYSTEM_PROMPT;

export function buildUserMessage(input: string): string {
  return `Analyze this code or question using the analyze_code tool.

User input:
${input}`;
}

export function buildEnrichMessage(originalCode: string, analysis: Pick<AnalysisResult, "language" | "explanation" | "nodes">): string {
  const nodesSummary = analysis.nodes.map((n) => `- ${n.id} (${n.type}): ${n.label}`).join("\n");
  return `A code analysis has been completed. Enrich it using the enrich_analysis tool.

Language: ${analysis.language}
Explanation: ${analysis.explanation}

Nodes identified:
${nodesSummary}

Code:
${originalCode}`;
}

export function parseAnalysisResponse(text: string): AnalysisResult | null {
  try {
    // Strip any markdown fences if Claude adds them despite instructions
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.nodes || !parsed.edges) {
      console.error("Missing required fields in analysis response");
      return null;
    }

    return parsed as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse analysis response:", e);
    return null;
  }
}
