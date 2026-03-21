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
      ? { pillBg: "#e6e0d7", pillStroke: "#ddd7cc", edgeDefault: "#c4bdb2", edgeActive: "#5a5045", labelText: "#60564b", labelActive: "#3a3228", arrow: "#c4bdb2", arrowHi: "#5a5045" }
      : { pillBg: "#141414", pillStroke: "#2a2a2a", edgeDefault: "#333", edgeActive: "#888", labelText: "#555", labelActive: "#999", arrow: "#444", arrowHi: "#999" };

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

    // Edges — path from source center to just above target shape
    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;

      const isConnected = selectedNodeId
        ? edge.source === selectedNodeId || edge.target === selectedNodeId
        : false;
      const isDimmed = selectedNodeId ? !isConnected : false;

      // End path at top of target shape so arrowhead sits at shape edge
      const targetTop = target.y - NODE_SIZE;
      const midY = (source.y + targetTop) / 2;

      g.append("path")
        .attr("d", `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${targetTop}`)
        .attr("fill", "none")
        .attr("stroke", isConnected ? d3Colors.edgeActive : d3Colors.edgeDefault)
        .attr("stroke-width", isConnected ? 2 : 1.5)
        .attr("stroke-dasharray", isConnected ? "none" : "5,3")
        .attr("marker-end", isConnected ? "url(#arrowhead-hi)" : "url(#arrowhead)")
        .attr("opacity", isDimmed ? 0.45 : isConnected ? 1 : 0.6);

      if (edge.label) {
        const lx = (source.x + target.x) / 2;
        const ly = (source.y + targetTop) / 2;

        const labelG = g.append("g").attr("transform", `translate(${lx},${ly})`).attr("pointer-events", "none")
          .attr("opacity", isDimmed ? 0.45 : 1);

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
      }
    });

    // Nodes
    layoutNodes.forEach((node) => {
      const isSelected = node.id === selectedNodeId;
      const colorVar = `var(--accent-${node.type})`;

      const nodeG = g.append("g")
        .attr("transform", `translate(${node.x}, ${node.y})`)
        .attr("cursor", "pointer")
        .on("click", (event) => {
          event.stopPropagation();
          onNodeSelect(isSelected ? null : node.id);
        });

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
