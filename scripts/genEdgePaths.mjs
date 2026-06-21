/**
 * ONE-TIME generator: fetches real road geometry for each Chennai edge from the
 * free public OSRM demo server and bakes it into lib/city/edgePaths.ts as static
 * data. This keeps RULE 3 intact — at runtime ColdGrid has ZERO network
 * dependency and stays deterministic (RULE 4); OSRM is only a dev-time tool.
 *
 * Re-run with `node scripts/genEdgePaths.mjs` only if node coordinates or the
 * edge list in lib/city/chennai.ts change. Mirrors that data below.
 */

import { readFile, writeFile } from "node:fs/promises";

const NODES = {
  koyambedu: [80.194, 13.069],
  kasimedu: [80.297, 13.124],
  "aavin-madhavaram": [80.231, 13.148],
  "hub-perambur": [80.232, 13.112],
  "hub-guindy": [80.212, 13.008],
  "hub-ambattur": [80.162, 13.106],
  "t-nagar": [80.233, 13.041],
  mylapore: [80.269, 13.033],
  adyar: [80.257, 13.006],
  "anna-nagar": [80.21, 13.085],
  velachery: [80.221, 12.979],
  tambaram: [80.114, 12.924],
  sholinganallur: [80.227, 12.901],
  porur: [80.158, 13.036],
  "ennore-port": [80.323, 13.235],

  // ── Regional expansion (Tamil Nadu satellite cities) ──────────────────────
  "kanchipuram-mandi": [79.715, 12.828],
  "hub-kanchipuram": [79.71, 12.831],
  "kanchipuram-silk-market": [79.7036, 12.8342],
  "vellore-agri": [79.15, 12.91],
  "hub-vellore": [79.14, 12.92],
  "vellore-cmc": [79.1325, 12.9165],
  "vellore-fort": [79.132, 12.926],
  "puducherry-harbour": [79.835, 11.928],
  "auroville-farm": [79.81, 12.005],
  "hub-puducherry": [79.825, 11.94],
  "puducherry-main": [79.83, 11.934],
  "mahabalipuram-fish": [80.199, 12.612],
  "mahabalipuram-market": [80.193, 12.617],
  "chengalpattu-wholesale": [79.965, 12.68],
  "hub-chengalpattu": [79.97, 12.69],
  "chengalpattu-market": [79.978, 12.685],
  "hub-sriperumbudur": [79.94, 12.97],
  "sriperumbudur-retail": [79.945, 12.965],
};

const EDGES = [
  ["koyambedu_ambattur", "koyambedu", "hub-ambattur"],
  ["koyambedu_guindy", "koyambedu", "hub-guindy"],
  ["koyambedu_perambur", "koyambedu", "hub-perambur"],
  ["kasimedu_perambur", "kasimedu", "hub-perambur"],
  ["aavin_perambur", "aavin-madhavaram", "hub-perambur"],
  ["aavin_ambattur", "aavin-madhavaram", "hub-ambattur"],
  
  ["koyambedu_annanagar", "koyambedu", "anna-nagar"],
  ["koyambedu_annanagar_bypass", "koyambedu", "anna-nagar"],
  ["koyambedu_tnagar", "koyambedu", "t-nagar"],
  ["koyambedu_tnagar_bypass", "koyambedu", "t-nagar"],
  ["kasimedu_mylapore_coastal", "kasimedu", "mylapore"],
  ["kasimedu_mylapore_city", "kasimedu", "mylapore"],
  
  ["perambur_annanagar", "hub-perambur", "anna-nagar"],
  ["perambur_tnagar", "hub-perambur", "t-nagar"],
  ["perambur_tnagar_bypass", "hub-perambur", "t-nagar"],
  ["perambur_mylapore", "hub-perambur", "mylapore"],
  ["guindy_tnagar", "hub-guindy", "t-nagar"],
  ["guindy_mylapore", "hub-guindy", "mylapore"],
  ["guindy_adyar_main", "hub-guindy", "adyar"],
  ["guindy_adyar_omr", "hub-guindy", "adyar"],
  ["guindy_velachery_main", "hub-guindy", "velachery"],
  ["guindy_velachery_taramani", "hub-guindy", "velachery"],
  ["ambattur_annanagar", "hub-ambattur", "anna-nagar"],
  ["perambur_guindy", "hub-perambur", "hub-guindy"],
  ["ambattur_perambur", "hub-ambattur", "hub-perambur"],
  
  ["ennore_perambur", "ennore-port", "hub-perambur"],
  ["ennore_ambattur", "ennore-port", "hub-ambattur"],
  ["guindy_tambaram_gst", "hub-guindy", "tambaram"],
  ["guindy_tambaram_bypass", "hub-guindy", "tambaram"],
  ["guindy_sholinganallur", "hub-guindy", "sholinganallur"],
  ["adyar_sholinganallur", "adyar", "sholinganallur"],
  ["ambattur_porur", "hub-ambattur", "porur"],
  ["koyambedu_porur", "koyambedu", "porur"],

  // ── Regional expansion edges ──────────────────────────────────────────────
  ["guindy_chengalpattu_nh45", "hub-guindy", "hub-chengalpattu"],
  ["guindy_chengalpattu_ecr", "hub-guindy", "hub-chengalpattu"],
  ["ambattur_sriperumbudur", "hub-ambattur", "hub-sriperumbudur"],
  ["koyambedu_sriperumbudur", "koyambedu", "hub-sriperumbudur"],
  ["tambaram_chengalpattu", "tambaram", "hub-chengalpattu"],
  ["sriperumbudur_kanchipuram", "hub-sriperumbudur", "hub-kanchipuram"],
  ["sriperumbudur_vellore", "hub-sriperumbudur", "hub-vellore"],
  ["kanchipuram_chengalpattu", "hub-kanchipuram", "hub-chengalpattu"],
  ["chengalpattu_puducherry_ecr", "hub-chengalpattu", "hub-puducherry"],
  ["chengalpattu_puducherry_nh45a", "hub-chengalpattu", "hub-puducherry"],
  ["chengalpattu_mahabalipuram", "hub-chengalpattu", "mahabalipuram-market"],
  ["chengalpattu_mahabalipuram_inland", "hub-chengalpattu", "mahabalipuram-market"],
  ["chengalpattu_kanchipuram", "hub-chengalpattu", "hub-kanchipuram"],
  ["kanchipuram_sriperumbudur", "hub-kanchipuram", "hub-sriperumbudur"],
  ["vellore_sriperumbudur", "hub-vellore", "hub-sriperumbudur"],
  ["puducherry_chengalpattu", "hub-puducherry", "hub-chengalpattu"],
  ["chengalpattu_guindy", "hub-chengalpattu", "hub-guindy"],
  ["kanchipuram_mandi_hub", "kanchipuram-mandi", "hub-kanchipuram"],
  ["kanchipuram_hub_silk", "hub-kanchipuram", "kanchipuram-silk-market"],
  ["kanchipuram_mandi_silk", "kanchipuram-mandi", "kanchipuram-silk-market"],
  ["vellore_agri_hub", "vellore-agri", "hub-vellore"],
  ["vellore_hub_cmc", "hub-vellore", "vellore-cmc"],
  ["vellore_hub_fort", "hub-vellore", "vellore-fort"],
  ["vellore_agri_cmc", "vellore-agri", "vellore-cmc"],
  ["puducherry_harbour_hub", "puducherry-harbour", "hub-puducherry"],
  ["auroville_puducherry_hub", "auroville-farm", "hub-puducherry"],
  ["puducherry_hub_main", "hub-puducherry", "puducherry-main"],
  ["puducherry_harbour_main", "puducherry-harbour", "puducherry-main"],
  ["mahabalipuram_fish_market", "mahabalipuram-fish", "mahabalipuram-market"],
  ["mahabalipuram_fish_chengalpattu", "mahabalipuram-fish", "hub-chengalpattu"],
  ["chengalpattu_wholesale_hub", "chengalpattu-wholesale", "hub-chengalpattu"],
  ["chengalpattu_hub_market", "hub-chengalpattu", "chengalpattu-market"],
  ["chengalpattu_wholesale_market", "chengalpattu-wholesale", "chengalpattu-market"],
  ["sriperumbudur_hub_retail", "hub-sriperumbudur", "sriperumbudur-retail"],
];

// Edges that should take a visibly different road than their sibling "main".
const ALTERNATE_IDS = new Set([
  "guindy_adyar_omr",
  "guindy_velachery_taramani",
  "koyambedu_annanagar_bypass",
  "koyambedu_tnagar_bypass",
  "kasimedu_mylapore_city",
  "perambur_tnagar_bypass",
  "guindy_tambaram_bypass",
  // Regional siblings that should take a visibly different road than their main.
  "guindy_chengalpattu_ecr",
  "chengalpattu_puducherry_nh45a",
  "chengalpattu_mahabalipuram_inland",
]);

const round5 = (n) => Math.round(n * 1e5) / 1e5;

// Ramer–Douglas–Peucker line simplification (epsilon in degrees, ~28 m). Drops
// collinear points so long highway runs don't carry 1000+ redundant vertices —
// visually identical at every app zoom, far smaller bundle.
const SIMPLIFY_EPS = 0.00025;

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function rdp(points, eps) {
  if (points.length < 3) return points;
  let dmax = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps) {
    const left = rdp(points.slice(0, idx + 1), eps);
    const right = rdp(points.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function dedupe(coords) {
  const out = [];
  for (const c of coords) {
    const p = [round5(c[0]), round5(c[1])];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

async function fetchPath(id, fromId, toId) {
  const a = NODES[fromId];
  const b = NODES[toId];
  const alt = ALTERNATE_IDS.has(id);
  const url =
    `https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}` +
    `?overview=full&geometries=geojson${alt ? "&alternatives=2" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== "Ok" || !json.routes?.length) throw new Error(`${id}: ${json.code}`);
  // For alternates take the most-different (last) route; else the fastest.
  const route = alt ? json.routes[json.routes.length - 1] : json.routes[0];
  const coords = dedupe(route.geometry.coordinates);
  return { coords, km: route.distance / 1000, n: coords.length };
}

/** Load already-baked paths so existing edge geometry is preserved untouched. */
async function loadExisting() {
  try {
    const txt = await readFile(new URL("../lib/city/edgePaths.ts", import.meta.url), "utf8");
    const m = txt.match(/=\s*(\{[\s\S]*\})\s*;\s*$/);
    return m ? JSON.parse(m[1]) : {};
  } catch {
    return {};
  }
}

async function main() {
  const prev = await loadExisting();
  const result = {};
  let fetched = 0;
  for (const [id, from, to] of EDGES) {
    // Reuse existing geometry; only fetch edges we haven't baked yet.
    if (Array.isArray(prev[id]) && prev[id].length >= 2) {
      result[id] = prev[id];
      continue;
    }
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const { coords, km, n } = await fetchPath(id, from, to);
        result[id] = coords;
        console.log(`✓ ${id.padEnd(34)} ${n} pts, ${km.toFixed(2)} km`);
        ok = true;
        fetched++;
      } catch (e) {
        if (attempt === 3) {
          console.warn(`✗ ${id}: ${e.message} — falling back to straight line`);
          result[id] = [NODES[from].map(round5), NODES[to].map(round5)];
        } else {
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }
      }
    }
    await new Promise((r) => setTimeout(r, 250)); // be gentle on the demo server
  }
  console.log(`\nReused ${EDGES.length - fetched} existing, fetched ${fetched} new.`);

  // Simplify every path (RDP) to strip redundant collinear vertices.
  let before = 0;
  let after = 0;
  for (const id of Object.keys(result)) {
    before += result[id].length;
    const s = dedupe(rdp(result[id], SIMPLIFY_EPS));
    if (s.length >= 2) result[id] = s;
    after += result[id].length;
  }
  console.log(`Simplified ${before} → ${after} total vertices.`);

  const body =
    `/**\n` +
    ` * AUTO-GENERATED by scripts/genEdgePaths.mjs — DO NOT EDIT BY HAND.\n` +
    ` *\n` +
    ` * Real road geometry [lon, lat] per Chennai edge, baked from OSRM so the\n` +
    ` * runtime has no network dependency (RULE 3) and stays deterministic (RULE 4).\n` +
    ` */\n\n` +
    `export const EDGE_PATHS: Record<string, [number, number][]> = ${JSON.stringify(
      result
    )};\n`;

  await writeFile(new URL("../lib/city/edgePaths.ts", import.meta.url), body);
  console.log(`\nWrote lib/city/edgePaths.ts (${EDGES.length} edges).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
