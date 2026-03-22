"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { CodeNode, CodeEdge, NODE_CONFIG, NodeType } from "@/lib/types";

interface NodeMapProps {
  nodes: CodeNode[];
  edges: CodeEdge[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  width?: number;
  height?: number;
  colorblindMode?: boolean;
  lightMode?: boolean;
}

interface LayoutNode extends CodeNode {
  x: number;
  y: number;
}

const NODE_SIZE = 32;
// Node bottom (shape + type pill + name pill) sits at y+80.
// Edge label at layer midpoint needs gap > 180 to avoid overlap.
const MIN_LAYER_GAP = 280;
// Max name label ~220px wide centered, so nodes need > 220px horizontal clearance.
const MIN_NODE_GAP = 240;

// Returns how far the shape extends above/below its center point.
// hexagon/diamond have a vertex at top and bottom; rect/rounded-rect have a flat edge.
function shapeVerticalExtent(type: NodeType): { top: number; bottom: number } {
  const shape = NODE_CONFIG[type].shape;
  const extent = (shape === "rectangle" || shape === "rounded-rect") ? NODE_SIZE * 0.7 : NODE_SIZE;
  return { top: extent, bottom: extent };
}

function computeLayout(nodes: CodeNode[], edges: CodeEdge[], width: number, height: number): LayoutNode[] {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  nodes.forEach((n) => { adj.set(n.id, []); inDeg.set(n.id, 0); });
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
  });

  const layers: string[][] = [];
  let queue = nodes.filter((n) => (inDeg.get(n.id) || 0) === 0).map((n) => n.id);
  const visited = new Set<string>();
  while (queue.length > 0) {
    layers.push([...queue]);
    queue.forEach((id) => visited.add(id));
    const next: string[] = [];
    queue.forEach((id) => {
      (adj.get(id) || []).forEach((target) => {
        if (!visited.has(target)) {
          inDeg.set(target, (inDeg.get(target) || 0) - 1);
          if (inDeg.get(target) === 0) next.push(target);
        }
      });
    });
    queue = next;
  }
  nodes.forEach((n) => { if (!visited.has(n.id)) { layers.push([n.id]); visited.add(n.id); } });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const paddingY = 120;
  const rawLayerGap = layers.length > 1 ? (height - paddingY * 2) / (layers.length - 1) : 0;
  const layerGap = Math.max(rawLayerGap, MIN_LAYER_GAP);

  const layoutNodes: LayoutNode[] = [];
  layers.forEach((layer, li) => {
    const rawNodeGap = layer.length > 1 ? (width - 160) / (layer.length - 1) : 0;
    const nodeGap = Math.max(rawNodeGap, MIN_NODE_GAP);
    const layerWidth = (layer.length - 1) * nodeGap;
    const startX = (width - layerWidth) / 2;
    layer.forEach((id, ni) => {
      const node = nodeMap.get(id);
      if (!node) return;
      layoutNodes.push({
        ...node,
        x: layer.length === 1 ? width / 2 : startX + ni * nodeGap,
        y: layers.length === 1 ? height / 2 : paddingY + li * layerGap,
      });
    });
  });
  return layoutNodes;
}

// Append a background rect sized to fit the text via getBBox.
// Rect is appended first (behind text in SVG paint order).
function appendPill(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  text: string,
  yTop: number,
  height: number,
  rx: number,
  fontSize: number,
  fontFamily: string,
  letterSpacing: string,
  fontWeight: string,
  textColor: string,
  padX = 10,
  pillBg = "#141414",
  pillStroke = "#2a2a2a",
): void {
  // Pill bg/stroke are passed as optional params to support light mode
  const pillRect = g.append("rect")
    .attr("y", yTop)
    .attr("height", height)
    .attr("rx", rx)
    .attr("fill", pillBg)
    .attr("stroke", pillStroke)
    .attr("stroke-width", 0.5)
    .attr("pointer-events", "none");

  const pillText = g.append("text")
    .attr("text-anchor", "middle")
    .attr("y", yTop + height * 0.72)
    .attr("font-size", fontSize)
    .attr("font-family", fontFamily)
    .attr("font-weight", fontWeight)
    .attr("letter-spacing", letterSpacing)
    .attr("fill", textColor)
    .attr("pointer-events", "none")
    .text(text);

  // Measure actual rendered width and resize rect to fit exactly
  const bbox = (pillText.node() as SVGTextElement | null)?.getBBox();
  const w = (bbox?.width ?? fontSize * text.length * 0.6) + padX * 2;
  pillRect.attr("x", -w / 2).attr("width", w);
}

function drawNodeShape(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  type: NodeType,
  size: number,
  isSelected: boolean,
  pillBg = "#141414",
  pillStroke = "#2a2a2a",
) {
  const config = NODE_CONFIG[type];
  const colorVar = `var(--accent-${type})`;
  // Selected: thick stroke + opaque fill. Unselected: thin stroke + transparent fill.
  const strokeW = isSelected ? 4 : 2;
  const fillStyle = isSelected
    ? colorVar
    : `color-mix(in srgb, ${colorVar} 13%, transparent)`;

  g.selectAll("*").remove();

  switch (config.shape) {
    case "hexagon": {
      const r = size;
      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
      }).join(" ");
      g.append("polygon").attr("class", "node-shape").attr("points", points)
        .attr("stroke-width", strokeW).style("fill", fillStyle).style("stroke", colorVar);
      break;
    }
    case "rectangle":
      g.append("rect").attr("class", "node-shape")
        .attr("x", -size).attr("y", -size * 0.7).attr("width", size * 2).attr("height", size * 1.4).attr("rx", 4)
        .attr("stroke-width", strokeW).style("fill", fillStyle).style("stroke", colorVar);
      break;
    case "diamond": {
      const s = size;
      g.append("polygon").attr("class", "node-shape").attr("points", `0,${-s} ${s},0 0,${s} ${-s},0`)
        .attr("stroke-width", strokeW).style("fill", fillStyle).style("stroke", colorVar);
      break;
    }
    case "rounded-rect":
      g.append("rect").attr("class", "node-shape")
        .attr("x", -size).attr("y", -size * 0.7).attr("width", size * 2).attr("height", size * 1.4).attr("rx", size * 0.35)
        .attr("stroke-width", strokeW).style("fill", fillStyle).style("stroke", colorVar);
      break;
  }

  // Icon — white on solid fill when selected for contrast
  g.append("text")
    .attr("text-anchor", "middle").attr("dominant-baseline", "central")
    .attr("y", -1).attr("font-size", 14)
    .attr("pointer-events", "none")
    .style("fill", isSelected ? "#fff" : colorVar)
    .text(config.icon);

  // Type badge — sized to actual rendered text
  appendPill(g, config.label, size + 8, 16, 3, 9, "monospace", "0.1em", "500", colorVar, 7, pillBg, pillStroke);
}

export default function NodeMap({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  width = 600,
  height = 500,
  lightMode = false,
}: NodeMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);

  const nodeKeyRef = useRef<string>("");
  const savedTransformRef = useRef<d3.ZoomTransform | null>(null);

  useEffect(() => {
    if (nodes.length === 0) return;
    setLayoutNodes(computeLayout(nodes, edges, width, height));
  }, [nodes, edges, width, height]);

  useEffect(() => {
    if (!svgRef.current || layoutNodes.length === 0) return;

    const nodeKey = layoutNodes.map((n) => n.id).join(",");
    const isNewData = nodeKey !== nodeKeyRef.current;
    nodeKeyRef.current = nodeKey;

    if (!isNewData && svgRef.current) {
      savedTransformRef.current = d3.zoomTransform(svgRef.current);
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Light/dark palette for D3 inline colors
    const d3Colors = lightMode
      ? { pageBg: "#f0ebe3", pillBg: "#e6e0d7", pillStroke: "#ddd7cc", edgeDefault: "#c4bdb2", edgeActive: "#5a5045", labelText: "#60564b", labelActive: "#3a3228", arrow: "#c4bdb2", arrowHi: "#5a5045" }
      : { pageBg: "#0d0d0d", pillBg: "#141414", pillStroke: "#2a2a2a", edgeDefault: "#333", edgeActive: "#888", labelText: "#555", labelActive: "#999", arrow: "#444", arrowHi: "#999" };

    const defs = svg.append("defs");
    // Default arrowhead
    defs.append("marker")
      .attr("id", "arrowhead").attr("viewBox", "0 0 10 7")
      .attr("refX", 9).attr("refY", 3.5)
      .attr("markerWidth", 6).attr("markerHeight", 4)
      .attr("orient", "auto")
      .append("polygon").attr("points", "0 0, 10 3.5, 0 7").attr("fill", d3Colors.arrow);
    // Highlighted arrowhead (for edges connected to selected node)
    defs.append("marker")
      .attr("id", "arrowhead-hi").attr("viewBox", "0 0 10 7")
      .attr("refX", 9).attr("refY", 3.5)
      .attr("markerWidth", 6).attr("markerHeight", 4)
      .attr("orient", "auto")
      .append("polygon").attr("points", "0 0, 10 3.5, 0 7").attr("fill", d3Colors.arrowHi);

    const g = svg.append("g");

    let dragOccurred = false;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("start", () => { dragOccurred = false; })
      .on("zoom", (event) => {
        if (event.sourceEvent) dragOccurred = true;
        g.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    if (!isNewData && savedTransformRef.current) {
      svg.call(zoom.transform, savedTransformRef.current);
    } else {
      const allX = layoutNodes.map((n) => n.x);
      const allY = layoutNodes.map((n) => n.y);
      const minX = Math.min(...allX) - 120;
      const maxX = Math.max(...allX) + 120;
      const minY = Math.min(...allY) - 44;
      const maxY = Math.max(...allY) + 90;
      const cW = maxX - minX;
      const cH = maxY - minY;
      const scale = Math.min(width / cW, height / cH, 1);
      const tx = (width - cW * scale) / 2 - minX * scale;
      const ty = (height - cH * scale) / 2 - minY * scale;
      const fit = d3.zoomIdentity.translate(tx, ty).scale(scale);
      svg.call(zoom.transform, fit);
      savedTransformRef.current = fit;
    }

    const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
    const nodeLayerMap = new Map<string, number>();

    // Compute layer index per node (BFS) so we can detect long-range edges
    {
      const adjL = new Map<string, string[]>();
      const inDegL = new Map<string, number>();
      layoutNodes.forEach(n => { adjL.set(n.id, []); inDegL.set(n.id, 0); });
      edges.forEach(e => {
        adjL.get(e.source)?.push(e.target);
        inDegL.set(e.target, (inDegL.get(e.target) || 0) + 1);
      });
      let bfsQ = layoutNodes.filter(n => !inDegL.get(n.id)).map(n => n.id);
      const bfsVis = new Set<string>();
      let li = 0;
      while (bfsQ.length) {
        bfsQ.forEach(id => { nodeLayerMap.set(id, li); bfsVis.add(id); });
        const next: string[] = [];
        bfsQ.forEach(id => (adjL.get(id) || []).forEach(t => {
          if (!bfsVis.has(t)) {
            inDegL.set(t, (inDegL.get(t) || 0) - 1);
            if (!inDegL.get(t)) next.push(t);
          }
        }));
        bfsQ = next; li++;
      }
      layoutNodes.forEach(n => { if (!nodeLayerMap.has(n.id)) nodeLayerMap.set(n.id, li++); });
    }

    // Build edge routes — compute control points before drawing
    interface EdgeRoute {
      edge: CodeEdge;
      source: LayoutNode;
      target: LayoutNode;
      sourceBottom: number;
      targetTop: number;
      labelX: number; labelY: number;
      isConnected: boolean;
      isDimmed: boolean;
      lateralOffset: number;
    }

    const routes: EdgeRoute[] = [];
    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;
      const isConnected = selectedNodeId
        ? edge.source === selectedNodeId || edge.target === selectedNodeId
        : false;
      const isDimmed = selectedNodeId ? !isConnected : false;
      const sourceBottom = source.y + shapeVerticalExtent(source.type).bottom;
      // Stop the path 10px before the target shape so the arrowhead sits in
      // the gap between nodes rather than rendering inside the target.
      const targetTop = target.y - shapeVerticalExtent(target.type).top - 10;
      const srcLayer = nodeLayerMap.get(edge.source) ?? 0;
      const tgtLayer = nodeLayerMap.get(edge.target) ?? 0;
      const lateralOffset = tgtLayer - srcLayer > 1 ? 100 : 0;
      const midY = (sourceBottom + targetTop) / 2;
      routes.push({
        edge, source, target, sourceBottom, targetTop,
        // At t=0.5 on a laterally-offset bezier, midpoint shifts by 0.75 * offset
        labelX: (source.x + target.x) / 2 + lateralOffset * 0.75,
        labelY: midY,
        isConnected, isDimmed, lateralOffset,
      });
    });

    // Step 1 — Push edge labels away from intermediate nodes.
    // A label at the midpoint of a long-range edge often lands exactly on an
    // intermediate node. The node's background blocker hides thin paths but
    // label pills can be 300–400px wide and bleed outside the blocker area.
    for (const route of routes) {
      if (!route.edge.label) continue;
      let moved = true;
      let guard = 0;
      while (moved && guard++ < 6) {
        moved = false;
        for (const node of layoutNodes) {
          if (node.id === route.edge.source || node.id === route.edge.target) continue;
          const nodeTop    = node.y - NODE_SIZE - 10;   // above shape
          const nodeBottom = node.y + NODE_SIZE + 60;   // below name pill
          if (route.labelY > nodeTop && route.labelY < nodeBottom) {
            route.labelY = nodeBottom + 16;             // push below node
            moved = true;
          }
        }
      }
    }

    // Step 2 — Separate labels that are too close vertically (parallel edges).
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        if (!routes[i].edge.label || !routes[j].edge.label) continue;
        const dx = Math.abs(routes[i].labelX - routes[j].labelX);
        const dy = Math.abs(routes[i].labelY - routes[j].labelY);
        if (dx < 80 && dy < 24) {
          routes[i].labelY -= 14;
          routes[j].labelY += 14;
        }
      }
    }

    // Render unconnected edges first so selected/connected edges appear on top
    const sortedRoutes = [...routes].sort((a, b) => +a.isConnected - +b.isConnected);

    // Two-pass rendering: all paths first, then all labels on top.
    // This prevents one edge's path from painting over another edge's label.
    const edgePathsG = g.append("g");
    const edgeLabelsG = g.append("g");

    sortedRoutes.forEach(({ source, target, sourceBottom, targetTop, isConnected, isDimmed, lateralOffset }) => {
      const midY = (sourceBottom + targetTop) / 2;
      edgePathsG.append("path")
        .attr("d", `M ${source.x} ${sourceBottom} C ${source.x + lateralOffset} ${midY} ${target.x + lateralOffset} ${midY} ${target.x} ${targetTop}`)
        .attr("fill", "none")
        .attr("stroke", isConnected ? d3Colors.edgeActive : d3Colors.edgeDefault)
        .attr("stroke-width", isDimmed ? 1 : isConnected ? 2 : 1.5)
        .attr("stroke-dasharray", isConnected ? "none" : "5,3")
        .attr("marker-end", isConnected ? "url(#arrowhead-hi)" : "url(#arrowhead)")
        .attr("opacity", isDimmed ? 0.08 : isConnected ? 1 : 0.6);
    });

    sortedRoutes.forEach(({ edge, labelX, labelY, isConnected, isDimmed }) => {
      if (!edge.label) return;
      const labelG = edgeLabelsG.append("g").attr("transform", `translate(${labelX},${labelY})`).attr("pointer-events", "none")
        .attr("opacity", isDimmed ? 0.08 : 1);

      const edgeRect = labelG.append("rect")
        .attr("y", -9).attr("height", 16).attr("rx", 3)
        .attr("fill", d3Colors.pillBg)
        .attr("stroke", d3Colors.pillStroke)
        .attr("stroke-width", 0.5);

      const edgeText = labelG.append("text")
        .attr("text-anchor", "middle").attr("y", 4)
        .attr("font-size", 9)
        .attr("fill", isConnected ? d3Colors.labelActive : d3Colors.labelText)
        .attr("font-family", "monospace")
        .text(edge.label);

      const ebbox = (edgeText.node() as SVGTextElement | null)?.getBBox();
      const ew = (ebbox?.width ?? 60) + 16;
      edgeRect.attr("x", -ew / 2).attr("width", ew);
    });

    // Nodes — selected node rendered last so it appears above all paths
    const sortedNodes = [...layoutNodes].sort((a, b) =>
      a.id === selectedNodeId ? 1 : b.id === selectedNodeId ? -1 : 0
    );
    sortedNodes.forEach((node) => {
      const isSelected = node.id === selectedNodeId;
      const colorVar = `var(--accent-${node.type})`;

      const nodeG = g.append("g")
        .attr("transform", `translate(${node.x}, ${node.y})`)
        .attr("cursor", "pointer")
        .on("click", (event) => {
          event.stopPropagation();
          onNodeSelect(isSelected ? null : node.id);
        });

      // Background shape (slightly larger than node, page bg color) blocks edges
      // passing through. Colocated in nodeG so it moves with zoom/pan correctly.
      const pad = 14;
      const bg = d3Colors.pageBg;
      const shape = NODE_CONFIG[node.type].shape;
      switch (shape) {
        case "hexagon": {
          const r = NODE_SIZE + pad;
          const pts = Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            return `${r * Math.cos(a)},${r * Math.sin(a)}`;
          }).join(" ");
          nodeG.append("polygon").attr("points", pts).attr("fill", bg).attr("stroke", "none").attr("pointer-events", "none");
          break;
        }
        case "rectangle":
          nodeG.append("rect")
            .attr("x", -(NODE_SIZE + pad)).attr("y", -(NODE_SIZE * 0.7 + pad))
            .attr("width", (NODE_SIZE + pad) * 2).attr("height", (NODE_SIZE * 0.7 + pad) * 2).attr("rx", 4)
            .attr("fill", bg).attr("stroke", "none").attr("pointer-events", "none");
          break;
        case "diamond": {
          const s = NODE_SIZE + pad;
          nodeG.append("polygon")
            .attr("points", `0,${-s} ${s},0 0,${s} ${-s},0`)
            .attr("fill", bg).attr("stroke", "none").attr("pointer-events", "none");
          break;
        }
        case "rounded-rect": {
          const s = NODE_SIZE + pad;
          nodeG.append("rect")
            .attr("x", -s).attr("y", -(NODE_SIZE * 0.7 + pad))
            .attr("width", s * 2).attr("height", (NODE_SIZE * 0.7 + pad) * 2).attr("rx", s * 0.35)
            .attr("fill", bg).attr("stroke", "none").attr("pointer-events", "none");
          break;
        }
      }
      // Background rect covering the label area (type badge + name pill) below the shape
      nodeG.append("rect")
        .attr("x", -112).attr("y", NODE_SIZE + 4)
        .attr("width", 224).attr("height", 48)
        .attr("fill", bg).attr("stroke", "none").attr("pointer-events", "none");

      drawNodeShape(nodeG, node.type, NODE_SIZE, isSelected, d3Colors.pillBg, d3Colors.pillStroke);

      // Name label — pill sized to actual text via getBBox
      const labelText = node.label.length > 26 ? node.label.slice(0, 24) + "…" : node.label;
      const nameLabelColor = lightMode
        ? (isSelected ? "#111" : "#333")
        : (isSelected ? "#fff" : "#ccc");
      appendPill(
        nodeG, labelText,
        NODE_SIZE + 26, 20, 4,
        12, "sans-serif", "0", "600",
        nameLabelColor,
        10,
        d3Colors.pillBg,
        d3Colors.pillStroke,
      );

      // Hover — only target the node shape, not label rects
      nodeG
        .on("mouseenter", function () {
          if (isSelected) return; // already fully highlighted
          d3.select(this).select(".node-shape")
            .attr("stroke-width", 3)
            .style("fill", `color-mix(in srgb, ${colorVar} 28%, transparent)`);
        })
        .on("mouseleave", function () {
          if (isSelected) return;
          d3.select(this).select(".node-shape")
            .attr("stroke-width", 2)
            .style("fill", `color-mix(in srgb, ${colorVar} 13%, transparent)`);
        });
    });

    svg.on("click", () => { if (!dragOccurred) onNodeSelect(null); });

  }, [layoutNodes, edges, selectedNodeId, onNodeSelect, width, height, lightMode]);

  return (
    <svg
      ref={svgRef}
      width="100%" height="100%"
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      className="block bg-transparent"
    />
  );
}
