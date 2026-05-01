"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type MouseEvent,
  type WheelEvent,
} from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  Network,
  ListTree,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface MindmapNode {
  id: string;
  label: string;
  type: "root" | "topic" | "concept" | "detail";
}

export interface MindmapEdge {
  source: string;
  target: string;
  label?: string;
}

interface MindmapData {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  generatedAt?: string;
}

interface LayoutNode extends MindmapNode {
  x: number;
  y: number;
}

interface MindmapTabProps {
  spaceId: string;
  userId: string;
  spaceName: string;
  hasContent: boolean;
  /** Called when user clicks root node in tree view */
  onNavigateToChat: (topic: string) => void;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const NODE_FILL: Record<MindmapNode["type"], string> = {
  root: "#8b5cf6",
  topic: "#3b82f6",
  concept: "#10b981",
  detail: "#f59e0b",
};

const NODE_RADIUS: Record<MindmapNode["type"], number> = {
  root: 46,
  topic: 34,
  concept: 26,
  detail: 18,
};

const FONT_SIZE: Record<MindmapNode["type"], number> = {
  root: 12,
  topic: 10,
  concept: 9,
  detail: 8,
};

const LAYOUT_RADII = [0, 200, 390, 560];

const LABEL_MAX: Record<MindmapNode["type"], number> = {
  root: 12,
  topic: 14,
  concept: 12,
  detail: 11,
};

// --------------------------------------------------------------------------
// Layout Algorithm (radial tree)
// --------------------------------------------------------------------------

function computeLayout(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
): LayoutNode[] {
  if (!nodes.length) return [];

  const children: Record<string, string[]> = {};
  const hasParent: Record<string, boolean> = {};

  for (const n of nodes) children[n.id] = [];

  for (const e of edges) {
    if (children[e.source] !== undefined) {
      children[e.source].push(e.target);
    }
    hasParent[e.target] = true;
  }

  const rootId = nodes.find((n) => !hasParent[n.id])?.id ?? nodes[0].id;

  const depths: Record<string, number> = { [rootId]: 0 };
  const bfsQueue: string[] = [rootId];
  while (bfsQueue.length) {
    const id = bfsQueue.shift()!;
    for (const child of children[id] ?? []) {
      if (depths[child] === undefined) {
        depths[child] = depths[id] + 1;
        bfsQueue.push(child);
      }
    }
  }

  function subtreeSize(id: string): number {
    const kids = children[id] ?? [];
    if (!kids.length) return 1;
    return kids.reduce((s, k) => s + subtreeSize(k), 0);
  }

  const positions: Record<string, { x: number; y: number }> = {};

  function layout(id: string, startAngle: number, endAngle: number) {
    const depth = depths[id] ?? 0;
    const r = LAYOUT_RADII[Math.min(depth, LAYOUT_RADII.length - 1)];
    const midAngle = (startAngle + endAngle) / 2;
    positions[id] = {
      x: r === 0 ? 0 : r * Math.cos(midAngle),
      y: r === 0 ? 0 : r * Math.sin(midAngle),
    };
    const kids = children[id] ?? [];
    if (!kids.length) return;
    const totalSize = kids.reduce((s, k) => s + subtreeSize(k), 0);
    let angle = startAngle;
    for (const kid of kids) {
      const portion = subtreeSize(kid) / totalSize;
      const span = portion * (endAngle - startAngle);
      layout(kid, angle, angle + span);
      angle += span;
    }
  }

  layout(rootId, 0, 2 * Math.PI);

  return nodes.map((n) => ({
    ...n,
    x: positions[n.id]?.x ?? 0,
    y: positions[n.id]?.y ?? 0,
  }));
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function truncateLabel(label: string, type: MindmapNode["type"]): string[] {
  const max = LABEL_MAX[type];
  if (label.length <= max) return [label];
  // try to split into two lines at a word boundary around the midpoint
  const mid = Math.floor(label.length / 2);
  const spaceAfter = label.indexOf(" ", mid);
  const spaceBefore = label.lastIndexOf(" ", mid);
  const splitAt =
    spaceAfter !== -1 && spaceAfter - mid <= 4
      ? spaceAfter
      : spaceBefore !== -1
        ? spaceBefore
        : mid;
  const line1 = label.slice(0, splitAt).trim();
  const line2 = label.slice(splitAt).trim();
  if (!line2) return [label.slice(0, max - 1) + "…"];
  const maxLine = Math.ceil(max * 0.7);
  return [
    line1.length > maxLine ? line1.slice(0, maxLine - 1) + "…" : line1,
    line2.length > maxLine ? line2.slice(0, maxLine - 1) + "…" : line2,
  ];
}

function edgePath(
  s: LayoutNode,
  t: LayoutNode,
  sRadius: number,
  tRadius: number,
): string {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  const x1 = s.x + nx * sRadius;
  const y1 = s.y + ny * sRadius;
  const x2 = t.x - nx * tRadius;
  const y2 = t.y - ny * tRadius;

  // Mid-point with a slight curve
  const mx = (x1 + x2) / 2 - ny * 30;
  const my = (y1 + y2) / 2 + nx * 30;

  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

// ==========================================================================
// TREE VIEW — collapsible horizontal tree (NotebookLM-style)
// ==========================================================================

const TREE_X_STEP = 240;
const TREE_Y_STEP = 62;
const NODE_W = 190;
const NODE_H = 44;
const NODE_RX = 10;

// Figma-style: tinted bg + strong border, with separate dark/light text
const TREE_DEPTH_PALETTE = [
  {
    bg: "rgba(139, 92, 246, 0.18)",
    lightBg: "rgba(139, 92, 246, 0.10)",
    border: "#8b5cf6",
    borderHover: "#a78bfa",
    text: "#ddd6fe",
    lightText: "#5b21b6",
    textHover: "#ffffff",
    lightTextHover: "#ffffff",
  },
  {
    bg: "rgba(59, 130, 246, 0.16)",
    lightBg: "rgba(59, 130, 246, 0.10)",
    border: "#3b82f6",
    borderHover: "#60a5fa",
    text: "#bfdbfe",
    lightText: "#1e40af",
    textHover: "#ffffff",
    lightTextHover: "#ffffff",
  },
  {
    bg: "rgba(16, 185, 129, 0.16)",
    lightBg: "rgba(16, 185, 129, 0.10)",
    border: "#10b981",
    borderHover: "#34d399",
    text: "#a7f3d0",
    lightText: "#065f46",
    textHover: "#ffffff",
    lightTextHover: "#ffffff",
  },
  {
    bg: "rgba(245, 158, 11, 0.16)",
    lightBg: "rgba(245, 158, 11, 0.10)",
    border: "#f59e0b",
    borderHover: "#fbbf24",
    text: "#fde68a",
    lightText: "#92400e",
    textHover: "#ffffff",
    lightTextHover: "#ffffff",
  },
  {
    bg: "rgba(236, 72, 153, 0.16)",
    lightBg: "rgba(236, 72, 153, 0.10)",
    border: "#ec4899",
    borderHover: "#f472b6",
    text: "#fbcfe8",
    lightText: "#831843",
    textHover: "#ffffff",
    lightTextHover: "#ffffff",
  },
];
function depthPalette(d: number) {
  return TREE_DEPTH_PALETTE[Math.min(d, TREE_DEPTH_PALETTE.length - 1)];
}
function depthColor(d: number) {
  return depthPalette(d).border;
}

interface TreeLayoutNode extends MindmapNode {
  x: number;
  y: number;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
}

function computeTreeLayout(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  collapsed: Set<string>,
): TreeLayoutNode[] {
  if (!nodes.length) return [];
  const allChildren: Record<string, string[]> = {};
  const hasParent: Record<string, boolean> = {};
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) allChildren[n.id] = [];
  for (const e of edges) {
    if (allChildren[e.source] !== undefined)
      allChildren[e.source].push(e.target);
    hasParent[e.target] = true;
  }
  const rootId = nodes.find((n) => !hasParent[n.id])?.id ?? nodes[0].id;
  const result: TreeLayoutNode[] = [];
  let yCounter = 0;
  function dfs(id: string, depth: number): number {
    const node = nodeById.get(id);
    if (!node) return yCounter * TREE_Y_STEP;
    const rawKids = allChildren[id] ?? [];
    const hasKids = rawKids.length > 0;
    const isCollapsed = collapsed.has(id);
    if (!hasKids || isCollapsed) {
      const y = yCounter * TREE_Y_STEP;
      yCounter++;
      result.push({
        ...node,
        x: depth * TREE_X_STEP,
        y,
        depth,
        hasChildren: hasKids,
        isCollapsed,
      });
      return y;
    }
    const idx = result.length;
    result.push({
      ...node,
      x: depth * TREE_X_STEP,
      y: 0,
      depth,
      hasChildren: true,
      isCollapsed: false,
    });
    const childYs: number[] = [];
    for (const child of rawKids) childYs.push(dfs(child, depth + 1));
    const midY = (childYs[0] + childYs[childYs.length - 1]) / 2;
    result[idx] = { ...result[idx], y: midY };
    return midY;
  }
  dfs(rootId, 0);
  return result;
}

function treeBezier(px: number, py: number, cx: number, cy: number): string {
  const x1 = px + NODE_W;
  const y1 = py + NODE_H / 2;
  const x2 = cx;
  const y2 = cy + NODE_H / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

interface TreeViewProps {
  data: MindmapData;
  onNavigateToChat: (topic: string) => void;
}

function TreeView({ data, onNavigateToChat }: TreeViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Pre-collapse all nodes at depth ≥ 1 that have children → start concise
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const childMap: Record<string, string[]> = {};
    const hasParentMap: Record<string, boolean> = {};
    for (const n of data.nodes) childMap[n.id] = [];
    for (const e of data.edges) {
      if (childMap[e.source] !== undefined) childMap[e.source].push(e.target);
      hasParentMap[e.target] = true;
    }
    const rootId = data.nodes.find((n) => !hasParentMap[n.id])?.id;
    const depths: Record<string, number> = {};
    if (rootId) {
      depths[rootId] = 0;
      const queue = [rootId];
      while (queue.length) {
        const id = queue.shift()!;
        for (const child of childMap[id] ?? []) {
          if (depths[child] === undefined) {
            depths[child] = depths[id] + 1;
            queue.push(child);
          }
        }
      }
    }
    const set = new Set<string>();
    for (const [id, children] of Object.entries(childMap)) {
      if (children.length > 0 && (depths[id] ?? 0) >= 1) set.add(id);
    }
    return set;
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40, scale: 1 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Track which node ids were visible on the previous render so we can
  // fade-in nodes that are newly entering.
  const prevVisibleIds = useRef<Set<string>>(new Set());

  // Build child/parent maps used for rootId + visibleEdges
  const allChildrenMap: Record<string, string[]> = {};
  const hasParentMap: Record<string, boolean> = {};
  for (const n of data.nodes) allChildrenMap[n.id] = [];
  for (const e of data.edges) {
    if (allChildrenMap[e.source] !== undefined)
      allChildrenMap[e.source].push(e.target);
    hasParentMap[e.target] = true;
  }
  const rootId =
    data.nodes.find((n) => !hasParentMap[n.id])?.id ?? data.nodes[0]?.id;

  const treeNodes = computeTreeLayout(data.nodes, data.edges, collapsed);
  const treeMap = new Map(treeNodes.map((n) => [n.id, n]));

  const visibleEdges = data.edges.filter((e) => {
    const parent = treeMap.get(e.source);
    const child = treeMap.get(e.target);
    return parent && child && !parent.isCollapsed;
  });

  // After render, remember current visible ids for next comparison
  useEffect(() => {
    prevVisibleIds.current = new Set(treeNodes.map((n) => n.id));
  });

  const toggleCollapse = useCallback(
    (id: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    [],
  );

  const handleWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setPan((t) => ({
      ...t,
      scale: Math.min(4, Math.max(0.2, t.scale * factor)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const stopDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  const resetView = useCallback(() => setPan({ x: 40, y: 40, scale: 1 }), []);

  const maxY = Math.max(...treeNodes.map((n) => n.y + NODE_H), 0) + 80;
  const svgHeight = Math.min(Math.max(480, maxY + 80), 680);

  // Animation timing
  const MOVE_DUR = "0.45s";
  const FADE_DUR = "0.3s";
  const EASE = "cubic-bezier(0.4,0,0.2,1)";
  const ICON_DUR = "0.2s";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-between items-center gap-y-2">
        <p className="text-xs text-muted-foreground">
          Click any node to explain in{" "}
          <span className="font-semibold text-primary">Study Chat</span> · Click
          the <span className="font-semibold text-primary">arrow</span> to
          expand/collapse
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {(
            [
              ["root", "Root"],
              ["topic", "Topic"],
              ["concept", "Concept"],
              ["detail", "Detail"],
            ] as const
          ).map(([type, label]) => (
            <span
              key={type}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: NODE_FILL[type] }}
              />
              {label}
            </span>
          ))}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="icon"
              title="Zoom in"
              onClick={() =>
                setPan((t) => ({ ...t, scale: Math.min(4, t.scale * 1.25) }))
              }>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Zoom out"
              onClick={() =>
                setPan((t) => ({ ...t, scale: Math.max(0.2, t.scale / 1.25) }))
              }>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Reset view"
              onClick={resetView}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="relative overflow-hidden border-border/60 bg-white dark:bg-[#0d0d14]">
        <svg
          ref={svgRef}
          className="w-full select-none"
          style={{
            height: svgHeight,
            cursor: dragging.current ? "grabbing" : "grab",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}>
          <defs>
            <pattern
              id="tree-grid"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.06" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tree-grid)" />

          {/* Pan/zoom wrapper — uses attribute transform (no need to animate this) */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${pan.scale})`}>
            {/* ── EDGES ─────────────────────────────────────────
                Key edges by "source→target" so they persist across
                collapses and CSS can transition the path `d`.
                We use a CSS animation on opacity for enter/exit.     */}
            {visibleEdges.map((edge) => {
              const parent = treeMap.get(edge.source);
              const child = treeMap.get(edge.target);
              if (!parent || !child) return null;
              const pal = depthPalette(parent.depth);
              const d = treeBezier(parent.x, parent.y, child.x, child.y);
              const isNew = !prevVisibleIds.current.has(child.id);
              return (
                <path
                  key={`${edge.source}→${edge.target}`}
                  d={d}
                  stroke={pal.border}
                  strokeWidth={parent.depth === 0 ? 2 : 1.5}
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    strokeOpacity: 0.6,
                    opacity: isNew ? 0 : 1,
                    animation: isNew
                      ? `mmFadeIn ${FADE_DUR} ${EASE} forwards`
                      : undefined,
                    transition: `opacity ${FADE_DUR} ${EASE}`,
                  }}
                />
              );
            })}

            {/* ── NODES ─────────────────────────────────────────
                position via CSS transform so the browser can
                interpolate X/Y when the tree reflows.               */}
            {treeNodes.map((node) => {
              const pal = depthPalette(node.depth);
              const isHovered = hoveredId === node.id;
              const isRoot = node.id === rootId;
              const labelText =
                node.label.length > 22
                  ? node.label.slice(0, 21) + "…"
                  : node.label;

              const nodeBg = isDark ? pal.bg : pal.lightBg;
              const nodeText = isDark ? pal.text : pal.lightText;
              const hoverBg = pal.border + (isDark ? "40" : "25");

              const isNew = !prevVisibleIds.current.has(node.id);

              // Chevron hit-area offset (right edge of node)
              const chevX = NODE_W - 28;
              const chevY = (NODE_H - 28) / 2;

              return (
                <g
                  key={node.id}
                  // CSS transform → animatable by the browser
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px)`,
                    transition: `transform ${MOVE_DUR} ${EASE}`,
                    opacity: isNew ? 0 : 1,
                    animation: isNew
                      ? `mmFadeIn ${FADE_DUR} ${EASE} ${isNew ? "0.05s" : "0s"} forwards`
                      : undefined,
                    cursor: "pointer",
                    filter: isHovered
                      ? `drop-shadow(0 0 9px ${pal.border}66)`
                      : undefined,
                  }}
                  onClick={() => onNavigateToChat(node.label)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}>
                  {/* Background rect */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={NODE_RX}
                    style={{
                      fill: isHovered ? hoverBg : nodeBg,
                      stroke: isHovered ? pal.borderHover : pal.border,
                      strokeWidth: isRoot ? 2.5 : 1.8,
                      transition: `fill ${ICON_DUR} ${EASE}, stroke ${ICON_DUR} ${EASE}`,
                    }}
                  />

                  {/* Root chat icon */}
                  {isRoot && (
                    <g
                      transform={`translate(${NODE_W - 24}, ${(NODE_H - 15) / 2})`}
                      style={{ pointerEvents: "none" }}>
                      <MessageCircle
                        width={15}
                        height={15}
                        style={{
                          color: isHovered ? "#fff" : pal.border,
                          transition: `color ${ICON_DUR} ${EASE}`,
                        }}
                      />
                    </g>
                  )}

                  {/* Expand / collapse button
                      Large transparent rect = reliable hit area regardless
                      of whether the icon pixels are under the cursor.      */}
                  {!isRoot && node.hasChildren && (
                    <g
                      onClick={(e) => {
                        e.stopPropagation(); // don't open chat
                        toggleCollapse(node.id);
                      }}
                      style={{ cursor: "pointer" }}>
                      {/* Invisible hit area — full 28×28 zone */}
                      <rect
                        x={chevX}
                        y={chevY}
                        width={28}
                        height={28}
                        fill="transparent"
                        rx={6}
                      />
                      {/* Visible icon, centred inside hit area */}
                      <g
                        transform={`translate(${chevX + 6}, ${chevY + 6})`}
                        style={{ pointerEvents: "none" }}>
                        {node.isCollapsed ? (
                          <ChevronRight
                            width={16}
                            height={16}
                            style={{
                              color: isHovered ? "#fff" : pal.border,
                              transition: `color ${ICON_DUR} ${EASE}`,
                            }}
                          />
                        ) : (
                          <ChevronLeft
                            width={16}
                            height={16}
                            style={{
                              color: isHovered ? "#fff" : pal.border,
                              transition: `color ${ICON_DUR} ${EASE}`,
                            }}
                          />
                        )}
                      </g>
                    </g>
                  )}

                  {/* Label */}
                  <text
                    x={12}
                    y={NODE_H / 2}
                    dominantBaseline="middle"
                    fontSize={node.depth === 0 ? 12.5 : 11.5}
                    fontWeight={node.depth <= 1 ? "600" : "500"}
                    style={{
                      fill: isHovered ? "#ffffff" : nodeText,
                      pointerEvents: "none",
                      userSelect: "none",
                      transition: `fill ${ICON_DUR} ${EASE}`,
                    }}>
                    {labelText}
                  </text>
                  <title>{node.label} — click to explain in Study Chat</title>
                </g>
              );
            })}
          </g>

          {/* Keyframe for node/edge fade-in */}
          <style>{`
            @keyframes mmFadeIn {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
          `}</style>
        </svg>
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 select-none pointer-events-none">
          Scroll to zoom · Drag to pan
        </p>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function MindmapTab({
  spaceId,
  userId,
  spaceName,
  hasContent,
  onNavigateToChat,
}: MindmapTabProps) {
  const [mindmapData, setMindmapData] = useState<MindmapData | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [viewMode, setViewMode] = useState<"radial" | "tree">("tree");
  const [generating, setGenerating] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Pan / Zoom state
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 500, y: 310, scale: 1 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Centre the view on mount / resize
  useEffect(() => {
    const updateCenter = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setTransform((t) => ({ ...t, x: rect.width / 2, y: rect.height / 2 }));
      }
    };
    updateCenter();
    window.addEventListener("resize", updateCenter);
    return () => window.removeEventListener("resize", updateCenter);
  }, []);

  // Load persisted mindmap on mount
  useEffect(() => {
    const loadPersisted = async () => {
      try {
        const res = await fetch(`/api/spaces/${spaceId}/mindmap`);
        if (res.ok) {
          const json = await res.json();
          if (json.mindmap) {
            setMindmapData(json.mindmap);
            if (json.mindmap.generatedAt) {
              setLastGeneratedAt(new Date(json.mindmap.generatedAt));
            }
          }
        }
      } catch {
        // No persisted mindmap — not an error, just show the generate prompt
      } finally {
        setLoadingExisting(false);
      }
    };
    loadPersisted();
  }, [spaceId]);

  // Re-compute layout whenever mindmap data changes
  useEffect(() => {
    if (mindmapData) {
      setLayoutNodes(computeLayout(mindmapData.nodes, mindmapData.edges));
    }
  }, [mindmapData]);

  const generateMindmap = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/mindmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate mindmap");
      }
      const data: MindmapData = await res.json();
      setMindmapData(data);
      if (data.generatedAt) setLastGeneratedAt(new Date(data.generatedAt));
      toast.success("Mindmap generated!");
      // Reset view
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
      }
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      toast.error("Failed to generate mindmap");
    } finally {
      setGenerating(false);
    }
  }, [spaceId, userId]);

  // Zoom on scroll
  const handleWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => ({
      ...t,
      scale: Math.min(4, Math.max(0.25, t.scale * factor)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const stopDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  const resetView = useCallback(() => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
    }
  }, []);

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // ---- Empty / loading states ----

  if (!hasContent) {
    return (
      <Card className="p-10 text-center flex flex-col items-center gap-3 min-h-[300px] justify-center">
        <GitBranch className="w-12 h-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No content yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Upload study materials to this space first, then generate a mindmap to
          visualise your knowledge graph.
        </p>
      </Card>
    );
  }

  if (loadingExisting) {
    return (
      <Card className="p-10 text-center flex flex-col items-center gap-3 min-h-[300px] justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading saved mindmap…</p>
      </Card>
    );
  }

  if (!mindmapData && !generating && !error) {
    return (
      <Card className="p-10 text-center flex flex-col items-center gap-4 min-h-[300px] justify-center">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-primary/10 " />
          <GitBranch className="w-12 h-12 text-primary relative z-10" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">Generate a Mindmap</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            AI will analyse your study materials and build an interactive
            knowledge graph
          </p>
        </div>
        <Button onClick={generateMindmap} className="gap-2 mt-2">
          <GitBranch className="w-4 h-4" />
          Generate Mindmap
        </Button>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card className="p-10 text-center flex flex-col items-center gap-3 min-h-[300px] justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="font-medium">Generating your knowledge graph…</p>
        <p className="text-sm text-muted-foreground">
          AI is analysing your materials. This may take a moment.
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-10 text-center flex flex-col items-center gap-3 min-h-[300px] justify-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <h3 className="text-lg font-semibold">Generation failed</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          onClick={generateMindmap}
          variant="outline"
          className="gap-2 mt-1">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      </Card>
    );
  }

  // ---- Mindmap SVG ----
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/40">
          <Button
            variant={viewMode === "tree" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 h-8 px-3"
            onClick={() => setViewMode("tree")}>
            <ListTree className="w-3.5 h-3.5" />
            Tree
          </Button>
          <Button
            variant={viewMode === "radial" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 h-8 px-3"
            onClick={() => setViewMode("radial")}>
            <Network className="w-3.5 h-3.5" />
            Radial
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === "radial" && (
            <>
              {(
                [
                  ["root", "Root"],
                  ["topic", "Topic"],
                  ["concept", "Concept"],
                  ["detail", "Detail"],
                ] as const
              ).map(([type, label]) => (
                <span
                  key={type}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: NODE_FILL[type] }}
                  />
                  {label}
                </span>
              ))}
              <Button
                variant="outline"
                size="icon"
                title="Zoom in"
                onClick={() =>
                  setTransform((t) => ({
                    ...t,
                    scale: Math.min(4, t.scale * 1.25),
                  }))
                }>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Zoom out"
                onClick={() =>
                  setTransform((t) => ({
                    ...t,
                    scale: Math.max(0.25, t.scale / 1.25),
                  }))
                }>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Reset view"
                onClick={resetView}>
                <Maximize2 className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={generateMindmap}
            disabled={generating}>
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </Button>
          {lastGeneratedAt && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Saved{" "}
              {lastGeneratedAt.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              {lastGeneratedAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* ---- TREE VIEW ---- */}
      {viewMode === "tree" && mindmapData && (
        <TreeView data={mindmapData} onNavigateToChat={onNavigateToChat} />
      )}

      {/* ---- RADIAL VIEW ---- */}
      {viewMode === "radial" && mindmapData && (
        <Card className="relative overflow-hidden border-border/60 bg-white dark:bg-[#0d0d14]">
          <svg
            ref={svgRef}
            className="w-full select-none"
            style={{
              height: 620,
              cursor: dragging.current ? "grabbing" : "grab",
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}>
            <defs>
              <pattern
                id="mindmap-grid"
                x="0"
                y="0"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse">
                <circle
                  cx="1"
                  cy="1"
                  r="1"
                  fill="currentColor"
                  opacity="0.08"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mindmap-grid)" />

            <g
              transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
              {mindmapData.edges.map((edge, i) => {
                const s = nodeMap.get(edge.source);
                const t = nodeMap.get(edge.target);
                if (!s || !t) return null;
                const sR = NODE_RADIUS[s.type];
                const tR = NODE_RADIUS[t.type];
                const color = NODE_FILL[s.type];
                return (
                  <path
                    key={`edge-${i}`}
                    d={edgePath(s, t, sR, tR)}
                    stroke={color}
                    strokeWidth={
                      s.type === "root" ? 2.5 : s.type === "topic" ? 2 : 1.5
                    }
                    strokeOpacity={0.45}
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}

              {layoutNodes.map((node) => {
                const r = NODE_RADIUS[node.type];
                const fill = NODE_FILL[node.type];
                const fs = FONT_SIZE[node.type];
                const lines = truncateLabel(node.label, node.type);
                const isHovered = hoveredNode?.id === node.id;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      setHoveredNode(node);
                      const rect = svgRef.current?.getBoundingClientRect();
                      if (rect)
                        setTooltipPos({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                    }}
                    onMouseLeave={() => setHoveredNode(null)}>
                    {isHovered && (
                      <circle r={r + 7} fill={fill} opacity={0.2} />
                    )}
                    <circle r={r + 1} fill="#000" opacity={0.12} cy={2} />
                    <circle
                      r={r}
                      fill={fill}
                      stroke={isHovered ? "#fff" : fill}
                      strokeWidth={isHovered ? 2.5 : 0}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={fs}
                      fontWeight={
                        node.type === "root" || node.type === "topic"
                          ? "600"
                          : "500"
                      }
                      style={{ pointerEvents: "none", userSelect: "none" }}>
                      {lines.length === 1 ? (
                        <tspan x="0" dy="0">
                          {lines[0]}
                        </tspan>
                      ) : (
                        <>
                          <tspan x="0" dy={`-${fs * 0.6}px`}>
                            {lines[0]}
                          </tspan>
                          <tspan x="0" dy={`${fs * 1.3}px`}>
                            {lines[1]}
                          </tspan>
                        </>
                      )}
                    </text>
                    <title>{node.label}</title>
                  </g>
                );
              })}
            </g>
          </svg>

          {hoveredNode && (
            <div
              className="absolute z-20 px-3 py-2 rounded-lg shadow-xl text-xs font-medium pointer-events-none bg-popover text-popover-foreground border border-border max-w-[200px]"
              style={{
                left: tooltipPos.x + 14,
                top: tooltipPos.y - 14,
                transform: "translateY(-100%)",
              }}>
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ background: NODE_FILL[hoveredNode.type] }}
              />
              <span className="capitalize text-muted-foreground mr-1">
                {hoveredNode.type}:
              </span>
              {hoveredNode.label}
            </div>
          )}
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 select-none pointer-events-none">
            Scroll to zoom · Drag to pan
          </p>
        </Card>
      )}
    </div>
  );
}
