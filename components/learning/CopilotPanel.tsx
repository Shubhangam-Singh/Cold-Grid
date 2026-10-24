"use client";

/**
 * FROST panel. Shelf life, prices, and the suggested move come from the
 * rules engine on the probe temperature. A model is optional and local.
 * The Claude button stays behind NEXT_PUBLIC_ENABLE_COPILOT.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useColdgridStore } from "@/store/coldgridStore";
import { useLiveHardwareStore } from "@/store/liveHardwareStore";
import { proposeActions, type ActionCard } from "@/lib/copilot/actions";
import { answerQuestion } from "@/lib/copilot/answer";
import { buildSessionWorld } from "@/lib/copilot/sessionWorld";
import { analyzeFleet, buildCopilotContext, type Advice, type Severity } from "@/lib/copilot/heuristics";
import { computeInsights, type Insight } from "@/lib/copilot/insights";
import { withMeasuredCargo } from "@/lib/copilot/world";
import { getProduce } from "@/lib/engine/produce";
import { KELVIN } from "@/lib/engine/spoilage";

const COPILOT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COPILOT === "true";

const SEV_STYLE: Record<Severity, { dot: string; text: string }> = {
  critical: { dot: "bg-red-500", text: "text-red-300" },
  warn: { dot: "bg-amber-400", text: "text-amber-300" },
  info: { dot: "bg-sky-400", text: "text-sky-300" },
};

type Tab = "advice" | "insights" | "chat" | "log" | "memory";

interface Health {
  name?: string;
  engine?: string;
  sidecar?: boolean;
  model?: string | null;
  ollama?: boolean;
  degraded?: boolean;
}

interface ChatLine {
  role: "you" | "frost";
  text: string;
  mode?: string;
}

function quietNow(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 22 || hour < 7;
}

function recommend(cards: ActionCard[], severity: string | undefined): ActionCard | null {
  const kitchen = cards.find((card) => card.kind === "divert-kitchen");
  const sell = cards.find((card) => card.kind === "sell-now");
  const hold = cards.find((card) => card.kind === "hold-hub");
  const keep = cards.find((card) => card.id.endsWith("-keep"));
  if (severity === "critical" && kitchen) return kitchen;
  if (severity === "critical" && sell) return sell;
  if (severity === "warn" && hold) return hold;
  if (severity === "warn" && sell) return sell;
  return keep ?? sell ?? null;
}

export default function CopilotPanel() {
  const sim = useColdgridStore((s) => s.sim);
  const selectedShipmentId = useColdgridStore((s) => s.selectedShipmentId);
  const applyHubHold = useColdgridStore((s) => s.applyHubHold);
  const applyKitchenDivert = useColdgridStore((s) => s.applyKitchenDivert);
  const markSellNow = useColdgridStore((s) => s.markSellNow);
  const listen = useLiveHardwareStore((s) => s.listen);
  const connected = useLiveHardwareStore((s) => s.connected);
  const attachToFleet = useLiveHardwareStore((s) => s.attachToFleet);
  const session = useLiveHardwareStore((s) => s.session);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("advice");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [health, setHealth] = useState<Health | null>(null);
  const [lastMode, setLastMode] = useState<string>("rules");
  const [auditNote, setAuditNote] = useState<string | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<{ at: string; action: string; shipmentId: string; detail: string }[]>([]);
  const [memory, setMemory] = useState<{ id: string; kind: string; content: string }[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [aiText, setAiText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chainReachable, setChainReachable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      setOpen(true);
      setTab("chat");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/copilot/v2/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setHealth(body as Health);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    fetch("/api/chain/live")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { reachable?: boolean } | null) => {
        if (!cancelled) setChainReachable(body?.reachable === true);
      })
      .catch(() => {
        if (!cancelled) setChainReachable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  const world = useMemo(
    () =>
      buildSessionWorld({
        sim,
        listen,
        connected,
        attachFish: attachToFleet,
        reading: session.reading,
        history: session.history,
        chain: session.chain,
        nowMs,
        anchored: chainReachable,
      }),
    [sim, listen, connected, attachToFleet, session, nowMs, chainReachable]
  );

  const measured = useMemo(() => withMeasuredCargo(world), [world]);
  const report = useMemo(
    () => analyzeFleet({ ...sim, shipments: measured.shipments }),
    [sim, measured]
  );
  const insights = useMemo(() => computeInsights(world), [world]);
  const moving = world.shipments.filter((s) => s.status === "in-transit");
  const target =
    moving.find((s) => s.id === selectedShipmentId) ??
    moving.find((s) => s.id === world.probe?.shipmentId) ??
    moving[moving.length - 1] ??
    null;
  const cards = target ? proposeActions(world, target.id) : [];
  const freshness = target ? insights.find((row) => row.entityId === target.id && row.type === "freshness") : undefined;
  const suggested = recommend(cards, freshness?.severity);
  const showBanner = !!suggested && (!quietNow(new Date(nowMs)) || freshness?.severity === "critical");
  const trace = target ? world.recentTemps[target.id] ?? [] : [];
  const threshold = target ? getProduce(target.produce).thermalStressK - KELVIN : null;

  async function writeAudit(body: Record<string, unknown>, preserveNote = false) {
    try {
      const res = await fetch("/api/copilot/v2/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (!preserveNote) setAuditNote("Audit unavailable. A map move still applies on this page.");
      } else {
        if (!preserveNote) setAuditNote(null);
        const data = (await res.json()) as { entries?: { at: string; action: string; shipmentId: string; detail: string }[] };
        if (data.entries) setLog(data.entries);
        else {
          const listed = await fetch("/api/copilot/v2/audit");
          if (listed.ok) {
            const body = (await listed.json()) as { entries?: { at: string; action: string; shipmentId: string; detail: string }[] };
            setLog(body.entries ?? []);
          }
        }
      }
    } catch {
      if (!preserveNote) setAuditNote("Audit unavailable. A map move still applies on this page.");
    }
  }

  function confirm(card: ActionCard) {
    if (!card.requiresConfirm) return;
    let detail = card.title;
    let failed: string | null = null;
    if (card.kind === "hold-hub" && card.hubId) {
      const result = applyHubHold(card.shipmentId, card.hubId);
      failed = result.ok ? null : result.reason ?? "Hold was not applied.";
      detail = failed ?? card.title;
    } else if (card.kind === "divert-kitchen" && card.kitchenId) {
      const result = applyKitchenDivert(card.shipmentId, card.kitchenId);
      failed = result.ok ? null : result.reason ?? "Divert was not applied.";
      detail = failed ?? card.title;
    } else if (card.kind === "sell-now") {
      markSellNow(card.shipmentId, card.rupees, card.grade ?? "A");
    }
    if (failed) setAuditNote(failed);
    void writeAudit({ action: card.kind, shipmentId: card.shipmentId, detail }, failed != null);
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft("");
    setTab("chat");
    const routed =
      trimmed === "/risk"
        ? `sell or hold ${target?.id ?? ""}`
        : trimmed === "/verify" || trimmed.startsWith("/verify ")
          ? "Is the ledger anchored?"
          : trimmed.startsWith("/forecast")
            ? `forecast ${trimmed.slice("/forecast".length).trim() || target?.id || ""}`
            : trimmed.startsWith("/whatif")
              ? `what if ${trimmed.slice("/whatif".length).trim()}`
              : trimmed;
    const local = answerQuestion(world, routed);
    setLastMode(local.mode);
    setLines((rows) => [...rows, { role: "you", text: trimmed }, { role: "frost", text: local.text, mode: local.mode }]);
    try {
      const res = await fetch("/api/copilot/v2/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: routed, world }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { text?: string; mode?: string; verified?: boolean };
      if (data.mode === "model" && data.verified && data.text) {
        setLastMode("model");
        setLines((rows) => {
          const next = rows.slice();
          const last = next[next.length - 1];
          if (last?.role === "frost") next[next.length - 1] = { role: "frost", text: data.text as string, mode: "model" };
          return next;
        });
      } else if (data.mode === "degraded") {
        setLastMode("degraded");
      }
    } catch {
      /* the rules answer already on screen is the fallback */
    }
  }

  async function loadLog() {
    try {
      const res = await fetch("/api/copilot/v2/audit");
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: { at: string; action: string; shipmentId: string; detail: string }[] };
      setLog(data.entries ?? []);
    } catch {
      setAuditNote("Audit unavailable. A map move still applies on this page.");
    }
  }

  async function loadMemory() {
    try {
      const res = await fetch("/api/copilot/v2/memory");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: { id: string; kind: string; content: string }[] };
      setMemory(data.items ?? []);
    } catch {
      setAuditNote("Memory is unavailable until the page server answers.");
    }
  }

  useEffect(() => {
    if (!open) return;
    if (tab === "log") void loadLog();
    if (tab === "memory") void loadMemory();
  }, [open, tab]);

  async function askAI() {
    setLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: buildCopilotContext({ ...sim, shipments: measured.shipments }) }),
      });
      const data = (await res.json()) as { enabled: boolean; text?: string };
      if (data.enabled && data.text) setAiText(data.text);
      else setAiError("Claude copilot unavailable. FROST rules stay on screen.");
    } catch {
      setAiError("Claude copilot unreachable. FROST rules stay on screen.");
    } finally {
      setLoading(false);
    }
  }

  const pill =
    lastMode === "degraded"
      ? { label: "FROST · degraded", className: "bg-amber-500/20 text-amber-300" }
      : health?.ollama && health.model
        ? { label: `FROST · local ✓ ${health.model}`, className: "bg-emerald-500/20 text-emerald-300" }
        : { label: "FROST · rules", className: "bg-slate-700/60 text-slate-300" };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 lg:bottom-4 lg:right-4 lg:top-auto"
        aria-expanded={false}
      >
        <span className="text-base" aria-hidden>🧊</span> Copilot
        {report.atRisk > 0 && (
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
            {report.atRisk} at risk
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="absolute right-3 top-3 z-30 flex max-h-[70vh] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950/90 backdrop-blur lg:bottom-4 lg:right-4 lg:top-auto lg:max-h-[64vh]">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Copilot</span>
          <span className={`truncate rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${pill.className}`}>
            {pill.label}
          </span>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200" aria-label="Close copilot">
          ✕
        </button>
      </div>

      {showBanner && suggested && (
        <div className="mx-3 mt-2 rounded-lg border border-sky-900/60 bg-sky-950/30 p-2">
          <p className="text-[11px] font-medium text-sky-200">{suggested.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{suggested.detail}</p>
          {suggested.requiresConfirm && (
            <button
              type="button"
              onClick={() => confirm(suggested)}
              className="mt-2 rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
            >
              Confirm this move
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-1 overflow-x-auto px-3" role="tablist">
        {(["advice", "insights", "chat", "log", "memory"] as Tab[]).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
              tab === name ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {tab === "advice" && (
          <div>
            <p className="text-xs text-slate-400">{report.summary}</p>
            {target && <p className="mt-1 font-mono text-[10px] text-slate-500">Moves for {target.id}</p>}
            <ul className="mt-2 space-y-2">
              {cards.map((card) => (
                <li key={card.id} className="rounded bg-slate-900/70 p-2">
                  <p className="text-xs font-medium text-slate-100">{card.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{card.detail}</p>
                  {card.requiresConfirm && (
                    <button
                      type="button"
                      onClick={() => confirm(card)}
                      className="mt-1.5 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                    >
                      Confirm
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <ul className="mt-2 space-y-2">
              {report.advice.map((advice) => (
                <AdviceRow key={advice.id} advice={advice} />
              ))}
            </ul>
            {trace.length > 1 && <Spark values={trace} threshold={threshold} />}
            {COPILOT_ENABLED && (
              <button
                type="button"
                onClick={askAI}
                disabled={loading}
                className="mt-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:bg-slate-700"
              >
                {loading ? "Consulting Claude…" : "Ask the AI copilot"}
              </button>
            )}
            {aiText && <p className="mt-2 whitespace-pre-line text-xs text-slate-200">{aiText}</p>}
            {aiError && <p className="mt-2 text-[11px] text-amber-400">{aiError}</p>}
          </div>
        )}

        {tab === "insights" && (
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li key={insight.id} className="rounded bg-slate-900/70 p-2">
                <button type="button" className="w-full text-left" onClick={() => setEvidenceId(evidenceId === insight.id ? null : insight.id)}>
                  <span className={`font-mono text-[9px] uppercase ${SEV_STYLE[insight.severity === "info" ? "info" : insight.severity === "critical" ? "critical" : "warn"].text}`}>
                    {insight.severity}
                  </span>
                  <p className="text-xs text-slate-100">{insight.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{insight.summary}</p>
                </button>
                {evidenceId === insight.id && <Evidence insight={insight} />}
              </li>
            ))}
          </ul>
        )}

        {tab === "chat" && (
          <div>
            <ul className="space-y-2">
              {lines.length === 0 && (
                <li className="text-[11px] text-slate-500">Ask about a truck, or use /brief /risk /verify /forecast /whatif /report. Ctrl+K opens this box.</li>
              )}
              {lines.map((line, index) => (
                <li key={`${index}-${line.role}`} className="text-[11px] leading-snug text-slate-300">
                  <span className="font-mono text-[9px] uppercase text-slate-500">{line.role === "you" ? "You" : line.mode === "model" ? "FROST local" : "FROST rules"}</span>
                  <p className="whitespace-pre-wrap">{line.text}</p>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(draft);
              }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask FROST"
                className="min-w-0 flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <button type="submit" className="rounded bg-slate-800 px-2 text-[11px] text-slate-100">
                Send
              </button>
            </form>
          </div>
        )}

        {tab === "log" && (
          <div className="space-y-2">
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300"
              onClick={() => void writeAudit({ action: "request_reanchor", shipmentId: target?.id ?? "ledger", anchored: false })}
            >
              Record re-anchor check
            </button>
            <ul className="space-y-1">
              {log.length === 0 && <li className="text-[11px] text-slate-500">No confirmed moves yet.</li>}
              {log.map((row, index) => (
                <li key={`${row.at}-${index}`} className="text-[11px] text-slate-400">
                  <span className="font-mono text-[9px] text-slate-500">{row.action}</span> {row.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "memory" && (
          <div>
            <form
              className="flex gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (!memoryDraft.trim()) return;
                void fetch("/api/copilot/v2/memory", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ kind: "decision", content: memoryDraft.trim() }),
                }).then(() => {
                  setMemoryDraft("");
                  void loadMemory();
                });
              }}
            >
              <input
                value={memoryDraft}
                onChange={(event) => setMemoryDraft(event.target.value)}
                placeholder="Remember a decision"
                className="min-w-0 flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <button type="submit" className="rounded bg-slate-800 px-2 text-[11px] text-slate-100">
                Save
              </button>
            </form>
            <ul className="mt-2 space-y-1">
              {memory.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2 text-[11px] text-slate-300">
                  <span>{item.content}</span>
                  <button
                    type="button"
                    className="text-slate-500"
                    onClick={() => {
                      void fetch(`/api/copilot/v2/memory?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).then(() => loadMemory());
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {auditNote && <p className="mt-2 text-[11px] text-amber-400">{auditNote}</p>}
      </div>
    </div>
  );
}

function AdviceRow({ advice }: { advice: Advice }) {
  const style = SEV_STYLE[advice.severity];
  return (
    <li className="rounded bg-slate-900/70 p-2">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
        <span className={`text-xs font-medium ${style.text}`}>{advice.title}</span>
      </div>
      <p className="mt-0.5 pl-3.5 text-[11px] leading-snug text-slate-400">{advice.detail}</p>
    </li>
  );
}

function Evidence({ insight }: { insight: Insight }) {
  const entries = Object.entries(insight.evidence.values);
  return (
    <div className="mt-1 rounded border border-slate-800 p-1.5 font-mono text-[10px] text-slate-400">
      <p>{insight.evidence.source}{insight.evidence.timeRange ? ` · ${insight.evidence.timeRange}` : ""}</p>
      {entries.map(([key, value]) => (
        <p key={key}>{key}: {value == null ? "no data" : String(value)}</p>
      ))}
    </div>
  );
}

function Spark({ values, threshold }: { values: number[]; threshold: number | null }) {
  const width = 220;
  const height = 36;
  const min = Math.min(...values, threshold ?? Number.POSITIVE_INFINITY);
  const max = Math.max(...values, threshold ?? Number.NEGATIVE_INFINITY);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const band = threshold == null ? null : height - ((threshold - min) / span) * (height - 2) - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-9 w-full" role="img" aria-label="Recent cargo temperature">
      {band != null && <line x1="0" x2={width} y1={band} y2={band} stroke="#f59e0b" strokeDasharray="3 2" strokeWidth="1" />}
      <polyline fill="none" stroke="#38bdf8" strokeWidth="1.5" points={points} />
    </svg>
  );
}
