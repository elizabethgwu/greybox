# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm start        # Run production server
npm run lint     # ESLint (Next.js config)
```

No test suite is configured. Requires `ANTHROPIC_API_KEY` in `.env.local`.

## Architecture

Greybox is a Next.js 14 app that uses Claude AI to decompose code into visual node graphs. Users submit code → Claude analyzes it → results appear as a synchronized force-directed graph, code panel, and concept sidebar.

### Key Data Flow

```
User submits code
  → POST /api/chat (app/api/chat/route.ts)
  → Claude API (claude-sonnet-4-6, SYSTEM_PROMPT from lib/prompts.ts)
  → Returns strict JSON: AnalysisResult { code, nodes, edges, concepts }
  → parseAnalysisResponse() validates structure
  → React state drives all three views simultaneously
```

### Core Files

- **`app/page.tsx`** — Single orchestrator (~310 lines). Owns all state: `currentAnalysis`, `selectedNodeId`, `viewMode`, `allConcepts`. Coordinates every component.
- **`app/api/chat/route.ts`** — Only backend endpoint. Validates input, calls Anthropic SDK, returns `{ analysis }` or `{ error }`.
- **`lib/prompts.ts`** — `SYSTEM_PROMPT` (instructs Claude to return strict JSON, no markdown) + `parseAnalysisResponse()`.
- **`lib/types.ts`** — All TypeScript interfaces + `NODE_CONFIG` (visual shape/color/icon per node type).
- **`components/NodeMap.tsx`** — D3.js force-directed graph. Uses `dynamic(() => import(), { ssr: false })` because D3 requires browser APIs. Topological BFS layout for top-to-bottom node ordering.
- **`components/CodePanel.tsx`** — Builds a `lineNodeMap: Map<lineNumber, CodeNode[]>` from `node.codeRange` to render per-line colored borders and decision overlays. One line can belong to multiple nodes.

### Node Types

Four node types defined in `NODE_CONFIG` (each has unique shape + icon, not just color, for colorblind accessibility):
- `scope` — hexagon, red — imports, variables, setup
- `process` — rectangle, blue — transformations, logic
- `output` — rounded-rect, green — return values
- `decision` — diamond, yellow — conditionals, error handling

### View Modes

`viewMode` state (`"map" | "split" | "code"`) controls layout:
- `map`: NodeMap full-width + NodeInspector overlay
- `split`: NodeMap (50%) + CodePanel (50%)
- `code`: CodePanel full-width + MiniMap overlay

### AnalysisResult Schema

```typescript
{
  code: string;
  language: string;
  explanation: string;
  nodes: CodeNode[];     // 3-8 nodes, each with id, type, codeRange, variables, etc.
  edges: CodeEdge[];     // data flow + execution order between nodes
  concepts: ConceptCard[]; // 1-3 learning principles per analysis
}
```

Concepts are deduplicated by title across sessions in `allConcepts` state.

### Styling

Tailwind with custom CSS variables for the design system — node type colors are defined in `tailwind.config.ts` as `accent.scope`, `accent.process`, `accent.output`, `accent.decision`. Fonts: DM Sans (default), JetBrains Mono (code), Space Grotesk (display). Prism.js loaded via CDN in `app/layout.tsx` for syntax highlighting.
