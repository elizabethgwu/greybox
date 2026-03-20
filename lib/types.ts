// Types for CodeMap's node-based code visualization

export type NodeType = "scope" | "process" | "output" | "decision";

export interface CodeVariable {
  name: string;
  type: string;
  value?: string;
  description: string;
}

export interface CodeAssumption {
  text: string;
  confidence: "high" | "medium" | "low";
  alternative?: string;
}

export interface DecisionReason {
  chose: string;
  because: string;
  alternatives: {
    option: string;
    tradeoff: string;
  }[];
}

export interface CodeNode {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  codeRange: {
    startLine: number;
    endLine: number;
  };
  variables: CodeVariable[];
  assumptions: CodeAssumption[];
  decision?: DecisionReason;
  dependencies: string[]; // IDs of nodes this depends on
}

export interface CodeEdge {
  source: string;
  target: string;
  label?: string;
}

export interface AnalysisResult {
  code: string;
  language: string;
  explanation: string;
  nodes: CodeNode[];
  edges: CodeEdge[];
  concepts: ConceptCard[];
}

export interface ConceptCard {
  id: string;
  title: string;
  principle: string;
  relevance: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  analysis?: AnalysisResult;
  timestamp: number;
}

// Node visual config — shapes and icons per type for accessibility
export const NODE_CONFIG: Record<
  NodeType,
  {
    color: string;
    shape: "hexagon" | "rectangle" | "diamond" | "rounded-rect";
    icon: string;
    label: string;
  }
> = {
  scope: {
    color: "#E05252",
    shape: "hexagon",
    icon: "◈",
    label: "SCOPE",
  },
  process: {
    color: "#4A90D9",
    shape: "rectangle",
    icon: "⚙",
    label: "PROCESS",
  },
  output: {
    color: "#4CAF7D",
    shape: "rounded-rect",
    icon: "◉",
    label: "OUTPUT",
  },
  decision: {
    color: "#E5A832",
    shape: "diamond",
    icon: "⟐",
    label: "DECISION",
  },
};
