import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunFile } from "../eval/run.js";

interface CaseBundle {
  id: string;
  title: string;
  migration: string;
  label: unknown;
  baseline: unknown;
  gatekeeper: unknown;
  scores: { baseline: unknown; gatekeeper: unknown };
  trajectories: Record<string, unknown[]>;
}

/**
 * Builds a single self-contained HTML page for one Run: comparison table, every
 * Case's Review from both methods, and every role's Trajectory as a timeline.
 * Generated from the JSON/JSONL on disk, so it cannot say anything the data doesn't.
 */
export async function buildViewer(runId: string): Promise<string> {
  const dir = path.join("results", runId);
  const readRun = async (m: string): Promise<RunFile | null> =>
    JSON.parse(await readFile(path.join(dir, `${m}.json`), "utf8").catch(() => "null"));
  const [b, g] = await Promise.all([readRun("baseline"), readRun("gatekeeper")]);
  const comparison = await readFile(path.join(dir, "comparison.md"), "utf8").catch(() => "");
  const ids = new Set<string>([...(b?.scores ?? []), ...(g?.scores ?? [])].map((s) => s.caseId));
  const cases: CaseBundle[] = [];
  for (const id of [...ids].sort()) {
    const cdir = path.join("cases", id);
    const meta = JSON.parse(await readFile(path.join(cdir, "case.json"), "utf8"));
    const label = JSON.parse(await readFile(path.join(cdir, "label.json"), "utf8").catch(() => "null"));
    const tdir = path.join("trajectories", runId, id);
    const trajectories: Record<string, unknown[]> = {};
    for (const f of (await readdir(tdir).catch(() => [])).filter((f) => f.endsWith(".jsonl")).sort()) {
      const lines = (await readFile(path.join(tdir, f), "utf8")).split("\n").filter(Boolean);
      trajectories[f.replace(".jsonl", "")] = lines.map((l) => JSON.parse(l));
    }
    cases.push({
      id,
      title: meta.title,
      migration: await readFile(path.join(cdir, "migration.sql"), "utf8"),
      label: label ? { verdict: label.verdict, hazard: label.hazard, evidence: label.evidence } : null,
      baseline: b?.results.find((r) => r.caseId === id) ?? null,
      gatekeeper: g?.results.find((r) => r.caseId === id) ?? null,
      scores: { baseline: b?.scores.find((s) => s.caseId === id) ?? null, gatekeeper: g?.scores.find((s) => s.caseId === id) ?? null },
      trajectories,
    });
  }
  const data = { runId, comparison, baseline: b?.summary ?? null, gatekeeper: g?.summary ?? null, model: g?.model ?? b?.model, cases };
  const html = TEMPLATE.replace("__DATA__", JSON.stringify(data).replace(/</g, "\\u003c")).replace(/__RUN__/g, runId);
  const out = path.join(dir, "viewer.html");
  await writeFile(out, html);
  return out;
}

const TEMPLATE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>pg-gatekeeper · __RUN__</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#0f1115;--panel:#171a21;--line:#262b36;--fg:#e6e8ee;--dim:#9aa3b2;--ok:#3ddc84;--bad:#ff5d5d;--warn:#ffb020;--accent:#7aa2ff;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);line-height:1.45}
header{padding:20px 28px;border-bottom:1px solid var(--line);display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}
h1{font-size:18px;margin:0}h1 small{color:var(--dim);font-weight:400;margin-left:10px}
main{display:grid;grid-template-columns:280px 1fr;min-height:calc(100vh - 62px)}
nav{border-right:1px solid var(--line);padding:14px;overflow:auto}
nav button{display:block;width:100%;text-align:left;background:none;border:1px solid transparent;color:var(--fg);padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px}
nav button:hover{background:var(--panel)}nav button.active{border-color:var(--accent);background:var(--panel)}
nav .tag{float:right;font-size:11px;padding:1px 6px;border-radius:99px;background:var(--line);color:var(--dim)}
section{padding:22px 28px;overflow:auto}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:16px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:1000px){.grid2{grid-template-columns:1fr}main{grid-template-columns:1fr}nav{border-right:0;border-bottom:1px solid var(--line)}}
.badge{display:inline-block;font-weight:700;padding:3px 10px;border-radius:99px;font-size:12px;letter-spacing:.3px}
.SAFE{background:#123d2a;color:var(--ok)}.UNSAFE{background:#4a1c1c;color:var(--bad)}.ESC{background:#4a3a12;color:var(--warn)}
.ok{color:var(--ok)}.bad{color:var(--bad)}.dim{color:var(--dim)}
pre{background:#0b0d11;border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow:auto;font-size:12px;margin:8px 0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--dim);font-weight:600}
.tl{border-left:2px solid var(--line);margin-left:8px;padding-left:14px}
.ev{margin:8px 0;position:relative}.ev:before{content:"";position:absolute;left:-20px;top:7px;width:10px;height:10px;border-radius:99px;background:var(--dim)}
.ev.tool_call:before{background:var(--accent)}.ev.tool_result:before{background:#555}.ev.rejection:before{background:var(--bad)}.ev.final:before{background:var(--ok)}.ev.assistant:before{background:#c9a3ff}.ev.thinking:before{background:#4a4f5c}
details summary{cursor:pointer;color:var(--fg)}details summary .n{color:var(--dim);font-size:12px;margin-left:6px}
.role{margin:10px 0 18px}.role h4{margin:0 0 8px;text-transform:capitalize}
.kpi{display:flex;gap:18px;flex-wrap:wrap}.kpi div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:150px}.kpi b{display:block;font-size:22px}.kpi span{color:var(--dim);font-size:12px}
.md p{margin:6px 0}
</style></head><body>
<header><h1>pg-gatekeeper <small>run __RUN__</small></h1><div class="dim" id="model"></div></header>
<main><nav id="nav"></nav><section id="view"></section></main>
<script>
const DATA = __DATA__;
const $ = (s)=>document.querySelector(s);
const esc = (s)=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const fmtV = (r)=> r ? (r.verdict==="SAFE"?"SAFE":"UNSAFE"+(r.hazard?" / "+r.hazard:"")) : "–";
const pct = (x)=> (x*100).toFixed(0)+"%";
$("#model").textContent = DATA.model ? "model "+DATA.model : "";
function nav(){
  const n=$("#nav"); n.innerHTML="";
  const b=document.createElement("button"); b.textContent="Overview"; b.onclick=()=>show("overview",b); n.appendChild(b);
  for(const c of DATA.cases){const x=document.createElement("button"); const g=c.gatekeeper; const ok = c.scores.gatekeeper && c.scores.gatekeeper.actionable;
    x.innerHTML=esc(c.id)+' <span class="tag">'+(g?(ok?"✓":"✗"):"")+'</span>'; x.onclick=()=>show(c.id,x); n.appendChild(x);}
  show("overview", b);
}
function verdictOk(rv,label){ if(!rv||!label) return false; if(rv.verdict!==label.verdict) return false; return label.verdict==="SAFE"||rv.hazard===label.hazard; }
function fixCell(sc){ if(!sc) return '<span class="dim">–</span>'; const req = sc.expected.verdict==="UNSAFE" && sc.expected.hazard!=="DATA_LOSS"; if(!req) return '<span class="dim">–</span>'; return sc.fixProven?'<span class="ok">proven</span>':(sc.falseVerificationClaim?'<span class="bad">false claim</span>':'<span class="bad">none</span>'); }
function show(id,btn){ document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active")); btn.classList.add("active");
  $("#view").innerHTML = id==="overview"?overview():caseView(DATA.cases.find(c=>c.id===id)); }
function overview(){
  const b=DATA.baseline,g=DATA.gatekeeper;
  const k=(t,v,s)=>'<div><span>'+t+'</span><b>'+v+'</b><span>'+(s||"")+'</span></div>';
  let h='<div class="kpi">';
  if(b) h+=k("Baseline · actionable",pct(b.actionableRate),b.actionable+"/"+b.cases+" · verdicts "+b.verdictCorrect+"/"+b.cases+" · $"+b.meanCostUsd.toFixed(2)+"/case");
  if(g) h+=k("Gatekeeper · actionable",pct(g.actionableRate),g.actionable+"/"+g.cases+" · verdicts "+g.verdictCorrect+"/"+g.cases+" · $"+g.meanCostUsd.toFixed(2)+"/case");
  if(b) h+=k("Baseline · fixes proven",b.fixesProven+"/"+b.fixesRequired,b.falseVerificationClaims+" false \"verified\" claims");
  if(g) h+=k("Gatekeeper · fixes proven",g.fixesProven+"/"+g.fixesRequired,g.falseVerificationClaims+" false \"verified\" claims · "+g.escalated+" escalated");
  h+='</div>';
  h+='<div class="card"><table><tr><th>Case</th><th>Label</th><th>Baseline</th><th>Fix</th><th>Gatekeeper</th><th>Fix</th><th>Cost</th><th>Time</th></tr>';
  for(const c of DATA.cases){const bl=c.baseline,gk=c.gatekeeper,sb=c.scores.baseline,sg=c.scores.gatekeeper;
    const cell=(r,sc)=> r? '<span class="'+(sc&&sc.actionable?"ok":"bad")+'">'+(sc&&sc.actionable?"✓ ":"✗ ")+esc(fmtV(r.review))+'</span>'+(r.needsHumanReview?' <span class="badge ESC">escalated</span>':'') : '<span class="dim">–</span>';
    h+='<tr><td>'+esc(c.id)+'<br><span class="dim">'+esc(c.title)+'</span></td><td>'+esc(fmtV(c.label))+'</td><td>'+cell(bl,sb)+'</td><td>'+fixCell(sb)+'</td><td>'+cell(gk,sg)+'</td><td>'+fixCell(sg)+'</td><td>'+(gk?'$'+gk.usage.costUsd.toFixed(2):'')+'</td><td>'+(gk?(gk.wallMs/1000).toFixed(0)+'s':'')+'</td></tr>';}
  h+='</table></div>';
  if(DATA.comparison) h+='<div class="card"><pre>'+esc(DATA.comparison)+'</pre></div>';
  return h;
}
function review(r,label,sc){ if(!r) return '<div class="card dim">not run</div>'; const v=r.review; const ok=verdictOk(v,label);
  return '<div class="card"><div><span class="badge '+(r.needsHumanReview?"ESC":v.verdict)+'">'+(r.needsHumanReview?"NEEDS HUMAN REVIEW":v.verdict)+'</span> '+(v.hazard?'<b>'+esc(v.hazard)+'</b>':'')+' <span class="'+(ok?"ok":"bad")+'">'+(ok?"matches label":"does not match label")+'</span> <span class="dim">· confidence '+(v.confidence*100).toFixed(0)+'%</span></div>'
  +'<p>'+esc(v.summary)+'</p><ul>'+v.evidence.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>'
  +(v.fixed_migration?'<div><b>Fix</b> · model says '+(v.fix_verified?"verified":"not verified")+' · harness: '+fixCell(sc)+'<pre><code>'+esc(v.fixed_migration.trim())+'</code></pre></div>':'')
  +'<p><b>Do this:</b> '+esc(v.action)+'</p>'+(r.escalationReason?'<p class="dim">Escalated: '+esc(r.escalationReason)+'</p>':'')
  +'<p class="dim">'+esc(r.method)+' · '+(r.wallMs/1000).toFixed(0)+'s · $'+r.usage.costUsd.toFixed(2)+' · '+r.usage.inputTokens.toLocaleString()+' in / '+r.usage.outputTokens.toLocaleString()+' out · '+r.retries+' retries</p></div>'; }
function caseView(c){
  let h='<h2 style="margin-top:0">'+esc(c.id)+' <span class="dim">'+esc(c.title)+'</span></h2>';
  h+='<div class="card"><b>Migration under review</b><pre><code>'+esc(c.migration.trim())+'</code></pre><b>Label</b> (from the harness): '+esc(fmtV(c.label))
  +(c.label&&c.label.evidence?' <span class="dim">· migration '+c.label.evidence.migrationMs+' ms · writer stall '+c.label.evidence.writerMaxStallMs+' ms · locks '+esc(c.label.evidence.locks.map(l=>l.table+':'+l.mode.replace("Lock","")).join(", "))+'</span>':'')+'</div>';
  h+='<div class="grid2"><div><h3>Baseline (one prompt)</h3>'+review(c.baseline,c.label,c.scores.baseline)+'</div><div><h3>Gatekeeper (planner → executor → verifier)</h3>'+review(c.gatekeeper,c.label,c.scores.gatekeeper)+'</div></div>';
  h+='<h3>Trajectories</h3>';
  const order=["baseline","planner","executor","verifier","orchestrator"];
  for(const role of order){ const evs=c.trajectories[role]; if(!evs) continue;
    h+='<div class="card role"><h4>'+role+' <span class="dim">'+evs.length+' events</span></h4><div class="tl">';
    for(const e of evs){ h+='<div class="ev '+e.type+'">'+event(e)+'</div>'; }
    h+='</div></div>'; }
  return h;
}
function event(e){ const t=e.ts.slice(11,19);
  switch(e.type){
    case "instructions": return '<details><summary><b>Instructions</b><span class="n">'+t+'</span></summary><p><b>System</b></p><pre>'+esc(e.system)+'</pre><p><b>User</b></p><pre>'+esc(e.user)+'</pre></details>';
    case "thinking": return '<details><summary class="dim">thinking<span class="n">'+t+'</span></summary><pre>'+esc(e.text)+'</pre></details>';
    case "assistant": return '<div><span class="dim">'+t+' · in '+(e.usage.input||0)+' / cached '+(e.usage.cacheRead||0)+' / out '+(e.usage.output||0)+'</span>'+(e.text?'<div class="md">'+esc(e.text).replace(/\\n/g,'<br>')+'</div>':'')+'</div>';
    case "tool_call": return '<details><summary>→ <code>'+esc(e.name)+'</code><span class="n">'+t+'</span></summary><pre>'+esc(JSON.stringify(e.input,null,2))+'</pre></details>';
    case "tool_result": return '<details><summary>← <code>'+esc(e.name)+'</code><span class="n">'+e.ms+' ms</span></summary><pre>'+esc(typeof e.output==="string"?e.output:JSON.stringify(e.output,null,2))+'</pre></details>';
    case "rejection": return '<div><b class="bad">Verifier rejected</b> (round '+e.round+'): '+esc(e.reason)+'</div>';
    case "retry": return '<div><b>Executor retry</b> round '+e.round+'</div>';
    case "escalation": return '<div><b class="bad">Escalated to a human:</b> '+esc(e.reason)+'</div>';
    case "final": return '<details><summary><b class="ok">Final output</b><span class="n">'+t+'</span></summary><pre>'+esc(JSON.stringify(e.output,null,2))+'</pre></details>';
    default: return esc(JSON.stringify(e));
  } }
nav();
</script></body></html>`;
