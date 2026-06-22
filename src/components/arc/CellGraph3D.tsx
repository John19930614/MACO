"use client";

import { useEffect, useRef, useState } from "react";
import type { SafetyCell, CausalEdge, BehaviorCell, EventCell, ControlProof, CellType } from "@/lib/types";

// ── Colour maps ───────────────────────────────────────────────────────────────

const TENANT_COLOR: Record<string, string> = {
  tenant_pacific: "#3b82f6",
  tenant_summit:  "#f97316",
  tenant_apex:    "#22c55e",
  tenant_norgas:  "#ef4444",
};
const TENANT_FALLBACK = "#8b5cf6";

/** Six-object Reliance Risk Intelligence Framework colours */
const CELL_TYPE_COLOR: Record<CellType, string> = {
  precursor: "#eab308",
  control:   "#22c55e",
  failure:   "#ef4444",
  behavior:  "#a855f7",
  event:     "#3b82f6",
  learning:  "#14b8a6",
};

const CELL_TYPE_LABEL: Record<CellType, string> = {
  precursor: "Precursor Cell",
  control:   "Control Cell",
  failure:   "Failure Cell",
  behavior:  "Behavior Cell",
  event:     "Event Cell",
  learning:  "Learning Cell",
};

const EDGE_COLOR: Record<string, string> = {
  contributes_to:  "#a78bfa",
  contributed_to:  "#7c3aed",
  triggers:        "#f87171",
  amplifies:       "#fb923c",
  inhibits:        "#34d399",
  precedes:        "#60a5fa",
  same_location:   "#94a3b8",
};

const PROOF_COLOR: Record<string, string> = {
  proven:          "#22c55e",
  weak_proof:      "#84cc16",
  not_applicable:  "#64748b",
  missing:         "#ef4444",
  expired:         "#f97316",
  conflicting:     "#dc2626",
  not_checked:     "#94a3b8",
};

// Worst proof status wins (lowest index = worst)
const PROOF_RANK: Record<string, number> = {
  missing: 0, expired: 1, conflicting: 2, not_checked: 3,
  weak_proof: 4, not_applicable: 5, proven: 6,
};

function nodeRadius(riskScore: number): number {
  return Math.max(10, Math.min(26, riskScore / 3.6));
}

// ── Types local to this module ────────────────────────────────────────────────

interface SimNode extends SafetyCell {
  // physics
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  fx: number; fy: number; fz: number;
  // projected (updated each frame)
  _sx: number; _sy: number; _sz: number; _sr: number; _scale: number;
  // derived
  proofStatus: string | null;
  hasEvent: boolean;
  derivedType: CellType;
}

interface PhysLink {
  a: SimNode; b: SimNode; restLen: number;
}

interface VisEdge {
  a: SimNode; b: SimNode;
  kind: "causal" | "behavior";
  color: string;
  label: string;
  dashed: boolean;
}

// ── Component props ───────────────────────────────────────────────────────────

export interface CellGraph3DProps {
  cells:     SafetyCell[];
  edges:     CausalEdge[];
  behaviors: BehaviorCell[];
  events:    EventCell[];
  proofs:    ControlProof[];
}

export function CellGraph3D({ cells, edges, behaviors, events, proofs }: CellGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);

  // "cell_web" colours by tenant; "risk_objects" colours by ARC cell type
  const [viewMode, setViewMode] = useState<"cell_web" | "risk_objects">("cell_web");
  // Ref so the canvas loop can read the current value without re-mounting
  const viewModeRef = useRef<"cell_web" | "risk_objects">("cell_web");

  function toggleView() {
    const next = viewModeRef.current === "cell_web" ? "risk_objects" : "cell_web";
    viewModeRef.current = next;
    setViewMode(next);
  }

  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    const tooltip   = tooltipRef.current;
    if (!canvas || !container || !tooltip) return;

    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;

    // ── Resize handler ──────────────────────────────────────────────────────
    function resize() {
      const dpr  = window.devicePixelRatio || 1;
      const rect = container!.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas!.width  = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width  = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // ── Derive worst proof status per cell ──────────────────────────────────
    const proofByCell = new Map<string, string>();
    for (const p of proofs) {
      const existing = proofByCell.get(p.cell_id);
      const pRank    = PROOF_RANK[p.status] ?? 99;
      const exRank   = existing ? (PROOF_RANK[existing] ?? 99) : 99;
      if (pRank < exRank) proofByCell.set(p.cell_id, p.status);
    }
    const eventCellIds = new Set(events.map((e) => e.cell_id).filter(Boolean) as string[]);

    // ── Build simulation nodes ──────────────────────────────────────────────
    const INITIAL_POS: Record<string, [number, number, number]> = {
      tenant_pacific: [-180,  -70,   80],
      tenant_summit:  [  50,   30,  -60],
      tenant_apex:    [ 160, -110,   60],
      tenant_norgas:  [ 120,  100, -120],
    };
    const rnd = (r: number) => (Math.random() - 0.5) * r;

    const nodes: SimNode[] = cells.map((c) => {
      const [ox, oy, oz] = INITIAL_POS[c.tenant_id] ?? [0, 0, 0];
      const hasEvent = eventCellIds.has(c.id);
      const proofStatus = proofByCell.get(c.id) ?? null;
      // Derive ARC type: prefer explicit field, then infer from state
      let derivedType: CellType = c.cell_type ?? "precursor";
      if (!c.cell_type) {
        if (c.status === "closed") derivedType = "learning";
        else if (hasEvent) derivedType = "event";
        else if (proofStatus === "missing") derivedType = "failure";
      }
      return {
        ...c,
        x: ox + rnd(70), y: oy + rnd(70), z: oz + rnd(70),
        vx: 0, vy: 0, vz: 0,
        fx: 0, fy: 0, fz: 0,
        _sx: 0, _sy: 0, _sz: 0, _sr: 0, _scale: 1,
        proofStatus,
        hasEvent,
        derivedType,
      };
    });
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // ── Build physics links ─────────────────────────────────────────────────
    const physLinks: PhysLink[] = [];

    for (const e of edges) {
      const a = nodeById.get(e.source_cell_id), b = nodeById.get(e.target_cell_id);
      if (a && b) physLinks.push({ a, b, restLen: 130 });
    }

    for (const beh of behaviors) {
      const bn = beh.cell_ids.map((id) => nodeById.get(id)).filter(Boolean) as SimNode[];
      for (let i = 0; i < bn.length; i++)
        for (let j = i + 1; j < bn.length; j++)
          physLinks.push({ a: bn[i], b: bn[j], restLen: 100 });
    }

    // Same-location implicit spring (not drawn, just physics)
    const byLoc = new Map<string, SimNode[]>();
    for (const n of nodes) {
      if (!byLoc.has(n.location_id)) byLoc.set(n.location_id, []);
      byLoc.get(n.location_id)!.push(n);
    }
    for (const grp of byLoc.values()) {
      if (grp.length < 2) continue;
      for (let i = 0; i < grp.length; i++)
        for (let j = i + 1; j < grp.length; j++)
          physLinks.push({ a: grp[i], b: grp[j], restLen: 85 });
    }

    // ── Physics step ────────────────────────────────────────────────────────
    function simStep() {
      for (const n of nodes) { n.fx = 0; n.fy = 0; n.fz = 0; }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d  = Math.sqrt(dx * dx + dy * dy + dz * dz + 1);
          const f  = 3200 / (d * d * d);
          a.fx -= f * dx; a.fy -= f * dy; a.fz -= f * dz;
          b.fx += f * dx; b.fy += f * dy; b.fz += f * dz;
        }
      }

      for (const lk of physLinks) {
        const { a, b, restLen } = lk;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d  = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        const f  = (d - restLen) * 0.045;
        a.fx += f * dx / d; a.fy += f * dy / d; a.fz += f * dz / d;
        b.fx -= f * dx / d; b.fy -= f * dy / d; b.fz -= f * dz / d;
      }

      for (const n of nodes) {
        n.fx -= n.x * 0.007;
        n.fy -= n.y * 0.007;
        n.fz -= n.z * 0.007;
        n.vx = (n.vx + n.fx) * 0.82;
        n.vy = (n.vy + n.fy) * 0.82;
        n.vz = (n.vz + n.fz) * 0.82;
        n.x += n.vx; n.y += n.vy; n.z += n.vz;
      }
    }

    // Pre-warm
    for (let i = 0; i < 250; i++) simStep();

    // ── 3D projection ────────────────────────────────────────────────────────
    let rotX = -0.25, rotY = 0.4;
    let zoom = 1;

    function project(x: number, y: number, z: number) {
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const rx = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const ry = y * cosX - z1 * sinX;
      const rz = y * sinX + z1 * cosX;
      const sc = (600 / (600 + rz + 300)) * zoom;
      return { sx: rx * sc + W / 2, sy: ry * sc + H / 2, sz: rz, scale: sc };
    }

    function projectAll() {
      for (const n of nodes) {
        const p = project(n.x, n.y, n.z);
        n._sx = p.sx; n._sy = p.sy; n._sz = p.sz;
        n._sr    = nodeRadius(n.risk_score) * p.scale;
        n._scale = p.scale;
      }
    }

    // ── Interaction ──────────────────────────────────────────────────────────
    let dragging = false, lastMX = 0, lastMY = 0;
    let idleFrames = 0;
    let hoveredNode: SimNode | null = null;

    function hitTest(mx: number, my: number): SimNode | null {
      let hit: SimNode | null = null, best = Infinity;
      for (const n of nodes) {
        const d = Math.sqrt((mx - n._sx) ** 2 + (my - n._sy) ** 2);
        if (d < n._sr + 6 && d < best) { hit = n; best = d; }
      }
      return hit;
    }

    const onMouseDown = (e: MouseEvent) => {
      dragging = true; lastMX = e.clientX; lastMY = e.clientY;
      canvas.style.cursor = "grabbing"; idleFrames = 0;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (dragging) {
        rotY += (e.clientX - lastMX) * 0.008;
        rotX += (e.clientY - lastMY) * 0.008;
        rotX   = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
        lastMX = e.clientX; lastMY = e.clientY;
        idleFrames = 0; hoveredNode = null;
        tooltip.style.display = "none";
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      hoveredNode = hitTest(mx, my);
      if (hoveredNode) {
        const n   = hoveredNode;
        const mode = viewModeRef.current;
        const tc  = mode === "risk_objects"
          ? CELL_TYPE_COLOR[n.derivedType]
          : (TENANT_COLOR[n.tenant_id] ?? TENANT_FALLBACK);
        const sc  = n.severity === "critical" ? "#ef4444"
                  : n.severity === "high"     ? "#f97316"
                  : n.severity === "medium"   ? "#eab308" : "#94a3b8";
        const pc  = n.proofStatus ? PROOF_COLOR[n.proofStatus] ?? "#94a3b8" : null;
        const typeLabel = CELL_TYPE_LABEL[n.derivedType];
        tooltip.innerHTML = `
          <div style="font-weight:600;color:${tc};margin-bottom:5px">${n.title}</div>
          <div style="color:#64748b;font-size:10px;margin-bottom:5px">${n.id}</div>
          <div style="color:${CELL_TYPE_COLOR[n.derivedType]};font-size:10px;margin-bottom:4px">◆ ${typeLabel}</div>
          <div>Severity: <span style="color:${sc};font-weight:600">${n.severity.toUpperCase()}</span></div>
          <div>Risk score: <strong>${n.risk_score}</strong>/100</div>
          <div>Energy: ${n.hazard_genome.energySource}</div>
          <div>Trigger: ${n.hazard_genome.trigger}</div>
          <div>Status: ${n.status}</div>
          ${pc ? `<div style="margin-top:4px">Control: <span style="color:${pc};font-weight:500">${n.proofStatus!.replace(/_/g, " ")}</span></div>` : ""}
          ${n.hasEvent ? `<div style="color:#fbbf24;margin-top:4px">⚠ Event logged</div>` : ""}
        `;
        tooltip.style.display = "block";
        tooltip.style.left = `${Math.min(mx + 14, W - 240)}px`;
        tooltip.style.top  = `${Math.max(4, Math.min(my - 10, H - 200))}px`;
      } else {
        tooltip.style.display = "none";
      }
    };

    const onMouseUp   = () => { dragging = false; canvas.style.cursor = "grab"; };
    const onMouseLeave = () => { hoveredNode = null; tooltip.style.display = "none"; };
    const onWheel     = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(0.3, Math.min(4, zoom * (e.deltaY > 0 ? 0.93 : 1 / 0.93)));
      idleFrames = 0;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel",     onWheel, { passive: false });

    // ── Visual edges (drawn) ─────────────────────────────────────────────────
    const visEdges: VisEdge[] = [];

    for (const e of edges) {
      const a = nodeById.get(e.source_cell_id), b = nodeById.get(e.target_cell_id);
      if (a && b) visEdges.push({
        a, b, kind: "causal",
        color: EDGE_COLOR[e.type] ?? "#94a3b8",
        label: e.type.replace(/_/g, " "),
        dashed: false,
      });
    }

    for (const beh of behaviors) {
      const bn = beh.cell_ids.map((id) => nodeById.get(id)).filter(Boolean) as SimNode[];
      for (let i = 0; i < bn.length; i++) {
        for (let j = i + 1; j < bn.length; j++) {
          visEdges.push({ a: bn[i], b: bn[j], kind: "behavior", color: "#34d399", label: beh.title, dashed: true });
        }
      }
    }

    // ── Arrow helper ─────────────────────────────────────────────────────────
    function drawArrow(x1: number, y1: number, x2: number, y2: number, rTarget: number) {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const ux = dx / len, uy = dy / len;
      const aLen = 9;
      const ex = x2 - ux * (rTarget + aLen + 2);
      const ey = y2 - uy * (rTarget + aLen + 2);
      const ang = Math.atan2(uy, ux);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex + ux * aLen, ey + uy * aLen);
      ctx.lineTo(ex - Math.cos(ang - 0.5) * aLen, ey - Math.sin(ang - 0.5) * aLen);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * aLen, ey - Math.sin(ang + 0.5) * aLen);
      ctx.closePath(); ctx.fill();
    }

    // ── Draw frame ───────────────────────────────────────────────────────────
    function draw(t: number) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#080c14";
      ctx.fillRect(0, 0, W, H);

      projectAll();

      const mode = viewModeRef.current;

      // Edges sorted back-to-front by average z
      const sortedE = [...visEdges].sort(
        (a, b) => (a.a._sz + a.b._sz) / 2 - (b.a._sz + b.b._sz) / 2,
      );

      for (const e of sortedE) {
        const { a, b } = e;
        const hi = hoveredNode && (hoveredNode.id === a.id || hoveredNode.id === b.id);
        ctx.save();
        ctx.globalAlpha = hi ? 1 : 0.6;
        ctx.strokeStyle = e.color;
        ctx.fillStyle   = e.color;
        ctx.lineWidth   = hi ? 2 : 1.5;
        if (e.dashed) ctx.setLineDash([5, 4]);
        if (e.kind === "causal") drawArrow(a._sx, a._sy, b._sx, b._sy, b._sr);
        else { ctx.beginPath(); ctx.moveTo(a._sx, a._sy); ctx.lineTo(b._sx, b._sy); ctx.stroke(); }
        ctx.setLineDash([]);

        if (hi) {
          const mx = (a._sx + b._sx) / 2, my = (a._sy + b._sy) / 2;
          ctx.font = "bold 10px system-ui";
          const lw = ctx.measureText(e.label).width;
          ctx.globalAlpha = 0.88;
          ctx.fillStyle   = "rgba(8,12,20,0.78)";
          ctx.fillRect(mx - lw / 2 - 4, my - 11, lw + 8, 14);
          ctx.fillStyle = e.color;
          ctx.textAlign = "left";
          ctx.fillText(e.label, mx - lw / 2, my);
        }
        ctx.restore();
      }

      // Nodes sorted back-to-front
      const sortedN = [...nodes].sort((a, b) => a._sz - b._sz);

      for (const n of sortedN) {
        const { _sx: sx, _sy: sy, _scale: sc, _sr: r } = n;
        const tc  = mode === "risk_objects"
          ? CELL_TYPE_COLOR[n.derivedType]
          : (TENANT_COLOR[n.tenant_id] ?? TENANT_FALLBACK);
        const hi  = hoveredNode?.id === n.id;
        const crit = n.severity === "critical";

        ctx.save();

        // Glow ring for critical / hovered
        if (crit || hi) {
          const pulse = crit ? 0.3 + 0.2 * Math.sin(t * 0.003) : 0.45;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
          ctx.fillStyle   = tc + "28";
          ctx.globalAlpha = pulse;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Proof status ring
        if (n.proofStatus) {
          ctx.beginPath();
          ctx.arc(sx, sy, r + 4.5 * sc, 0, Math.PI * 2);
          ctx.strokeStyle = PROOF_COLOR[n.proofStatus] ?? "#94a3b8";
          ctx.lineWidth   = 2.5 * sc;
          ctx.globalAlpha = 0.85;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = tc;
        ctx.fill();
        ctx.strokeStyle = hi ? "#ffffff" : "rgba(255,255,255,0.22)";
        ctx.lineWidth   = hi ? 2.5 * sc : 1.2 * sc;
        ctx.stroke();

        // Event dot (yellow, top-right)
        if (n.hasEvent) {
          ctx.beginPath();
          ctx.arc(sx + r * 0.65, sy - r * 0.65, 4.5 * sc, 0, Math.PI * 2);
          ctx.fillStyle   = "#fbbf24";
          ctx.fill();
          ctx.strokeStyle = "#080c14";
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        // Label
        if (sc > 0.5) {
          const fs    = Math.max(9, Math.min(12, 10.5 * sc));
          ctx.font    = `${hi ? "bold " : ""}${fs}px system-ui`;
          ctx.textAlign   = "center";
          ctx.fillStyle   = "rgba(226,232,240,0.88)";
          ctx.globalAlpha = sc > 0.7 ? 1 : 0.55;
          const lbl = n.title.length > 24 ? n.title.slice(0, 23) + "…" : n.title;
          ctx.fillText(lbl, sx, sy + r + 13 * sc);
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    let simLeft = 150, rafId = 0;

    function frame(t: number) {
      idleFrames++;
      if (!dragging && idleFrames > 90) rotY += 0.003;
      if (simLeft > 0) { simStep(); simLeft--; }
      draw(t);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("mousedown",  onMouseDown);
      window.removeEventListener("mousemove",  onMouseMove);
      window.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("wheel",      onWheel);
    };
  }, [cells, edges, behaviors, events, proofs]);

  const tenantCount  = new Set(cells.map((c) => c.tenant_id)).size;
  const critCount    = cells.filter((c) => c.severity === "critical").length;
  const highCount    = cells.filter((c) => c.severity === "high").length;
  const openCount    = cells.filter((c) => c.status === "open").length;

  // Counts per ARC type (using cell_type field or fallback)
  const typeCounts = (Object.keys(CELL_TYPE_LABEL) as CellType[]).map((t) => ({
    type: t,
    count: cells.filter((c) => {
      if (c.cell_type) return c.cell_type === t;
      if (t === "learning") return c.status === "closed";
      return false;
    }).length,
  })).filter((x) => x.count > 0);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden rounded-xl"
      style={{ background: "#080c14", minHeight: 480 }}
    >
      <h2 className="sr-only">
        Safety Cell 3D Relationship Graph — {cells.length} cells across {tenantCount} tenant
        {tenantCount !== 1 ? "s" : ""} connected by causal edges and behavior clusters
      </h2>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 block"
        style={{ cursor: "grab" }}
      />

      {/* ── View toggle (top-center) ──────────────────────────────────────── */}
      <div className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 flex rounded-lg border border-white/10 bg-slate-950/85 p-0.5 backdrop-blur-sm">
        <button
          onClick={toggleView}
          className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            viewMode === "cell_web"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Cell web
        </button>
        <button
          onClick={toggleView}
          className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            viewMode === "risk_objects"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Risk objects
        </button>
      </div>

      {/* ── Legend (top-left) — switches by mode ─────────────────────────── */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-slate-950/85 p-3 text-xs text-slate-300 backdrop-blur-sm">
        {viewMode === "cell_web" ? (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tenants</p>
            <ul className="space-y-1.5">
              {[
                { color: "#3b82f6", label: "Pacific Harbor" },
                { color: "#f97316", label: "Summit Ridge" },
                { color: "#22c55e", label: "Apex Industries" },
                { color: "#ef4444", label: "NorGas Energy" },
              ].map(({ color, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  {label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Risk Intelligence Framework
            </p>
            <ul className="space-y-1.5">
              {(Object.entries(CELL_TYPE_LABEL) as [CellType, string][]).map(([type, label]) => (
                <li key={type} className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CELL_TYPE_COLOR[type] }} />
                  {label}
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Connections</p>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="2" y1="3" x2="14" y2="3" stroke="#a78bfa" strokeWidth="1.5" />
              <polygon points="14,3 10,1 10,5" fill="#a78bfa" />
            </svg>
            Causal edge
          </li>
          <li className="flex items-center gap-2">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="2" y1="3" x2="18" y2="3" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4,3" />
            </svg>
            Behavior link
          </li>
        </ul>

        <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Control ring</p>
        <ul className="space-y-1">
          {[
            { color: "#22c55e", label: "Proven" },
            { color: "#f97316", label: "Expired" },
            { color: "#ef4444", label: "Missing" },
            { color: "#94a3b8", label: "Not checked" },
          ].map(({ color, label }) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2"
                style={{ borderColor: color, background: "transparent" }}
              />
              {label}
            </li>
          ))}
        </ul>

        <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Size = risk score</p>
        <p className="text-[10px] text-slate-500">Yellow dot = event logged</p>
      </div>

      {/* ── Stats (top-right) ──────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/10 bg-slate-950/85 p-3 text-right text-xs text-slate-300 backdrop-blur-sm">
        <p className="text-sm font-bold text-white">{cells.length} Risk Objects</p>
        <p className="mt-1 text-slate-400">{edges.length} link{edges.length !== 1 ? "s" : ""}</p>
        <p className="text-slate-400">{behaviors.length} behavior cluster{behaviors.length !== 1 ? "s" : ""}</p>
        {viewMode === "risk_objects" ? (
          <ul className="mt-2 space-y-0.5 text-right">
            {typeCounts.map(({ type, count }) => (
              <li key={type} className="flex items-center justify-end gap-1.5">
                <span className="text-slate-400">{count}</span>
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: CELL_TYPE_COLOR[type] }} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-2 text-slate-400">{tenantCount} tenant{tenantCount !== 1 ? "s" : ""}</p>
            {critCount > 0 && <p className="mt-1 font-medium text-red-400">{critCount} critical</p>}
            {highCount > 0 && <p className="text-orange-400">{highCount} high</p>}
            <p className="mt-1 text-slate-500">{openCount} open</p>
          </>
        )}
      </div>

      {/* ── Tooltip ────────────────────────────────────────────────────────── */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 hidden rounded-lg border border-white/10 bg-slate-950/95 p-3 text-xs text-slate-200 backdrop-blur-sm"
        style={{ maxWidth: 240 }}
      />

      {/* ── Hint ───────────────────────────────────────────────────────────── */}
      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-700 select-none">
        Drag to rotate · Scroll to zoom · Hover to inspect
      </p>
    </div>
  );
}
