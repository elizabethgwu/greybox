# Greybox — Visual Code Reasoning

**A prototype that allows you to see what your code is doing and how AI works with it so you can learn better.**

Instead of just showing you the answer, Greybox breaks code into visual node maps that reveal the *structure of reasoning* — scope, processing, output, and decision points. 

<img width="2032" height="1167" alt="Screenshot 2026-03-22 at 6 12 26 PM" src="https://github.com/user-attachments/assets/6926a240-8180-4ba1-98eb-69b84e3e224c" />


## The Problem

When developers ask AI for code help, they get working code but miss the reasoning:
- What assumptions did the AI make about the input?
- Where were the critical decision points?
- How does data flow through the logic?
- Which blocks of code serve which purpose?

Missing the reasoning means that you don't understand what is going on in the ML blackbox.

## The Solution

Greybox provides **two synchronized views** of every code analysis:

### Node Map (D3.js)
A visual graph showing the code's logical structure:
- **◈ Scope** (red hexagons) — imports, setup, variable declarations
- **⚙ Process** (blue rectangles) — transformations, computations, core logic
- **◉ Output** (green rounded rects) — return values, final results
- **⟐ Decision** (yellow diamonds) — conditionals, branching, error handling

Nodes are distinguishable by **shape and icon**, not just color (accessibility-first). This is based off of https://platform.claude.com/docs/en/build-with-claude/structured-outputs.

### Code Panel with Decision Overlay
The actual code with:
- Color-coded line markers showing which node each line belongs to
- **Decision annotations** overlaid directly on the code at the relevant lines
- Click any line to select its node and see variables/assumptions

### Node Inspector
Click any node to see:
- Variables in scope at that point
- Assumptions made (with confidence levels)
- For decision nodes: what was chosen, why, and what alternatives existed

### Concepts Sidebar
The Concepts Sidebar allows you to look into specific topics or use cases that you are encountering within your code. It provides a brief explanationo and an example from your own code so that you can see it illustrated.

### Variables Sidebar
The Variables Sidebar allows you to look at all of the variables within your code, sectioned by node. You can change the variable name as well as the contents and see it reflected within your code. This way, when you need to triage your code for bugs, you can see all your variables.

### Minimap
Navigation overview of the full node structure.

## Learning Science Foundation

| Principle | How Greybox Uses It |
|-----------|-------------------|
| **Dual Coding** (Paivio) | Visual node map + textual code = two memory traces |
| **Cognitive Load** (Sweller) | Minimap offloads "where am I?" from working memory |
| **Epistemic Transparency** (Ehsan et al.) | Decision overlay makes AI reasoning visible |
| **Generation Effect** (Slamecka & Graf) | Inspector prompts "what would you have done differently?" |
| **Metacognitive Awareness** (Flavell) | Concepts sidebar makes growing knowledge visible |

## Getting Started

### Prerequisites
- Node.js 18+
- An Anthropic API key ([get one here](https://console.anthropic.com/))

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd codemap

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

```bash
npm i -g vercel
vercel
# Add ANTHROPIC_API_KEY in Vercel dashboard → Settings → Environment Variables
```

## Architecture

```
codemap/
├── app/
│   ├── api/analyze/route.ts    # Claude API integration
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main orchestrator
│   └── globals.css             # Design tokens & styles
├── components/
│   ├── NodeMap.tsx             # D3.js node visualization
│   ├── MiniMap.tsx             # Navigation overview
│   ├── CodePanel.tsx           # Code view with overlays
│   ├── NodeInspector.tsx       # Node detail panel
│   ├── ConceptsSidebar.tsx     # Learning concepts accumulator
│   └── ChatInput.tsx           # Input with example prompts
├── lib/
│   ├── types.ts                # TypeScript types & node config
│   └── prompts.ts              # Claude prompt engineering
```

### Key Design Decisions

**D3.js over React Flow**: Full control over node shapes, animations, and accessibility markers. React Flow is faster to set up but constrains visual design — and the visual design *is* the product.

**Structured JSON prompts**: Claude returns a strict JSON schema with nodes, edges, variables, assumptions, and decisions. This is more reliable than parsing natural language and enables the synchronized views.

**Topological layout**: Nodes are arranged in layers based on dependency order (BFS from root nodes), creating a natural top-to-bottom flow that matches how developers read code.

**Accessibility-first node design**: Each node type has a unique shape AND icon, not just color. Hexagon/rectangle/diamond/rounded-rect + distinct Unicode symbols.

## Measuring Success

- **Comprehension**: Can users explain what a code block does after studying the node map vs. reading raw code?
- **Transfer**: After analyzing similar problems, can users identify patterns in new code?
- **Decision awareness**: Do users notice assumptions and alternatives they would have missed?
- **Engagement**: Time spent exploring nodes vs. just reading the answer

## Scaling

The architecture is domain-agnostic:
- The node type system (scope/process/output/decision) applies to any code
- The prompt engineering layer is the only domain-specific piece
- Concepts accumulate across sessions (future: spaced repetition)
- The D3 visualization handles 3-50+ nodes with zoom/pan

Future extensions:
- **Guide Me mode**: Node map builds progressively as user answers questions
- **Challenge mode**: Partially empty maps for the user to fill in
- **Collaborative**: Share node maps for code review either viewing the same canvas or exporting via Mermaid

## Tech Stack

- **Next.js 14** — React + API routes in one package
- **D3.js 7** — Full control over visual representation
- **TypeScript** — Type safety for the structured analysis schema
- **Tailwind CSS** — Rapid styling with design tokens
- **Claude API (Sonnet)** — Structured code analysis
- **Vercel** — One-click deployment

## License

MIT
