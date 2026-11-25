(() => {
"use strict";
// ---------- World (portrait) ----------
const W = 620, H = 1000;
const VS = [100, 310, 520];            // vertical streets (x)
const HS_ALL = [90, 340, 590, 840];    // horizontal streets (y)
const LOCK_Y = 715;                    // below this line is the old quarter (new plot)
const ST = 34;
const DEPOT = {x:520, y:150};
const PARK = [327, 357, 176, 216];     // x, y, w, h
// BQ0 (the real Borča quarters from OpenStreetMap) is in borca-map.js
// a town the player downloaded (see CITY below) is added after Borča as one more part, "my"
const CITYD = (() => { try { const d = JSON.parse(localStorage.getItem("lightThemUp.city") || "null"); return d && d.q && d.q.length ? d : null; } catch (e) { return null; } })();
const BQ = CITYD ? {k:BQ0.k, parts:[...BQ0.parts, ["my", CITYD.name]], q:[...BQ0.q, ...CITYD.q]} : BQ0;
const MAPSEL = (() => { try { const v = localStorage.getItem("lightThemUp.map") || ""; return v.startsWith("borca:") ? +v.slice(6) : -1; } catch (e) { return -1; } })();
const MAP = MAPSEL >= 0 && BQ.q[MAPSEL] ? BQ.q[MAPSEL] : null;

const FIXTURES = {
  ul: {id:"ul", key:"1", short:Tx("Ulična LED"), name:Tx("Ulična LED"), kind:"ulica", style:"moderna", tone:"hladno", r:120, cost:25, repair:8, armor:1.8, col:[200,225,255], css:"var(--pro)"},
  kl: {id:"kl", key:"2", short:Tx("Klasični"), name:Tx("Klasični stub"), kind:"ulica", style:"klasična", tone:"toplo", r:105, cost:25, repair:8, armor:1.3, col:[255,186,100], css:"var(--sodium)"},
  fe: {id:"fe", key:"3", short:Tx("Fenjer"), name:Tx("Fenjer"), kind:"park", style:"klasična", tone:"toplo", r:95, cost:20, repair:6, armor:1.0, col:[255,205,135], css:"var(--fen)"},
};

const SFX = (() => {
  let ctx = null;
  let muted = false; try { muted = localStorage.getItem("lightThemUp.sound") === "off"; } catch (e) {}
  const play = (freq, type, dur, vol = 0.08, slide = 0) => {
    if (muted) return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slide) osc.frequency.exponentialRampToValueAtTime(slide, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  };
  return {
    click: () => play(520, "sine", 0.06, 0.05),
    buy: () => { play(580, "triangle", 0.09, 0.08); setTimeout(() => play(880, "triangle", 0.14, 0.08), 70); },
    coin: () => { play(980, "sine", 0.08, 0.06); setTimeout(() => play(1310, "sine", 0.12, 0.06), 60); },
    catch: () => { play(440, "square", 0.12, 0.06, 880); setTimeout(() => play(660, "square", 0.15, 0.06, 1100), 110); },
    smash: () => play(160, "sawtooth", 0.22, 0.1, 45),
    err: () => play(180, "sawtooth", 0.15, 0.07, 130),
    done: () => { play(660, "sine", 0.1, 0.06); setTimeout(() => play(990, "sine", 0.18, 0.06), 90); },
    fizz: () => play(1400, "sine", 0.18, 0.04, 300),
    alarm: () => { for (let i = 0; i < 4; i++) setTimeout(() => play(i % 2 ? 620 : 880, "square", 0.12, 0.05), i * 130); },
    outage: () => play(140, "sawtooth", 0.7, 0.09, 35),
    night: () => { play(330, "sine", 0.35, 0.05, 250); setTimeout(() => play(247, "sine", 0.5, 0.05, 196), 260); },
    dawn: () => [523, 659, 784].forEach((f, i) => setTimeout(() => play(f, "triangle", 0.22, 0.06), i * 110)),
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => play(f, "square", 0.16, 0.05), i * 100)),
    fail: () => [392, 330, 262].forEach((f, i) => setTimeout(() => play(f, "sawtooth", 0.22, 0.06), i * 150)),
    honk: () => { play(392, "square", 0.12, 0.05); setTimeout(() => play(392, "square", 0.18, 0.05), 160); },
    hum: () => { play(110, "sawtooth", 0.25, 0.025, 98); },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem("lightThemUp.sound", muted ? "off" : "on"); } catch (e) {} if (!muted) this.click(); return muted; }
  };
})();
const BULBS = {
  led: {id:"led", name:Tx("LED čip"), rf:.9, power:1, life:450, cost:40},
  st: {id:"st", name:Tx("Štedljiva"), rf:.8, power:1, life:400, cost:8},
  ob: {id:"ob", name:Tx("Obična"), rf:1, power:2, life:300, cost:12},
  ja: {id:"ja", name:Tx("Jaka"), rf:1.2, power:3, life:220, cost:20},
};
const COMBOS = {};
function combo(f, b) {
  const id = f + "+" + b; if (COMBOS[id]) return COMBOS[id];
  const F = FIXTURES[f], B = BULBS[b];
  return COMBOS[id] = {id, f:F, b:B, name:`${F.name} · ${B.name}`, kind:F.kind, style:F.style, tone:F.tone, col:F.col, css:F.css,
    r:Math.round(F.r * B.rf), power:B.power, life:B.life, armor:F.armor, get cost() { return F.cost + B.cost; }, repair:F.repair, get bulbCost() { return B.cost; }};
}
const OLD_IDS = {na:["kl", "ob"], led:["ul", "ob"], pro:["ul", "ja"], fen:["fe", "ob"]};
function modelFrom(id) {
  if (typeof id !== "string") return null;
  if (id.includes("+")) { const [f, b] = id.split("+"); return FIXTURES[f] && BULBS[b] ? combo(f, b) : null; }
  const o = OLD_IDS[id]; return o ? combo(o[0], o[1]) : null;
}
const toolModel = () => FIXTURES[S.tool] ? combo(S.tool, S.bulb) : null;
const BASE = {x:-14, y:340};
const ENTRIES = [90, 340, 590];   // the gang's quarter lies past the left edge, with three street exits
const ROUTES = [
  {id:"sever", pts:[[-14,90],[310,90],[310,340],[640,340]]},
  {id:"istok", pts:[[-14,90],[520,90],[520,-20]]},
  {id:"sredina", pts:[[-14,340],[640,340]]},
  {id:"park", pts:[[-14,340],[310,340],[310,590],[640,590]]},
  {id:"zapad", pts:[[-14,340],[100,340],[100,-20]]},
  {id:"jug", pts:[[-14,590],[520,590],[520,340],[640,340]]},
  {id:"stari", plot:true, pts:[[-14,590],[100,590],[100,840],[640,840]]},
];
const TURF_X = 60;   // the gang's own doorstep at the left edge: never closed
const REF = {cost:10, r:60, max:5, col:[214,240,255]};
const PATROL = {cost:40, r:85, speed:170, calm:30};
const GEN_CAP = [20, 32, 50, 80], GEN_COST = [100, 200, 360];
const PLOT_GEN = 16, TRAFO_CAP = 24, TRAFO_COST = [300, 450, 650];
const DISPATCH_COST = 250, LOAN_AMOUNT = 200, LOAN_BACK = 245, LOAN_RATE = 35, MAX_CARS = 4;
const SOLAR_CAP = 20, SOLAR_COST = 350, UPS_COST = 220, UPS_SEC = 15, OVER_MAX = 1.1;
const genCap = () => GEN_CAP[S.genLv] + (S.trafo || 0) * TRAFO_CAP + (S.unlocked && !MAP ? PLOT_GEN : 0) + (S.solar ? SOLAR_CAP : 0);
const VAN_COST = [100, 200, 350];
const SPEED_MULT = [1, 1.35, 1.75, 2.2], SPEED_COST = [80, 160, 300];
const PLOT_COST = 300;
const WORK_TIME = 2.4;
const INCOME_PER_HOUSE = 0.18;
const FUEL_PER_POWER = 0.012;   // $ per second per power unit at night
const LIGHT_K = 0.9;
const LAMP_HP = 5;
const NIGHT_LEN = 75, DAY_LEN = 35;
const SAT_UP = 1 / 60, SAT_DOWN = 1 / 12;   // satisfaction per second lit / dark at night
const SAVE_KEY = MAP ? "lightThemUp.borca.q" + MAP.id : "lightThemUp.save.v2";
const SENSOR_COST = 30, GLASS_COST = 25, SENSOR_DIM = .35, FOG_K = .75;
// special spots: lit at night they earn a fixed bonus, but thieves and hooligans love them
const SPOTS = [{id:"kiosk", name:Tx("Trafika"), x:334, y:114}, {id:"bus", name:Tx("Stajalište"), x:462, y:316}];
const spotRate = () => .25 + .02 * S.night;   // $ per second while lit at night
const subsidy = () => stars() >= 4;
const CRANE_COST = 280, ARMOR_COST = 260;
// new zones: bought in the shop, then they have their own taste in light and pay more
const ZONES2 = {
  ind:{key:"zInd", name:Tx("Industrijska zona"), r:[537, 357, 83, 216], cost:400, mult:1.6},
  cen:{key:"zCen", name:Tx("Centar · Šetalište"), r:[117, 357, 176, 216], cost:450, mult:1.4},
};
const hOn = h => (!h.plot || S.unlocked) && (!h.fac || S.zInd);
const inRect = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
const zoneAt = (x, y) => { for (const k in ZONES2) { const z = ZONES2[k]; if (S[z.key] && inRect(x, y, z.r)) return k; } return null; };
// reputation as 1-5 stars, each level gives a perk
const STAR_AT = [25, 50, 75, 90];
const stars = () => 1 + STAR_AT.filter(v => S.rep >= v).length;
const starStr = n => "★".repeat(n) + "☆".repeat(5 - n);
const STAR_PERK = [Tx("Osnovni nivo"), Tx("Stanari plaćaju 5% više"), Tx("Tenderi plaćaju 15% više"), Tx("LED čip 15% jeftiniji i stanari javljaju lopove"), Tx("Grad daje +60 $ svake zore i popravke su 20% jeftinije")];
const TARIFF = 1.4;   // expensive power night: +40%
const wageOf = () => (vans.length - 1) * 20 + S.speedLv * 10;   // paid every dawn

const DEFAULTS = () => ({money:140, t:0, genLv:0, speedLv:0, unlocked:!!MAP, paused:true, started:false, tool:null,
  order:0, scared:0, broken:0, flashCd:0, spawnT:10, used:0, inc:0, cover:0, coverT:0, goal:0, banner:null,
  night:1, phase:"night", phaseT:NIGHT_LEN, nightVal:0, nightN:0, dayRate:0, led:{pay:0, fuel:0, buy:0, bounty:0, theft:0, mis:0, obj:0, wage:0, ten:0}, report:"", weather:"", stormT:0, addon:null, dawn:null, dispOff:false, tariff:1, crane:false, armor:false, zInd:false, zCen:false, heat:false, lastStars:2, out:0, outAt:-1, thiefT:20, patrol:null, calm:0, tips:{}, genHp:1, dispatch:false, loan:0, tender:null, tenderCd:2, rep:30, carT:3, dispT:1, honkT:0, nightTheft:0, trafficCount:0, trafficPay:0, trafo:0, solar:false, ups:false, upsCharge:0, trip:0, tripCd:0, upsOn:false, humT:0, big:false, bigBroke:0, mission:null, bulb:"ob", gang:{presence:60, rage:0, gone:false, lv:1, back:0}, dark:.78, sel:null, hover:null, pending:null, msgT:0, moodHappy:0, moodSad:0, sat:0});
const S = DEFAULTS();
let thieves = [], traffic = [], peds = [];
const CARS = [{x:111, y:228, v:1, col:"#8a2f2f"}, {x:299, y:625, v:1, col:"#2f5a8a"}, {x:531, y:262, v:1, col:"#c9c9c9"}, {x:200, y:101, v:0, col:"#3d7a4a"}, {x:455, y:329, v:0, col:"#b88a2f"}, {x:240, y:601, v:0, col:"#5a3d7a"}];
const THIEF = {work:7, steal:15, reward:20};
const GANG_NAMES = [Tx("Banda"), Tx("Crni vukovi"), Tx("Noćne senke"), Tx("Gvozdene pesnice")];
let slots = [], houses = [], vans = [], hoods = [], jobs = [], parts = [], rocks = [], floats = [], flashes = [], refls = [], zones = [];

const hs = () => S.unlocked ? HS_ALL : HS_ALL.slice(0, 3);
const boundY = () => S.unlocked ? H : LOCK_Y;
const VH = () => S.unlocked ? H : LOCK_Y + 78;   // visible map height: only a strip of the old quarter while it is locked
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const inPark = (x, y) => MAP ? inParkMap(x, y) : x > PARK[0] && x < PARK[0] + PARK[2] && y > PARK[1] && y < PARK[1] + PARK[3];
let seed = 7;
const srand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---------- Real map: a quarter of Borča from OpenStreetMap, the same game on real streets ----------
const DIST0 = MAP ? (() => { let a = 0, b = 0; for (const [k] of MAP.bldg) { if (k === 1) a++; if (k === 2) b++; } return b / Math.max(1, a + b) > .2 ? "novi" : "stari"; })() : "novi";
const qStyle = q => { let a = 0, b = 0; for (const [k] of q.bldg) { if (k === 1) a++; if (k === 2) b++; } return b / Math.max(1, a + b) > .2 ? "novi" : "stari"; };
const LMK = [];
const STW = [16, 34, 38, 44];   // drawn street width per road class (service, residential, tertiary, secondary)
const MN = [], MSEG = [], MADJ = [], PARKS = [], COVER_PTS = [], XS = [], BLD = [];
const GENP = {x:6, y:100}, DEPR = {x:548, y:104}, GOFF = {x:0, y:0}, GANG_Y = [70, 610, 215];
let HOUSE_K = 1;
const AUTO_COST = 250, META_KEY = "lightThemUp.borca.meta";
const cl2 = (v, a, b) => Math.max(a, Math.min(b, v));
const ptIn = (x, y, f) => { let c = false; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { const xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
function segD(x, y, g) { const t = cl2((x - g.ax) * g.ux + (y - g.ay) * g.uy, 0, g.len), px = g.ax + g.ux * t, py = g.ay + g.uy * t; return {d:Math.hypot(x - px, y - py), t, x:px, y:py, side:Math.sign((x - g.ax) * -g.uy + (y - g.ay) * g.ux) || 1}; }
const segPt = (g, t, off) => ({x:g.ax + g.ux * t - g.uy * off, y:g.ay + g.uy * t + g.ux * off});
function onRoad(x, y, pad) { for (const g of MSEG) { if (Math.abs(x - (g.ax + g.bx) / 2) > g.len / 2 + 40 || Math.abs(y - (g.ay + g.by) / 2) > g.len / 2 + 40) continue; if (segD(x, y, g).d < g.w / 2 + pad) return true; } return false; }
function inBld(x, y, pad = 0) { for (const b of BLD) if (x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad && (pad > 0 || ptIn(x, y, b.f))) return true; return false; }
const inParkMap = (x, y) => PARKS.some(p => x > p.x0 && x < p.x1 && y > p.y0 && y < p.y1 && ptIn(x, y, p.f));
function mproj(p) { let b = null; for (let i = 0; i < MSEG.length; i++) { const g = MSEG[i]; if (g.cl < 1) continue; const o = segD(p.x, p.y, g); if (!b || o.d < b.d) b = Object.assign(o, {g, i}); } return b; }
function mdij(src) {   // src: [[node, cost]], returns {dist, prev}
  const n = MN.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  for (const [v, c] of src) if (c < dist[v]) dist[v] = c;
  for (;;) { let u = -1, bd = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; } if (u < 0) break; done[u] = 1;
    for (const [v, l] of MADJ[u]) if (bd + l < dist[v]) { dist[v] = bd + l; prev[v] = u; } }
  return {dist, prev};
}
const mchain = (prev, v) => { const out = []; for (let u = v; u >= 0; u = prev[u]) out.push(u); return out.reverse(); };
function mpath(a, b) { const {dist, prev} = mdij([[a, 0]]); return isFinite(dist[b]) ? mchain(prev, b) : null; }
function mroute(P, Q) {   // shortest way along real streets, as a list of points ending at Q
  const a = mproj(P), b = mproj(Q); if (!a || !b) return [{x:Q.x, y:Q.y}];
  if (a.i === b.i) return [{x:a.x, y:a.y}, {x:b.x, y:b.y}, {x:Q.x, y:Q.y}];
  const {dist, prev} = mdij([[a.g.a, a.t], [a.g.b, a.g.len - a.t]]);
  const ea = dist[b.g.a] + b.t, eb = dist[b.g.b] + b.g.len - b.t; if (!isFinite(Math.min(ea, eb))) return [{x:Q.x, y:Q.y}];
  const nodes = mchain(prev, ea <= eb ? b.g.a : b.g.b);
  return [{x:a.x, y:a.y}, ...nodes.map(i => ({x:MN[i].x, y:MN[i].y})), {x:b.x, y:b.y}, {x:Q.x, y:Q.y}];
}
function movePath(o, st) {   // cars and pedestrians: follow points, keep to their lane or sidewalk
  while (st > 0 && o.i < o.path.length) { const q = o.path[o.i], dx = q.x - o.bx, dy = q.y - o.by, d = Math.hypot(dx, dy); if (d > .01) o.ang = Math.atan2(dy, dx); if (d <= st) { o.bx = q.x; o.by = q.y; o.i++; st -= d; } else { o.bx += dx / d * st; o.by += dy / d * st; st = 0; } }
  if (o.i >= o.path.length) o.done = true;
  o.x = o.bx - Math.sin(o.ang) * o.lane; o.y = o.by + Math.cos(o.ang) * o.lane;
}
const meta = () => { try { return Object.assign({auto:{}, bank:0, started:[]}, JSON.parse(localStorage.getItem(META_KEY) || "{}")); } catch (e) { return {auto:{}, bank:0, started:[]}; } };
const metaSave = m => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} };
// Borča gets harder with every automated quarter (BL): the gang knows you, the city charges more, blackouts hit
const BL = (() => { if (!MAP) return 0; const m = meta(); return Object.keys(m.auto).filter(k => +k !== MAP.id).length; })();
const GANG_N = BL ? 1 : 2;
const autoCost = () => AUTO_COST + 150 * BL;
const autoIncome = () => { if (!MAP) return 0; const m = meta(); let v = 0; for (const k in m.auto) if (+k !== MAP.id) v += m.auto[k]; return v; };
function qAvail(id, m) {   // every part has its own first quarter; after that, quarters open next to automated ones
  const q = BQ.q[id]; if (m.auto[id] || m.started.includes(id)) return true;
  const same = BQ.q.filter(x => x.part === q.part).map(x => x.id), ids = Object.keys(m.auto).map(Number);
  const dd = (a, b) => Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy), au = ids.map(k => BQ.q[k]).filter(Boolean);
  if (au.some(a => dd(a, q) === 1)) return true;
  const mine = au.filter(a => a.part === q.part);
  if (mine.length) {   // gaps in the grid (own town): open the nearest free quarters, so the part never gets stuck
    const near = x => Math.min(...mine.map(a => dd(a, x))), free = same.map(k => BQ.q[k]).filter(x => !m.auto[x.id]);
    if (!free.some(x => near(x) === 1) && near(q) === Math.min(...free.map(near))) return true;
  }
  return !same.some(k => m.started.includes(k) || m.auto[k]);
}
function buildMap() {
  const N = MAP.nodes;
  for (let i = 0; i < N.length; i += 2) { MN.push({x:N[i], y:N[i + 1]}); MADJ.push([]); }
  for (const [cl, name, ids] of MAP.roads) for (let k = 1; k < ids.length; k++) {
    const a = ids[k - 1], b = ids[k], A = MN[a], B = MN[b], len = Math.hypot(B.x - A.x, B.y - A.y); if (len < .5) continue;
    MSEG.push({a, b, ax:A.x, ay:A.y, bx:B.x, by:B.y, len, ux:(B.x - A.x) / len, uy:(B.y - A.y) / len, cl, name, w:STW[cl]});
    if (cl >= 1) { MADJ[a].push([b, len]); MADJ[b].push([a, len]); }
  }
  const box = f => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, A = 0, cx = 0, cy = 0; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { x0 = Math.min(x0, f[i]); y0 = Math.min(y0, f[i + 1]); x1 = Math.max(x1, f[i]); y1 = Math.max(y1, f[i + 1]); A += f[j] * f[i + 1] - f[i] * f[j + 1]; cx += f[i]; cy += f[i + 1]; } return {x0, y0, x1, y1, A:Math.abs(A) / 2, cx:cx / (f.length / 2), cy:cy / (f.length / 2)}; };
  for (const [t, f] of MAP.green) { const b = box(f); if (!t && b.A > 5000) PARKS.push({f, ...b}); }
  for (const [k, f] of MAP.bldg) BLD.push({k, f, ...box(f)});
  GENP.x = MAP.gen[0]; GENP.y = MAP.gen[1]; GOFF.x = GENP.x - 6; GOFF.y = GENP.y - 100; DEPR.x = MAP.depot[0]; DEPR.y = MAP.depot[1];
  DEPOT.x = MAP.depotPt[0]; DEPOT.y = MAP.depotPt[1];
  MAP.spots.forEach((p, i) => { if (p && SPOTS[i]) { SPOTS[i].x = p[0]; SPOTS[i].y = p[1]; } });
  CARS.length = 0; for (const [x, y, ang, col] of MAP.cars) CARS.push({x, y, v:0, ang, col});
  // houses: real buildings inside the quarter, apartment blocks count more
  const roofs = ["#5a3b33", "#4b4f5c", "#5d4a36", "#3f4a45", "#6a4a3f", "#4a3e52"], flats = ["#6c6487", "#5f6b80", "#6e5f78"];
  let wsum = 0;
  for (const b of BLD) {
    if (b.k < 1 || b.cx < 8 || b.cx > W - 8 || b.cy < 8 || b.cy > H - 8 || b.A < 150) continue;
    const wt = cl2(b.A / 1400, .5, 3); wsum += wt;
    b.house = houses.length;
    houses.push({id:houses.length, x:b.x0, y:b.y0, w:b.x1 - b.x0, h:b.y1 - b.y0, cx:b.cx, cy:b.cy, poly:b.f, wt, plot:false, roof:b.k === 2 ? flats[srand() * flats.length | 0] : roofs[srand() * roofs.length | 0], lit:0, glow:0, sat:0,
      win:[srand() > .3, srand() > .3, srand() > .5, srand() > .4]});
  }
  HOUSE_K = wsum ? 60 / wsum : 1;
  // suggested lamp spots along the streets, on alternating sides
  const base = [];
  MSEG.forEach((g, i) => {
    if (g.cl < 1 || g.len < 50) return;
    for (let t = 45, sd = i % 2 ? 1 : -1; t < g.len - 25; t += 125, sd = -sd) {
      const off = g.w / 2 + 9, p = segPt(g, t, off * sd);
      if (p.x < 16 || p.x > W - 16 || p.y < 16 || p.y > H - 16 || onRoad(p.x, p.y, 4) || inBld(p.x, p.y, 3) || base.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 85)) continue;
      const r = segPt(g, t, 0); base.push(p);
      slots.push({id:slots.length, x:p.x, y:p.y, rx:r.x, ry:r.y, bx:p.x, by:p.y, axis:"s", sg:i, side:sd, plot:false, zone:"ulica", district:DIST0, lamp:null, job:null});
    }
  });
  for (const p of PARKS) { let x = (p.x0 + p.x1) / 2, y = (p.y0 + p.y1) / 2; if (!ptIn(x, y, p.f)) { x = p.cx; y = p.cy; } if (!ptIn(x, y, p.f) || x < 16 || x > W - 16 || y < 16 || y > H - 16) continue;
    const r = mproj({x, y}); slots.push({id:slots.length, x, y, rx:r.x, ry:r.y, bx:x, by:y, axis:"xy", plot:false, zone:"park", district:DIST0, lamp:null, job:null}); }
  // coverage samples: the streets and the parks of this quarter
  for (const g of MSEG) if (g.cl >= 1) for (let t = 0; t <= g.len; t += 20) { const x = g.ax + g.ux * t, y = g.ay + g.uy * t; if (x > 4 && x < W - 4 && y > 4 && y < H - 4) COVER_PTS.push([x, y]); }
  for (const p of PARKS) for (let x = p.x0 + 10; x < p.x1; x += 24) for (let y = p.y0 + 10; y < p.y1; y += 24) if (x > 4 && x < W - 4 && y > 4 && y < H - 4 && ptIn(x, y, p.f)) COVER_PTS.push([x, y]);
  // streets crossing the edge of the screen: traffic comes and goes here, the gang enters from the left
  const ins = p => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
  for (const g of MSEG) { if (g.cl < 1) continue; const A = MN[g.a], B = MN[g.b], ia = ins(A), ib = ins(B); if (ia === ib) continue;
    const inN = ia ? g.a : g.b, I = MN[inN], O = ia ? B : A, L = Math.hypot(O.x - I.x, O.y - I.y);
    const tx = O.x < 0 ? (0 - I.x) / (O.x - I.x) : O.x > W ? (W - I.x) / (O.x - I.x) : 1, ty = O.y < 0 ? (0 - I.y) / (O.y - I.y) : O.y > H ? (H - I.y) / (O.y - I.y) : 1; const t = Math.min(tx, ty);
    const ex = I.x + (O.x - I.x) * t, ey = I.y + (O.y - I.y) * t, edge = ex <= .5 ? "L" : ex >= W - .5 ? "R" : ey <= .5 ? "T" : "B";
    XS.push({inN, x:ex, y:ey, edge, out:{x:ex + (O.x - I.x) / L * 30, y:ey + (O.y - I.y) / L * 30}}); }
  // gang routes: from every left entry across the quarter to the other edges
  const left = XS.filter(x => x.edge === "L").sort((a, b) => a.y - b.y), exits = XS.filter(x => x.edge !== "L");
  if (!left.length) { const n = MN.map((p, i) => [p, i]).filter(([p, i]) => MADJ[i].length && ins(p)).sort((a, b) => a[0].x - b[0].x)[0]; if (n) left.push({inN:n[1], x:0, y:n[0].y, edge:"L"}); }
  ROUTES.length = 0; ENTRIES.length = 0;
  const names = ["sever", "sredina", "jug", "istok", "zapad", "park", "ugao", "most"];
  for (const e of left) {
    const {dist, prev} = mdij([[e.inN, 0]]), ex = exits.filter(x => isFinite(dist[x.inN])).sort((a, b) => dist[b.inN] - dist[a.inN]);
    const pick = []; for (const x of ex) if (pick.length < 2 && !pick.some(p => Math.hypot(p.x - x.x, p.y - x.y) < 250)) pick.push(x);
    for (const x of pick) ROUTES.push({id:names[ROUTES.length % names.length] + ROUTES.length, pts:[[-14, e.y], ...mchain(prev, x.inN).map(i => [MN[i].x, MN[i].y]), [x.out.x, x.out.y]]});
    if (!ENTRIES.includes(Math.round(e.y))) ENTRIES.push(Math.round(e.y));
  }
  if (ENTRIES.length) { BASE.y = ENTRIES.reduce((a, b) => a + b, 0) / ENTRIES.length; GANG_Y[0] = Math.max(10, Math.min(...ENTRIES) - 40); GANG_Y[1] = Math.min(H - 10, Math.max(...ENTRIES) + 40); GANG_Y[2] = (GANG_Y[0] + GANG_Y[1]) / 2; }
  for (const [type, name, x, y, poly] of MAP.lm || []) if (LM_REQ[type]) LMK.push({type, name, x, y, poly, st:0, acc:0});
  ZONES2.ind.r = [W - 230, H - 330, 220, 300]; ZONES2.cen.r = [20, 300, 240, 260];
}

// real places from OpenStreetMap: lit the way they like, they pay a bonus every night
const LM_REQ = {
  skola:{t:Tx("Škola"), need:Tx("LED čip ili Jaka sijalica"), ok:m => m.b.id === "led" || m.b.id === "ja"},
  crkva:{t:Tx("Crkva"), need:Tx("klasično toplo svetlo"), ok:m => m.style === "klasična"},
  pijaca:{t:Tx("Pijaca"), need:Tx("Ulična LED"), ok:m => m.f.id === "ul"},
  biblioteka:{t:Tx("Biblioteka"), need:Tx("toplo svetlo"), ok:m => m.tone === "toplo"},
  vrtic:{t:Tx("Vrtić"), need:Tx("toplo svetlo"), ok:m => m.tone === "toplo"},
  "dom zdravlja":{t:Tx("Dom zdravlja"), need:Tx("hladno LED svetlo"), ok:m => m.tone === "hladno"},
  policija:{t:Tx("Policija"), need:Tx("bilo koje svetlo"), ok:() => true},
};
const LM_RATE = .35;   // $ per second while a place is lit the way it likes
function updateLandmarks(dt) {
  const night = S.phase === "night";
  for (const l of LMK) {
    let st = 0;   // 0 dark, 1 lit but wrong light, 2 happy
    if (night) for (const s of slots) if (isLit(s) && Math.hypot(s.x - l.x, s.y - l.y) < lr(s) * LIGHT_K + 18) { st = Math.max(st, LM_REQ[l.type].ok(s.lamp.m) ? 2 : 1); if (st === 2) break; }
    if (st === 2 && l.st !== 2) { float(l.x, l.y - 24, Tx`${l.name}: hvala!`, "#7ed39a"); }
    l.st = st;
    if (st === 2) { const v = LM_RATE * dt; S.money += v; S.led.obj += v; l.acc = (l.acc || 0) + v; if (l.acc >= 5) { l.acc -= 5; float(l.x, l.y - 14, "+5 $", "#7ed39a"); } }
  }
}
function drawLandmarks() {
  ctx.save(); ctx.textAlign = "center";
  for (const l of LMK) {
    const R = LM_REQ[l.type], col = l.st === 2 ? "#7ed39a" : l.st === 1 ? "#ff9d8f" : "#f1c453";
    if (l.poly && l.poly.length > 4) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(l.st === 2 ? [] : [5, 4]); polyPath(ctx, l.poly); ctx.stroke(); ctx.setLineDash([]); }
    const t1 = l.name.length > 26 ? R.t : l.name, t2 = l.st === 2 ? Tx("zadovoljni ✓") : l.st === 1 ? Tx`traži: ${R.need}` : Tx`noću traži: ${R.need}`;
    ctx.font = "700 11px Barlow, sans-serif"; const w = Math.max(ctx.measureText(t1).width, (ctx.font = "500 10px Barlow, sans-serif", ctx.measureText(t2).width)) + 12, y = l.y - 4;
    uprightAt(ctx, l.x, l.y, () => { ctx.fillStyle = "rgba(8,10,20,.82)"; ctx.fillRect(l.x - w / 2, y - 13, w, 27); ctx.fillStyle = col; ctx.fillRect(l.x - w / 2, y - 13, 3, 27);
    ctx.font = "700 11px Barlow, sans-serif"; ctx.fillStyle = "#ece6d6"; ctx.fillText(t1, l.x, y - 1); ctx.font = "500 10px Barlow, sans-serif"; ctx.fillStyle = col; ctx.fillText(t2, l.x, y + 10); });
  }
  ctx.restore();
}
function mapPosOk(self, x, y, c) {
  const ax = c ? c.axis : self && self.axis;
  if (x < 10 || x > W - 10 || y < 10 || y > H - 10) return false;
  if (ax === "xy") { if (!inParkMap(x, y)) return false; } else if (ax === "yd") { if (!yardOk(x, y)) return false; } else if (onRoad(x, y, 2) || inBld(x, y, 0)) return false;
  for (const o of slots) if (o !== self && o !== tmp && (o.lamp || o.job) && avail(o) && Math.hypot(o.x - x, o.y - y) < 34) return false;
  return true;
}
function freeSpotMap(p) {
  const cands = [];
  MSEG.forEach((g, i) => { if (g.cl < 1) return; const o = segD(p.x, p.y, g); if (o.d > 60 || o.t < 6 || o.t > g.len - 6) return; const lat = cl2(o.d, g.w / 2 + 5, g.w / 2 + 17), q = segPt(g, o.t, lat * o.side);
    cands.push({x:q.x, y:q.y, rx:o.x, ry:o.y, axis:"s", sg:i, side:o.side}); });
  if (inParkMap(p.x, p.y)) { const r = mproj(p); if (r) cands.push({x:p.x, y:p.y, rx:r.x, ry:r.y, axis:"xy"}); }
  cands.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  return cands.find(c => mapPosOk(null, c.x, c.y, c)) || null;
}
function moveSlotMap(s, px, py) {
  let x, y;
  if (s.axis === "xy" || s.axis === "yd") { x = px; y = py; }
  else { const g = MSEG[s.sg], b = segD(s.bx, s.by, g), o = segD(px, py, g), t = cl2(o.t, Math.max(4, b.t - 45), Math.min(g.len - 4, b.t + 45)), lat = cl2(o.d * (o.side === s.side ? 1 : 0), g.w / 2 + 3, g.w / 2 + 23), q = segPt(g, t, lat * s.side); x = q.x; y = q.y; }
  if (mapPosOk(s, x, y)) { const moved = Math.abs(x - s.x) > .01 || Math.abs(y - s.y) > .01; setSlotPos(s, x, y); return moved; }
  return false;
}
function mapCands(s, cands) { const g = MSEG[s.sg], b = segD(s.bx, s.by, g); for (let d = -40; d <= 40; d += 10) { const t = b.t + d; if (t < 4 || t > g.len - 4) continue; const q = segPt(g, t, b.d * s.side); cands.push([q.x, q.y]); } }
function startLampsMap() {
  const st = slots.filter(s => s.zone === "ulica").sort((a, b) => Math.hypot(a.x - W / 2, a.y - H * .45) - Math.hypot(b.x - W / 2, b.y - H * .45)).slice(0, 9);
  st.forEach((s, i) => { s.lamp = newLamp(combo("kl", "ob"), [1, .9, .8, .7][i] ?? 0); if (i >= 4) s.lamp.state = i === 6 ? "burnt" : "broken"; });
  const pk = slots.find(s => s.zone === "park"); if (pk && !pk.lamp) pk.lamp = newLamp(combo("kl", "ob"), .7);
}
function patrolPathMap() {
  const ins = MN.map((p, i) => i).filter(i => MADJ[i].length && MN[i].x > 20 && MN[i].x < W - 20 && MN[i].y > 20 && MN[i].y < H - 20), pick = [];
  let cur = {x:DEPOT.x, y:DEPOT.y};
  for (let k = 0; k < 6 && ins.length; k++) { let b = -1, bd = -1; for (const i of ins) { const d = Math.min(...[cur, ...pick.map(j => MN[j])].map(p => Math.hypot(p.x - MN[i].x, p.y - MN[i].y))); if (d > bd) { bd = d; b = i; } } pick.push(b); }
  const order = []; let at = {x:DEPOT.x, y:DEPOT.y}; const left = pick.slice();
  while (left.length) { left.sort((a, b) => Math.hypot(MN[a].x - at.x, MN[a].y - at.y) - Math.hypot(MN[b].x - at.x, MN[b].y - at.y)); const n = left.shift(); order.push(n); at = MN[n]; }
  const path = []; at = {x:DEPOT.x, y:DEPOT.y};
  for (const n of order) { path.push(...mroute(at, MN[n])); at = MN[n]; }
  path.push(...mroute(at, {x:DEPOT.x, y:DEPOT.y})); return path;
}
function spawnCarMap() {
  if (traffic.length >= MAX_CARS || XS.length < 2) return;
  const A = XS[Math.random() * XS.length | 0], far = XS.filter(x => x !== A && Math.hypot(x.x - A.x, x.y - A.y) > 220), pool = far.length ? far : XS.filter(x => x !== A), B = pool[Math.random() * pool.length | 0];
  if (!B) return; const p = mpath(A.inN, B.inN); if (!p) return;
  const type = pickCarType();
  const c = {type, col:type === "taxi" ? "#f2c230" : type === "police" ? "#eef1f6" : type === "truck" ? "#e6e2d6" : CAR_COLS[Math.random() * CAR_COLS.length | 0], sp:rnd(62, 80) * (type === "truck" ? .8 : 1), honked:new Set(), lit:0, n:0,
    path:[{x:A.x, y:A.y}, ...p.map(i => MN[i]), {x:B.x, y:B.y}, B.out], i:0, bx:A.out.x, by:A.out.y, ang:0, lane:6};
  movePath(c, 0); traffic.push(c);
}
function spawnPedMap() {
  const nodes = MN.map((p, i) => i).filter(i => MADJ[i].length && MN[i].x > 0 && MN[i].x < W && MN[i].y > 0 && MN[i].y < H); if (nodes.length < 2) return;
  const fromEdge = XS.length && Math.random() < .5, A = fromEdge ? XS[Math.random() * XS.length | 0] : null, a = A ? A.inN : nodes[Math.random() * nodes.length | 0];
  const far = nodes.filter(i => Math.hypot(MN[i].x - MN[a].x, MN[i].y - MN[a].y) > 200), b = (far.length ? far : nodes)[Math.random() * (far.length || nodes.length) | 0], p = mpath(a, b); if (!p || p.length < 2) return;
  const st = A ? {x:A.x, y:A.y} : MN[a];
  const ped = {path:[...p.map(i => MN[i])], i:0, bx:st.x, by:st.y, ang:0, lane:Math.random() < .5 ? -21 : 21, col:PED_COLS[Math.random() * PED_COLS.length | 0], sp:rnd(16, 22), bob:Math.random() * 6, mood:0, moodT:0, happy:false, worried:false};
  movePath(ped, 0); peds.push(ped);
}
function polyPath(c, f) { c.beginPath(); c.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) c.lineTo(f[i], f[i + 1]); c.closePath(); }
function drawBgMap(c) {
  let s2 = 3; const r2 = () => { s2 = (s2 * 9301 + 49297) % 233280; return s2 / 233280; };
  for (let i = 0; i < 900; i++) { c.fillStyle = r2() > .5 ? "rgba(60,90,60,.25)" : "rgba(0,0,0,.25)"; c.fillRect(r2() * W, r2() * H, 2, 2); }
  for (const [t, f] of MAP.green) { c.fillStyle = t ? "#24503a" : "#1f3b24"; polyPath(c, f); c.fill(); }
  for (const p of PARKS) { let s3 = 11; const r3 = () => { s3 = (s3 * 9301 + 49297) % 233280; return s3 / 233280; };
    for (let i = 0; i < 40; i++) { const tx = p.x0 + r3() * (p.x1 - p.x0), ty = p.y0 + r3() * (p.y1 - p.y0), tr = 8 + r3() * 7; if (!ptIn(tx, ty, p.f) || onRoad(tx, ty, tr)) continue;
      c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(tx + 3, ty + 3, tr, 0, 6.28); c.fill(); c.fillStyle = "#24452a"; c.beginPath(); c.arc(tx, ty, tr, 0, 6.28); c.fill();
      c.fillStyle = "rgba(120,170,110,.18)"; c.beginPath(); c.arc(tx - tr * .3, ty - tr * .3, tr * .5, 0, 6.28); c.fill(); } }
  for (const f of MAP.water) { c.strokeStyle = "#2f4f6e"; c.lineWidth = 10; c.beginPath(); c.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) c.lineTo(f[i], f[i + 1]); c.stroke(); }
  c.lineCap = "round"; c.lineJoin = "round";
  const line = (ids) => { c.beginPath(); ids.forEach((i, k) => k ? c.lineTo(MN[i].x, MN[i].y) : c.moveTo(MN[i].x, MN[i].y)); c.stroke(); };
  for (const [cl, , ids] of MAP.roads) { c.strokeStyle = "#3b404b"; c.lineWidth = STW[cl] + 6; line(ids); }
  for (const [cl, , ids] of MAP.roads) { c.strokeStyle = "#262a33"; c.lineWidth = STW[cl]; line(ids); }
  c.strokeStyle = "#6b6448"; c.lineWidth = 1.5; c.setLineDash([10, 12]); for (const [cl, , ids] of MAP.roads) if (cl >= 2) line(ids);
  c.setLineDash([3, 4]); c.strokeStyle = "rgba(210,200,170,.3)"; c.lineWidth = 2; for (const f of MAP.foot) { c.beginPath(); c.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) c.lineTo(f[i], f[i + 1]); c.stroke(); }
  c.setLineDash([12, 8]); c.strokeStyle = "rgba(241,196,83,.35)"; c.lineWidth = 2.5; (MAP.border && MAP.border.length > 4 ? polyPath(c, MAP.border) : c.beginPath()); c.stroke(); c.setLineDash([]);
  const bz = b => { const h = b.house != null ? houses[b.house] : null; return h ? BZ(h) : 5 * (ISO ? 1.5 : 1); };
  c.fillStyle = "rgba(0,0,0,.35)"; for (const b of BLD) { const z = bz(b); for (let k = 0; k <= 1; k += .5) { c.save(); c.translate(SHV.x * z * k, SHV.y * z * k); polyPath(c, b.f); c.fill(); c.restore(); } }   // ground shadows
  for (const b of ISO ? BLD.slice().sort((a, b2) => proj(a.x1, a.y1).y - proj(b2.x1, b2.y1).y) : BLD) {
    const h = b.house != null ? houses[b.house] : null, fac = h && S.zInd && inRect(h.cx, h.cy, ZONES2.ind.r);
    const z = bz(b), rc = fac ? "#5b6068" : h ? h.roof : "#3c4049";
    for (let k = 0, ks = Math.max(.4, 1.5 / VZ); k < z; k += ks) { c.fillStyle = shade(rc, k < z * .5 ? .5 : .62); c.save(); c.translate(UPV.x * k, UPV.y * k); polyPath(c, b.f); c.fill(); c.restore(); }   // walls: the outline stacked up
    c.save(); c.translate(UPV.x * z, UPV.y * z); c.fillStyle = rc; polyPath(c, b.f); c.fill();
    polyPath(c, b.f); c.clip(); c.fillStyle = "rgba(255,255,255,.06)"; c.fillRect(b.x0, b.y0, (b.x1 - b.x0) / 2, b.y1 - b.y0);
    if (fac) { c.fillStyle = "#6e747d"; for (let x = b.x0 + 3; x < b.x1 - 4; x += 8) c.fillRect(x, b.y0 + 3, 5, b.y1 - b.y0 - 6); }
    else if (h) { c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 1; c.beginPath(); if (b.x1 - b.x0 > b.y1 - b.y0) { c.moveTo(b.x0, (b.y0 + b.y1) / 2); c.lineTo(b.x1, (b.y0 + b.y1) / 2); } else { c.moveTo((b.x0 + b.x1) / 2, b.y0); c.lineTo((b.x0 + b.x1) / 2, b.y1); } c.stroke(); }
    c.restore(); c.save(); c.translate(UPV.x * z, UPV.y * z); c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = .8; polyPath(c, b.f); c.stroke(); c.restore();
  }
  // street names along the longest straight piece of each street
  c.font = "600 12px Barlow, sans-serif"; c.textAlign = "center"; const done = new Set();
  for (const g of MSEG.slice().sort((a, b) => b.len - a.len)) {
    if (!g.name || g.cl < 1 || done.has(g.name)) continue; const need = c.measureText(g.name).width + 30; if (g.len < need) continue;
    let mx = 0, my = 0, ok = false;
    for (const t of [.5, .38, .62, .26, .74]) { mx = g.ax + (g.bx - g.ax) * t; my = g.ay + (g.by - g.ay) * t; if (mx < 40 || mx > W - 40 || my < 40 || my > H - 40) continue;
      if (lblFree(mx, my, (need - 30) / 2 * Math.max(Math.abs(proj(g.ux, g.uy).x), .4))) { ok = true; break; } }   // keep street names off the lamp badges
    if (!ok) continue;
    done.add(g.name); let a = Math.atan2(g.uy, g.ux); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
    c.save(); c.translate(mx, my); c.rotate(a); c.fillStyle = "rgba(236,230,214,.62)"; c.fillText(g.name, 0, 4); c.restore();
  }
  // generator and service depot (same look as the invented quarter, moved to a free lot)
  c.save(); c.translate(GOFF.x, GOFF.y);
  if (!ISO) { c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(10, 118, 48, 84); c.fillStyle = "#262b35"; c.fillRect(6, 194, 46, 5); }
  c.fillStyle = "#39414f"; c.fillRect(6, 112, 46, 82);
  c.fillStyle = "#2a303b"; c.fillRect(11, 120, 36, 40);
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "#222" : "#d8b23a"; c.fillRect(6 + i * 7.67, 186, 7.67, 8); }
  c.fillStyle = "#cfd5df"; c.font = "700 11px Barlow Condensed, sans-serif"; c.textAlign = "center"; c.fillText("GEN", 29, lblFree(GOFF.x + 29, GOFF.y + 177, 12) ? 177 : 132); c.restore();
  c.save(); c.translate(DEPR.x - 548, DEPR.y - 104);
  if (!ISO) { c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(552, 110, 66, 114); c.fillStyle = "#272b31"; c.fillRect(548, 216, 66, 6); }
  c.fillStyle = "#3a3f47"; c.fillRect(548, 104, 66, 112);
  c.strokeStyle = "#d8d2b8"; c.lineWidth = 1;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(552, 112 + i * 30); c.lineTo(610, 112 + i * 30); c.stroke(); }
  c.fillStyle = "#cfd5df"; c.font = "700 11px Barlow Condensed, sans-serif"; c.translate(600, 160); c.rotate(Math.PI/2); c.fillText(Tx("SERVIS"), 0, 0); c.restore();
}
let gridPts = null, gridBy = -1;
function coverPts() { if (MAP) return COVER_PTS; const by = boundY(); if (by !== gridBy) { gridBy = by; gridPts = []; for (let x = 10; x < W; x += 20) for (let y = 10; y < by; y += 20) gridPts.push([x, y]); } return gridPts; }

// ---------- Build map ----------
(function build() {
  if (MAP) { buildMap(); return; }
  const HY = [45, 173, 257, 423, 507, 673, 757, 920];
  const add = (x, y, rx, ry, axis) => slots.push({id:slots.length, x, y, rx, ry, bx:x, by:y, axis, plot:y > LOCK_Y, zone:axis === "xy" ? "park" : "ulica", district:y > LOCK_Y ? "stari" : "novi", lamp:null, job:null});
  VS.forEach((x, j) => HY.forEach((y, i) => { const side = j === 0 ? -26 : j === 2 ? 26 : (i % 2 ? 26 : -26); add(x + side, y, x, y, "y"); }));
  for (const y of HS_ALL) for (const x of [205, 415]) add(x, y + 26, x, y, "x");
  add(395, 470, 310, 470, "xy"); add(470, 420, 520, 420, "xy"); add(440, 545, 440, 590, "xy");   // inside the park

  const streets = [...VS.map(x => [x - ST/2, 0, ST, H]), ...HS_ALL.map(y => [0, y - ST/2, W, ST])];
  const blocked = [[4, 106, 52, 92], [544, 100, 74, 120], [0, LOCK_Y - 4, W, 8], [PARK[0] - 10, PARK[1] - 10, PARK[2] + 20, PARK[3] + 20]];
  const hit = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
  const roofs = ["#5a3b33", "#4b4f5c", "#5d4a36", "#3f4a45", "#6a4a3f", "#4a3e52"], tiles = ["#7a3a2a", "#6e3324", "#844634", "#73402c"];
  for (let gy = 8; gy < H - 30; gy += 58) for (let gx = 8; gx < W - 30; gx += 52) {
    const w = 34 + (srand() * 10 | 0), h = 38 + (srand() * 10 | 0), x = gx + srand() * 5, y = gy + srand() * 5;
    if (x + w > W - 4 || y + h > H - 4) continue;
    if (streets.some(s => hit([x - 13, y - 13, w + 26, h + 26], s))) continue;
    if (blocked.some(b => hit([x, y, w, h], b))) continue;
    const old = y + h/2 > LOCK_Y;
    houses.push({id:houses.length, x, y, w, h, cx:x + w/2, cy:y + h/2, plot:old, roof:old ? tiles[srand() * tiles.length | 0] : roofs[srand() * roofs.length | 0], lit:0, glow:0, sat:0,
      win:[srand() > .3, srand() > .3, srand() > .5, srand() > .4]});
  }
  for (const [x, y, w, h] of [[558, 372, 50, 78], [558, 468, 50, 88]]) houses.push({id:houses.length, x, y, w, h, cx:x + w / 2, cy:y + h / 2, plot:false, fac:true, roof:"#5b6068", lit:0, glow:0, sat:0, win:[true, true, true, true]});
})();
function newLamp(m, life = 1) { return {m, life, hp:LAMP_HP, state:"ok", order:S.order++, powered:false}; }
function addVan() { const i = vans.length, hm = MAP ? {x:DEPOT.x + Math.cos(MAP.depotAng) * (i * 28 - 14), y:DEPOT.y + Math.sin(MAP.depotAng) * (i * 28 - 14)} : {x:DEPOT.x, y:DEPOT.y - 20 + i * 30}; vans.push({i, x:hm.x, y:hm.y, home:hm, path:[], state:"home", job:null, t:0, ang:MAP ? MAP.depotAng : Math.PI/2}); }
function startLamps() {
  if (MAP) return startLampsMap();
  const at = (rx, ry) => slots.find(s => s.rx === rx && s.ry === ry);
  const put = (s, m, life, state) => { s.lamp = newLamp(combo("kl", "ob"), life); if (state) s.lamp.state = state; };
  put(at(310, 257), "na", 1); put(at(205, 340), "na", .9); put(at(310, 507), "na", .8);
  put(at(310, 423), "na", 0, "broken");
  put(at(310, 470), "na", .7);   // a street lamp inside the park: residents are unhappy until it becomes a fenjer
  put(at(100, 173), "na", 0, "broken"); put(at(520, 507), "na", 0, "broken"); put(at(415, 90), "na", 0, "burnt"); put(at(100, 507), "na", 0, "broken");
}
let BASE_N = slots.length, tmp = null;   // fixed spots; tmp = a free spot being tried right now
function makeSlot(c) { return {id:slots.length, x:c.x, y:c.y, rx:c.rx, ry:c.ry, bx:c.x, by:c.y, axis:c.axis, sg:c.sg, side:c.side, plot:!MAP && c.y > LOCK_Y, zone:c.axis === "xy" ? "park" : c.axis === "yd" ? "dvoriste" : "ulica", district:MAP ? DIST0 : c.y > LOCK_Y ? "stari" : "novi", lamp:null, job:null, dyn:true}; }
function useTmp(c) {
  if (!tmp) { tmp = makeSlot(c); slots.push(tmp); }
  Object.assign(tmp, {x:c.x, y:c.y, rx:c.rx, ry:c.ry, bx:c.x, by:c.y, axis:c.axis, sg:c.sg, side:c.side, plot:!MAP && c.y > LOCK_Y, zone:c.axis === "xy" ? "park" : c.axis === "yd" ? "dvoriste" : "ulica", district:MAP ? DIST0 : c.y > LOCK_Y ? "stari" : "novi"});
  return tmp;
}
function dropTmp() { if (tmp && !tmp.lamp && !tmp.job && slots[slots.length - 1] === tmp) { slots.pop(); if (S.pending === tmp) S.pending = null; if (S.sel === tmp) S.sel = null; } tmp = null; }
function spotOk(c) {
  if (MAP) return mapPosOk(null, c.x, c.y, c);
  if (c.axis === "yd" && !yardOk(c.x, c.y)) return false;
  if (c.axis === "y" && HS_ALL.some(h => Math.abs(c.y - h) < 30)) return false;
  if (c.axis === "x" && VS.some(v => Math.abs(c.x - v) < 30)) return false;
  if (Math.abs(c.y - LOCK_Y) < 10 || c.y > boundY() - 8) return false;
  if (c.x < 10 || c.x > W - 10 || c.y < 10) return false;
  for (const o of slots) if (o !== tmp && (o.lamp || o.job) && avail(o) && Math.hypot(o.x - c.x, o.y - c.y) < 34) return false;
  return true;
}
// Yards: a lantern (only a lantern) can stand between the buildings inside a block, away from the street.
function yardOk(x, y) {
  if (MAP) { if (onRoad(x, y, 16) || inParkMap(x, y) || [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]].some(([dx, dy]) => inBld(x + dx, y + dy, 0))) return false; return inBld(x, y, 45); }
  if (x < 12 || x > W - 12 || y < 12 || y > boundY() - 10 || Math.abs(y - LOCK_Y) < 12) return false;
  if (VS.some(v => Math.abs(x - v) < 38) || hs().some(h => Math.abs(y - h) < 38)) return false;
  if (x > PARK[0] - 6 && x < PARK[0] + PARK[2] + 6 && y > PARK[1] - 6 && y < PARK[1] + PARK[3] + 6) return false;
  const on = houses.filter(hOn); if (on.some(h => x > h.x - 4 && x < h.x + h.w + 4 && y > h.y - 4 && y < h.y + h.h + 4)) return false;
  return on.some(h => x > h.x - 45 && x < h.x + h.w + 45 && y > h.y - 45 && y < h.y + h.h + 45);
}
function yardCand(p) {
  if (!yardOk(p.x, p.y)) return null;
  if (MAP) { const r = mproj(p); return r ? {x:p.x, y:p.y, rx:r.x, ry:r.y, axis:"yd"} : null; }
  const v = VS.reduce((b, x) => Math.abs(p.x - x) < Math.abs(p.x - b) ? x : b), h = hs().reduce((b, y) => Math.abs(p.y - y) < Math.abs(p.y - b) ? y : b);
  return Math.abs(p.x - v) < Math.abs(p.y - h) ? {x:p.x, y:p.y, rx:v, ry:p.y, axis:"yd"} : {x:p.x, y:p.y, rx:p.x, ry:h, axis:"yd"};
}
const lanternTool = () => { const f = pal ? pal.f : S.tool; return !!FIXTURES[f] && FIXTURES[f].kind === "park"; };   // the fixture being placed (dragged or picked)
function freeSpot(p) {   // any sidewalk spot next to a street, or inside the park (a lantern also in a yard between buildings)
  if (lanternTool()) { const y = yardCand(p); if (y && spotOk(y)) return y; }
  if (MAP) return freeSpotMap(p);
  const cands = [], side = d => (d < 0 ? -1 : 1) * clamp(Math.abs(d), 22, 34);
  for (const v of VS) { const d = p.x - v; if (Math.abs(d) < 60) cands.push({x:v + side(d), y:p.y, rx:v, ry:p.y, axis:"y"}); }
  for (const h of hs()) { const d = p.y - h; if (Math.abs(d) < 60) cands.push({x:p.x, y:h + side(d), rx:p.x, ry:h, axis:"x"}); }
  if (p.x > PARK[0] + 12 && p.x < PARK[0] + PARK[2] - 12 && p.y > PARK[1] + 12 && p.y < PARK[1] + PARK[3] - 12) cands.push({x:p.x, y:p.y, rx:p.x < PARK[0] + PARK[2] / 2 ? 310 : 520, ry:p.y, axis:"xy"});
  cands.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  return cands.find(spotOk) || null;
}
function setSlotPos(s, x, y) { s.x = x; s.y = y; if (s.axis === "y") s.ry = y; if (s.axis === "x") s.rx = x; if (s.axis === "s" && MSEG[s.sg]) { const o = segD(x, y, MSEG[s.sg]); s.rx = o.x; s.ry = o.y; } }
function resetGame() {
  Object.assign(S, DEFAULTS()); slots.length = BASE_N; tmp = null; for (const s of slots) { s.lamp = null; s.job = null; setSlotPos(s, s.bx, s.by); }
  for (const h of houses) { h.sat = .5; h.glow = 0; }
  vans = []; hoods = []; jobs = []; traffic = []; peds = []; parts = []; rocks = []; floats = []; flashes = []; refls = []; zones = []; thieves = []; for (const c of CARS) c.gone = false;
  addVan(); startLamps();
}
resetGame();

// ---------- Save / load (this device only) ----------
let NOSAVE = false;   // set when this town was just parked, so a reload cannot write it into the next town
function save() {
  if (!S.started || NOSAVE) return;
  try {
    const keys = ["money","t","genLv","speedLv","unlocked","scared","broken","goal","night","phase","phaseT","order","nightVal","nightN","dayRate","led","report","tips","bulb","gang","genHp","trafo","solar","ups","upsCharge","dispatch","loan","tender","rep","tenderCd","big","bigBroke","mission","lastPay","weather","dispOff","tariff","crane","armor","zInd","zCen","heat","lastStars","auto","autoRate"];
    const d = {v:3, zones, dyn:slots.slice(BASE_N).filter(s => s !== tmp).map(s => ({x:s.bx, y:s.by, rx:s.rx, ry:s.ry, axis:s.axis, sg:s.sg, side:s.side})), S:Object.fromEntries(keys.map(k => [k, S[k]])), vans:vans.length,
      lamps:slots.filter(s => s.lamp).map(s => ({id:s.id, x:s.x, y:s.y, m:s.lamp.m.id, life:s.lamp.life, hp:s.lamp.hp, state:s.lamp.state, order:s.lamp.order, sensor:!!s.lamp.sensor, glass:!!s.lamp.glass})),
      jobs:jobs.map(j => ({id:j.slot.id, type:j.type, m:j.m.id, wb:!!j.wb})), sat:houses.map(h => Math.round(h.sat * 100))};
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch (e) {}
}
function readSave() {   // a broken or partial save must never stop the game from starting
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!d || (d.v !== 2 && d.v !== 3) || !d.S || typeof d.S !== "object") { if (d) try { localStorage.removeItem(SAVE_KEY); } catch (e) {} return null; }
    return d;
  } catch (e) { try { localStorage.removeItem(SAVE_KEY); } catch (e2) {} return null; }
}
function load(d) {
  try {
    resetGame(); Object.assign(S, d.S);
    for (const s of slots) { s.lamp = null; s.job = null; }
    for (const c of d.dyn || []) slots.push(makeSlot(c));
    for (const l of d.lamps || []) { const s = slots[l.id]; if (s && l.x != null) setSlotPos(s, l.x, l.y); const m = modelFrom(l.m); if (s && m) s.lamp = {m, life:l.life, hp:l.hp, state:l.state, order:l.order, powered:false, sensor:!!l.sensor, glass:!!l.glass}; }
    vans = []; for (let i = 0; i < Math.max(1, Math.min(4, d.vans || 1)); i++) addVan();
    for (const j of d.jobs || []) { const s = slots[j.id], m = modelFrom(j.m); if (s && m && (j.type === "install" || s.lamp)) { const jj = {slot:s, type:j.type, m, wb:j.wb || (d.v === 2 && j.type === "repair"), assigned:false}; s.job = jj; jobs.push(jj); } }
    S.gang = Object.assign({presence:60, rage:0, gone:false, lv:1, back:0}, S.gang); S.led = Object.assign({pay:0, fuel:0, buy:0, bounty:0, theft:0, mis:0, obj:0, wage:0, ten:0}, S.led); if (!BULBS[S.bulb]) S.bulb = "ob";
    zones = (d.zones || []).filter(z => z && isFinite(z.x)).map(z => ({...z}));
    (d.sat || []).forEach((v, i) => { if (houses[i]) houses[i].sat = (v || 0) / 100; });
    S.dark = S.phase === "night" ? .78 : .12;
    return true;
  } catch (e) { resetGame(); return false; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

// ---------- Canvas ----------
const cv = document.getElementById("cv"), ctx0 = cv.getContext("2d");
let ctx = ctx0;
// Two views: the angled top-down view (default) and the isometric view (?iso=1 or the ISO button): the map turned 45° into a diamond.
// Both are one linear projection B (map units -> screen units), so taps map back exactly with unproj().
const KY = .72;
const ISO = (() => { try { const q = new URLSearchParams(location.search).get("iso"); if (q != null) localStorage.setItem("lightThemUp.view", q === "0" ? "flat" : "iso"); return localStorage.getItem("lightThemUp.view") !== "flat"; } catch (e) { return true; } })();   // isometric is the main view; the ISO button switches to the flat one and back
const B = ISO ? [.7071, .3536, -.7071, .3536] : [1, 0, 0, KY];   // X = B0 x + B2 y, Y = B1 x + B3 y
const BDET = B[0] * B[3] - B[1] * B[2];
const proj = (x, y) => ({x:B[0] * x + B[2] * y, y:B[1] * x + B[3] * y});
const unproj = (X, Y) => ({x:(B[3] * X - B[2] * Y) / BDET, y:(-B[1] * X + B[0] * Y) / BDET});
const UPV = unproj(0, -1), up = z => ({x:UPV.x * z, y:UPV.y * z});   // straight up on the screen, in map units
const SHV = unproj(.85, .45);   // shadows fall down-right on the screen
function pbox() { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of [[0, 0], [W, 0], [0, VH()], [W, VH()]]) { const q = proj(x, y); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } return {x0, y0, x1, y1, w:x1 - x0, h:y1 - y0}; }
function uprightAt(c, ax, ay, fn) {   // draw fn() standing up at map point (ax, ay): screen-aligned, same size as the map around it
  const m = c.getTransform(), px = m.a * ax + m.c * ay + m.e, py = m.b * ax + m.d * ay + m.f, k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c) / Math.abs(BDET));
  c.save(); c.setTransform(k, 0, 0, k, px, py); c.translate(-ax, -ay); fn(); c.restore();
}
function upright(c) {   // all text on the map stands up and stays straight
  for (const f of ["fillText", "strokeText"]) { const o = c[f].bind(c);
    c[f] = (t, x, y, mw) => { const m = c.getTransform(); if ((!ISO && (m.b || m.c)) || (Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 && Math.abs(m.d - m.a) < m.a * .001)) return mw === undefined ? o(t, x, y) : o(t, x, y, mw);
      uprightAt(c, x, y, () => { if (mw === undefined) o(t, x, y); else o(t, x, y, mw); }); }; }
}
upright(ctx0);   // render() points this at the flat overlay (octx) for the badges, then back
// ---------- Camera angle: the ground is drawn a bit flattened (KY), like a camera looking down at an angle, and buildings, posts and
// text stand straight up on it. No perspective, so text stays straight and taps map back exactly.
// Badges and banners are drawn on a second, flat canvas on top (cvo).
const ocv = document.getElementById("cvo"), octx = ocv.getContext("2d");
let osW = 1, osH = 1;   // stage size, css px
function layoutTilt() {
  const st = cv.parentElement; osW = Math.max(1, st.clientWidth); osH = Math.max(1, st.clientHeight);
  cv.style.width = osW + "px"; cv.style.height = osH + "px";
  const dpr = Math.min(2, window.devicePixelRatio || 1); ocv.width = Math.round(osW * dpr); ocv.height = Math.round(osH * dpr);
}
const stRect = () => { const st = cv.parentElement, r = st.getBoundingClientRect(); return {left:r.left + st.clientLeft, top:r.top + st.clientTop, right:r.left + st.clientLeft + osW, bottom:r.top + st.clientTop + osH}; };   // inside the border
function scr2cv(cx, cy) { const r = stRect(); return {u:cx - r.left, v:cy - r.top, r}; }   // screen -> css px on the map canvas
function cv2scr(u, v) { const r = stRect(); return {x:r.left + u, y:r.top + v, r}; }
const inStage = (q, pad = 0) => q.x > q.r.left + pad && q.x < q.r.right - pad && q.y > q.r.top + pad && q.y < q.r.bottom - pad;
const scrCenterU = () => { const r = stRect(), c = scr2cv(r.left + osW / 2, r.top + osH / 2); return {x:c.u / cssW * pbox().w, y:c.v / cssW * pbox().w}; };   // screen centre in projected units
const dark = document.createElement("canvas"), dctx = dark.getContext("2d"), DKS = .5;
const bg = document.createElement("canvas"), bctx = bg.getContext("2d"); upright(bctx);
let sc = 1, cssW = 1, cssH = 1;
// Map camera: VZ = zoom, VX/VY = projected point (proj()) at the top-left of the screen. At VZ = 1 the map fills the width of the screen.
// VSH() = how many map units the screen shows from top to bottom at VZ = 1 (the screen can be shorter than the map, then you scroll).
let VZ = 1, VX = 0, VY = 0, bgV = {z:1, x:0, y:0};
const VT = c => { const k = sc * VZ; c.setTransform(k * B[0], k * B[1], k * B[2], k * B[3], -VX * k, -VY * k); };
function resize() {
  cssW = Math.max(1, cv.offsetWidth); cssH = Math.max(1, cv.offsetHeight);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(cssW * dpr));
  cv.height = Math.max(1, Math.round(cssH * dpr));
  dark.width = Math.max(1, Math.round(cv.width * DKS)); dark.height = Math.max(1, Math.round(cv.height * DKS));   // the night shade is soft, so half resolution looks the same and draws 4x faster
  bg.width = Math.round(cv.width * (1 + 2 * BGM)); bg.height = Math.round(cv.height * (1 + 2 * BGM));   // the map picture has a margin, so moving the map needs no redraw
  sc = cv.width / pbox().w; fixView(); drawBg();
}
let rsP = false; new ResizeObserver(() => { if (rsP) return; rsP = true; requestAnimationFrame(() => { rsP = false; if (cv.offsetWidth !== cssW || cv.offsetHeight !== cssH) resize(); }); }).observe(cv);   // at most once a frame, only for a real size change
const VSH = () => pbox().w * cssH / cssW;   // projected units visible top to bottom at VZ = 1
// A little 3D: buildings stand up. Each house keeps its spot on the ground; its roof is drawn BZ units higher and a front wall fills the gap.
const BZ = h => (!h ? 8 : h.fac ? 16 : h.plot ? 11 : h.poly ? (h.w * h.h > 1400 ? 16 : 11) : 14) * (ISO ? 1.5 : 1);   // building height, screen units: walls stand up toward the viewer
// Map labels stay clear of the lamp badges (checked on the screen, so it works in both views).
function lblFree(x, y, hw) { const p = proj(x, y); return slots.every(sl => { const q = proj(sl.x, sl.y), d = q.y - p.y; return Math.abs(q.x - p.x) > hw + 46 || d <= -16 || d >= 30; }); }
function lblSpot(x, y, hw, tries = [[0, 0], [0, 22], [0, -34], [-50, 0], [50, 0], [0, 40], [0, -52], [-50, 22], [50, 22]]) { const p = proj(x, y);   // moves are on the screen
  for (const [dx, dy] of tries) { const q = unproj(p.x + dx, p.y + dy); if (lblFree(q.x, q.y, hw)) return [q.x, q.y]; } return [x, y]; }
const shade = (col, k) => { const n = parseInt(col.slice(1), 16), f = v => Math.round(Math.max(0, Math.min(255, v * k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
const badgeK = () => clamp(668 / osW, .3, MAP ? 1.7 : 1.3);   // map badges: about 14 px text on any screen
let CBX = null;   // projected bounds of the playable part (houses and lamp spots)
function contentBox() { if (CBX) return CBX; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (x, y) => { const q = proj(x, y); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); };
  if (!MAP) for (const h of houses) { add(h.x, h.y); add(h.x + h.w, h.y); add(h.x, h.y + h.h); add(h.x + h.w, h.y + h.h); }
  for (const sl of slots) add(sl.x, sl.y); if (MAP) { add(GENP.x, GENP.y); add(DEPOT.x, DEPOT.y); x0 -= 60; x1 += 60; y0 -= 50; y1 += 40; }   // real maps: the lamp spots, generator and depot are the quarter
  if (x1 < x0) return pbox(); return (CBX = {x0, y0, x1, y1, w:x1 - x0, h:y1 - y0}); }
// zoomed all the way out: the whole map fits on the screen; in the isometric view the playable part fills the width (no big empty corners)
const ZMAX = ISO ? 5 : 3.5, zMin = () => { const base = Math.min(1, VSH() / pbox().h); if (!ISO) return base; const C = contentBox(); return clamp(Math.max(pbox().w / (C.w * 1.04), VSH() / (C.h * 1.04)), base, 2.4); };   // fill the screen with the quarter (a tall phone pans sideways a little)
const fitV = (v, size, view) => view >= size ? (size - view) / 2 : clamp(v, 0, size - view);   // a map smaller than the screen sits in the middle
function fixView() { const P = pbox(); VZ = clamp(VZ, zMin(), ZMAX); VX = P.x0 + fitV(VX - P.x0, P.w, P.w / VZ); VY = P.y0 + fitV(VY - P.y0, P.h, VSH() / VZ); }
const canPan = () => { const P = pbox(); return P.w / VZ < P.w - .5 || VSH() / VZ < P.h - .5; };

const BGM = .3;   // extra map picture around the screen, on each side (part of the screen size)
function drawBg() {
  const c = bctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0c120e"; c.fillRect(0, 0, bg.width, bg.height); VT(c); bgV = {z:VZ, x:VX, y:VY};
  { const m = c.getTransform(); m.e += cv.width * BGM; m.f += cv.height * BGM; c.setTransform(m); }
  if (pbox().w / VZ > pbox().w + 1 || VSH() / VZ > pbox().h + 1) {   // zoomed out past the map: dark fields and a few far-off roads around the town
    c.fillStyle = "#16201a"; for (let i = -6; i < 12; i++) for (let j = -4; j < 9; j++) if ((i * 7 + j * 13) % 5) c.fillRect(i * 140 + 8, j * 150 + 8, 124, 134);
    c.fillStyle = "#1a1f26"; for (const y of [120, 545]) { c.fillRect(-2000, y - 9, 2000, 18); c.fillRect(W, y - 9, 2000, 18); }
    c.save(); c.shadowColor = "rgba(0,0,0,.8)"; c.shadowBlur = 30 * sc * VZ; c.fillStyle = "#17211b"; c.fillRect(0, 0, W, VH()); c.restore(); }
  c.fillStyle = "#17211b"; c.fillRect(0, 0, W, H);
  if (MAP) { drawBgMap(c); return; }
  let s2 = 3; const r2 = () => { s2 = (s2 * 9301 + 49297) % 233280; return s2 / 233280; };
  for (let i = 0; i < 900; i++) { c.fillStyle = r2() > .5 ? "rgba(60,90,60,.25)" : "rgba(0,0,0,.25)"; c.fillRect(r2() * W, r2() * H, 2, 2); }
  for (const h of houses) { if (h.fac && !S.zInd) continue; c.fillStyle = "rgba(40,60,42,.55)"; c.fillRect(h.x - 5, h.y - 5, h.w + 10, h.h + 10); }
  // park
  const [px, py, pw, ph] = PARK;
  c.fillStyle = "#1f3b24"; c.fillRect(px, py, pw, ph);
  c.strokeStyle = "#4a4636"; c.lineWidth = 7; c.lineCap = "round";
  c.beginPath(); c.moveTo(px + 6, py + 6); c.quadraticCurveTo(px + pw * .5, py + ph * .45, px + pw - 6, py + ph - 6); c.stroke();
  c.beginPath(); c.moveTo(px + pw - 6, py + 10); c.quadraticCurveTo(px + pw * .45, py + ph * .55, px + 8, py + ph - 8); c.stroke();
  c.fillStyle = "#2f4f5e"; c.beginPath(); c.ellipse(px + pw * .5, py + ph * .5, 22, 14, 0, 0, 6.28); c.fill();
  let s3 = 11; const r3 = () => { s3 = (s3 * 9301 + 49297) % 233280; return s3 / 233280; };
  for (let i = 0; i < 16; i++) {
    const tx = px + 12 + r3() * (pw - 24), ty = py + 12 + r3() * (ph - 24), tr = 8 + r3() * 7;
    if (Math.hypot(tx - (px + pw / 2), ty - (py + ph / 2)) < 34) continue;
    c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(tx + 3, ty + 3, tr, 0, 6.28); c.fill();
    c.fillStyle = "#24452a"; c.beginPath(); c.arc(tx, ty, tr, 0, 6.28); c.fill();
    c.fillStyle = "rgba(120,170,110,.18)"; c.beginPath(); c.arc(tx - tr * .3, ty - tr * .3, tr * .5, 0, 6.28); c.fill();
  }
  c.fillStyle = "#cfd5df"; c.font = "700 13px Barlow Condensed, sans-serif"; c.textAlign = "center"; { const [lx, ly] = lblSpot(px + pw / 2, py + ph / 2 + 4, 16); c.fillText("PARK", lx, ly); }
  // streets
  c.fillStyle = "#262a33";
  for (const x of VS) c.fillRect(x - ST/2, 0, ST, H);
  for (const y of HS_ALL) c.fillRect(0, y - ST/2, W, ST);
  c.fillStyle = "#3b404b";
  for (const x of VS) { c.fillRect(x - ST/2 - 3, 0, 3, H); c.fillRect(x + ST/2, 0, 3, H); }
  for (const y of HS_ALL) { c.fillRect(0, y - ST/2 - 3, W, 3); c.fillRect(0, y + ST/2, W, 3); }
  c.fillStyle = "#262a33";
  for (const x of VS) for (const y of HS_ALL) c.fillRect(x - ST/2 - 3, y - ST/2 - 3, ST + 6, ST + 6);
  // cobblestones in the old quarter
  c.fillStyle = "rgba(255,240,220,.06)";
  for (const x of VS) for (let y = LOCK_Y + 4; y < H; y += 7) for (let k = -14; k < 14; k += 7) c.fillRect(x + k + ((y / 7 | 0) % 2) * 3, y, 5, 4);
  for (let x = 0; x < W; x += 7) for (let k = -14; k < 14; k += 7) c.fillRect(x + (((k + 14) / 7) % 2) * 3, 840 + k, 5, 4);
  c.strokeStyle = "#6b6448"; c.lineWidth = 1.5; c.setLineDash([10, 12]);
  for (const x of VS) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, LOCK_Y); c.stroke(); }
  for (const y of HS_ALL.slice(0, 3)) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.setLineDash([]);
  if (S.zCen) { const r = ZONES2.cen.r; c.fillStyle = "#3b3833"; c.fillRect(r[0], r[1], r[2], r[3]); c.fillStyle = "rgba(255,240,215,.07)";
    for (let y = r[1] + 2; y < r[1] + r[3]; y += 9) for (let x = r[0] + 2 + ((y / 9 | 0) % 2) * 4; x < r[0] + r[2]; x += 9) c.fillRect(x, y, 7, 7); }
  if (S.zInd) { const r = ZONES2.ind.r; c.fillStyle = "#2a2d31"; c.fillRect(r[0], r[1], r[2], r[3]); }
  const hs0 = houses.filter(h => !(h.fac && !S.zInd));
  for (const h of hs0) { const z = BZ(h); c.fillStyle = "rgba(0,0,0,.36)"; for (let k = 0; k <= 1; k += .25) c.fillRect(h.x + SHV.x * z * k, h.y + SHV.y * z * k, h.w, h.h); }   // ground shadows
  for (const h of hs0.sort((a, b) => proj(a.x + a.w, a.y + a.h).y - proj(b.x + b.w, b.y + b.h).y)) {   // back to front
    const fac = S.zInd && inRect(h.cx, h.cy, ZONES2.ind.r);
    const z = BZ(h), o = up(z), rc = fac ? "#5b6068" : h.roof, X0 = h.x, X1 = h.x + h.w, Y0 = h.y, Y1 = h.y + h.h, ry = h.y;
    const quad = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
    quad([[X0, Y1], [X1, Y1], [X1 + o.x, Y1 + o.y], [X0 + o.x, Y1 + o.y]], shade(rc, .6));   // front wall (lit side)
    quad([[X1, Y0], [X1, Y1], [X1 + o.x, Y1 + o.y], [X1 + o.x, Y0 + o.y]], shade(rc, .42));   // side wall (in shade); flat view: none
    if (!fac) { for (let x = X0 + 4; x < X1 - 4; x += 9) quad([[x + o.x * .2, Y1 + o.y * .2], [x + 4 + o.x * .2, Y1 + o.y * .2], [x + 4 + o.x * .8, Y1 + o.y * .8], [x + o.x * .8, Y1 + o.y * .8]], "rgba(20,24,34,.75)");
      if (ISO) for (let y = Y0 + 4; y < Y1 - 4; y += 9) quad([[X1 + o.x * .2, y + o.y * .2], [X1 + o.x * .2, y + 4 + o.y * .2], [X1 + o.x * .8, y + 4 + o.y * .8], [X1 + o.x * .8, y + o.y * .8]], "rgba(20,24,34,.75)"); }   // dark windows; lit ones come at night
    c.save(); c.translate(o.x, o.y);   // the roof, lifted up
    c.fillStyle = rc; c.fillRect(h.x, ry, h.w, h.h);
    if (fac) { c.fillStyle = "#6e747d"; for (let x = h.x + 3; x < h.x + h.w - 4; x += 8) c.fillRect(x, ry + 3, 5, h.h - 6); c.fillStyle = "#7a3a2a"; c.fillRect(h.x + h.w - 9, ry + 3, 6, 6); }
    c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(h.x + h.w/2, ry); c.lineTo(h.x + h.w/2, ry + h.h); c.stroke();
    if (h.plot) { c.strokeStyle = "rgba(0,0,0,.18)"; for (let yy = ry + 5; yy < ry + h.h; yy += 5) { c.beginPath(); c.moveTo(h.x, yy); c.lineTo(h.x + h.w, yy); c.stroke(); } }
    c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(h.x, ry, h.w/2, h.h); c.fillStyle = "rgba(255,255,255,.16)"; c.fillRect(h.x, ry, h.w, 1.2); c.fillRect(h.x, ry, 1.2, h.h);
    c.restore();
  }
  // generator
  if (!ISO) { c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(10, 118, 48, 84); c.fillStyle = "#262b35"; c.fillRect(6, 194, 46, 5); }
  c.fillStyle = "#39414f"; c.fillRect(6, 112, 46, 82);
  c.fillStyle = "#2a303b"; c.fillRect(11, 120, 36, 40);
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "#222" : "#d8b23a"; c.fillRect(6 + i * 7.67, 186, 7.67, 8); }
  c.fillStyle = "#cfd5df"; c.font = "700 11px Barlow Condensed, sans-serif"; c.textAlign = "center"; c.fillText("GEN", 29, lblFree(29, 177, 12) ? 177 : 132);
  // depot
  if (!ISO) { c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(552, 110, 66, 114); c.fillStyle = "#272b31"; c.fillRect(548, 216, 66, 6); }
  c.fillStyle = "#3a3f47"; c.fillRect(548, 104, 66, 112);
  c.strokeStyle = "#d8d2b8"; c.lineWidth = 1;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(552, 112 + i * 30); c.lineTo(610, 112 + i * 30); c.stroke(); }
  c.fillStyle = "#cfd5df"; c.save(); c.translate(600, 160); c.rotate(Math.PI/2); c.fillText(Tx("SERVIS"), 0, 0); c.restore();
}

// ---------- Rules ----------
const avail = s => S.unlocked || !s.plot;
const isOn = s => s && s.lamp && s.lamp.state === "ok" && s.lamp.powered && avail(s);   // would shine at night
const isLit = s => isOn(s) && S.phase === "night";
// on = true: lamps that would shine (coverage). on = false: what actually shines now, reflectors included (scares hooligans)
const sensorIdle = L => L.sensor && !(L.wake > 0) && S.phase === "night";
const lr = s => s.lamp.m.r * (S.weather === "fog" && S.phase === "night" ? FOG_K : 1) * (sensorIdle(s.lamp) ? SENSOR_DIM : 1);
function litAt(x, y, k, on) {
  const f = on ? isOn : isLit;
  for (const s of slots) if (f(s) && Math.hypot(s.x - x, s.y - y) < lr(s) * k) return true;
  if (!on && S.phase === "night") for (const r of refls) if (Math.hypot(r.x - x, r.y - y) < REF.r * k) return true;
  if (!on && S.patrol && Math.hypot(S.patrol.x - x, S.patrol.y - y) < PATROL.r * k) return true;
  return false;
}
function moodOf(s, m) {
  if (s.zone === "park") return m.kind === "park" ? [1, Tx("U parku vole fenjere.")] : [-1, Tx("U parku stanari žele fenjer.")];
  if (s.zone === "dvoriste") return m.kind === "park" ? [1, Tx("Fenjer u dvorištu: stanari vole, a svetli bojom ulice.")] : [-1, Tx("U dvorište između zgrada ide fenjer.")];
  const zk = zoneAt(s.x, s.y);
  if (zk === "ind") return m.style === "moderna" ? [1, Tx("Industrijska zona voli jaku, hladnu LED rasvetu.")] : m.kind === "park" ? [-1, Tx("Fenjer ne valja za fabrike.")] : [0, Tx("Fabrikama treba moderna LED rasveta.")];
  if (zk === "cen") return m.style === "klasična" ? [1, Tx("Šetalište voli toplo, dekorativno svetlo.")] : [-1, Tx("Na šetalištu ne vole hladnu LED svetiljku.")];
  if (s.district === "stari") return m.style === "klasična" ? [1, Tx("Stari kvart voli klasično, toplo svetlo.")] : [-1, Tx("Stari kvart ne voli modernu LED svetiljku.")];
  if (MAP && s.district === "novi") return m.kind === "park" ? [-1, Tx("Fenjer je preslab za ulicu sa zgradama.")] : m.style === "moderna" ? [1, Tx("Zgrade vole modernu, hladnu LED rasvetu.")] : [0, Tx("Klasični stub je u redu, ali zgrade više vole LED.")];
  return m.kind === "ulica" ? [1, Tx("Ulična lampa na ulici, stanari zadovoljni.")] : [0, Tx("Fenjer je lep, ali je ulici potrebna jača lampa.")];
}
const lampCol = s => s.zone === "dvoriste" && s.lamp.m.kind === "park" && districtTone(s.district).tone === "hladno" ? [215, 232, 255] : s.lamp.m.col;   // a yard lantern glows in the colour of its street lamps
function districtTone(d, extra) {   // extra: {slot, m} to test a placement
  const tones = new Set();
  for (const s of slots) if (s.district === d && avail(s) && !zoneAt(s.x, s.y) && s.zone !== "dvoriste") {   // yard lanterns take the street colour   // bought zones (industry, promenade) have their own taste and do not break the same-colour bonus
    const m = extra && extra.slot === s ? extra.m : s.lamp && s.lamp.m; if (m) tones.add(m.tone); }
  return {tones, bonus:tones.size === 1 ? 1.25 : 1, tone:tones.size === 1 ? [...tones][0] : null};
}
const repairCost = m => Math.ceil(m.repair * (S.phase === "day" ? .5 : 1) * (stars() >= 5 ? .8 : 1));
const bulbCost = m => Math.ceil(m.bulbCost * (S.phase === "day" ? .5 : 1) * (stars() >= 5 ? .8 : 1));
const inZone = (x, y) => zones.some(z => Math.hypot(z.x - x, z.y - y) < z.r);
function routeOpen(r) {
  for (let i = 1; i < r.pts.length; i++) {
    const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 15));
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n; if (x >= TURF_X && inZone(x, y)) return false; }
  }
  return true;
}
const routesNow = () => ROUTES.filter(r => !r.plot || S.unlocked);
function lampAlpha(L) { return L.life < .15 ? (Math.random() < .12 ? .25 : .85) : 1; }
function msg(t, hot) { const el = document.getElementById("msg"); el.textContent = t; el.classList.toggle("hot", !!hot); S.msgT = 5; }
function banner(title, sub) { S.banner = {title, sub, t0:performance.now()}; msg(title + " " + sub); }   // a short card at the top of the map: 2.5 to 4.5 s (by text length), a tap closes it
function float(x, y, text, col = "#f1c453", big = false) { floats.push({x, y, text, col, t:0, big}); }
function burst(x, y, col, n, sp = 80) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = rnd(.3, 1) * sp; parts.push({x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, t:0, life:rnd(.4, .9), col, sz:rnd(1, 2.6)}); } }
let coverKey = "";
function computeCover() {
  let c = 0, t = 0;
  for (const [x, y] of coverPts()) { t++; if (litAt(x, y, LIGHT_K, true)) c++; }
  const v = t ? c / t : 0; return v >= .99 ? 1 : v;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function slotPosOk(s, x, y) {
  if (MAP) return mapPosOk(s, x, y);
  if (s.axis === "y" && HS_ALL.some(h => Math.abs(y - h) < 30)) return false;
  if (s.axis === "x" && VS.some(v => Math.abs(x - v) < 30)) return false;
  if (s.axis === "yd" && !yardOk(x, y)) return false;
  if (s.plot ? y < LOCK_Y + 8 : y > LOCK_Y - 8) return false;
  if (x < 8 || x > W - 8 || y < 8 || y > H - 8) return false;
  for (const o of slots) if (o !== s && (o.lamp || o.job) && avail(o) && Math.hypot(o.x - x, o.y - y) < 34) return false;
  return true;
}
function moveSlot(s, px, py) {
  if (MAP) return moveSlotMap(s, px, py);
  const M = 45; let x = s.x, y = s.y;
  const band = (v, road, base) => base < road ? clamp(v, road - 40, road - 19) : clamp(v, road + 19, road + 40);   // stay on the sidewalk, same side
  if (s.axis === "y") { y = clamp(py, s.by - M, s.by + M); x = band(px, s.rx, s.bx); }
  else if (s.axis === "x") { x = clamp(px, s.bx - M, s.bx + M); y = band(py, s.ry, s.by); }
  else if (s.axis === "yd") { x = clamp(px, s.bx - M, s.bx + M); y = clamp(py, s.by - M, s.by + M); }
  else { x = clamp(px, PARK[0] + 10, PARK[0] + PARK[2] - 10); y = clamp(py, PARK[1] + 10, PARK[1] + PARK[3] - 10); }
  for (const [tx, ty] of [[x, y], [x, s.y], [s.x, y]]) if (slotPosOk(s, tx, ty)) { const moved = tx !== s.x || ty !== s.y; setSlotPos(s, tx, ty); return moved; }
  return false;
}
function bestSpot(m) {
  let best = null;
  for (const s of slots) {
    if (!avail(s) || s.lamp || s.job) continue;
    const ox = s.x, oy = s.y, cands = [];
    if (s.axis === "y") for (let d = -40; d <= 40; d += 10) cands.push([s.bx, s.by + d]);
    else if (s.axis === "x") for (let d = -40; d <= 40; d += 10) cands.push([s.bx + d, s.by]);
    else if (s.axis === "s") mapCands(s, cands);
    else for (let dx = -60; dx <= 60; dx += 20) for (let dy = -60; dy <= 60; dy += 20) cands.push([s.bx + dx, s.by + dy]);
    const mood = moodOf(s, m)[0];
    for (const [x, y] of cands) {
      if (!moveSlot(s, x, y) || Math.abs(s.x - x) > .5 || Math.abs(s.y - y) > .5) continue;
      const score = coverGain(s, m) + (mood < 0 ? -100 : mood === 0 ? -4 : 0);
      if (!best || score > best.score) best = {s, x, y, score};
    }
    setSlotPos(s, ox, oy);
  }
  return best;
}
function coverGain(s, m) {
  let g = 0, t = 0; const rr = m.r * LIGHT_K;
  for (const [x, y] of coverPts()) { t++; if (Math.hypot(x - s.x, y - s.y) < rr && !litAt(x, y, LIGHT_K, true)) g++; }
  return t ? Math.round(g / t * 100) : 0;
}

// Route along the street grid
function route(P, Q) {
  if (MAP) return mroute(P, Q);
  const onV = p => VS.some(x => Math.abs(p.x - x) < .5), onH = p => hs().some(y => Math.abs(p.y - y) < .5);
  if (onV(P) && onV(Q) && Math.abs(P.x - Q.x) < .5) return [Q];
  if (onH(P) && onH(Q) && Math.abs(P.y - Q.y) < .5) return [Q];
  if (onV(P) && onH(Q)) return [{x:P.x, y:Q.y}, Q];
  if (onH(P) && onV(Q)) return [{x:Q.x, y:P.y}, Q];
  if (onV(P) && onV(Q)) { const y = hs().reduce((b, y) => Math.abs(P.y - y) + Math.abs(y - Q.y) < Math.abs(P.y - b) + Math.abs(b - Q.y) ? y : b); return [{x:P.x, y}, {x:Q.x, y}, Q]; }
  if (onH(P) && onH(Q)) { const x = VS.reduce((b, x) => Math.abs(P.x - x) + Math.abs(x - Q.x) < Math.abs(P.x - b) + Math.abs(b - Q.x) ? x : b); return [{x, y:P.y}, {x, y:Q.y}, Q]; }
  return [Q];
}

// ---------- Actions ----------
function order(s, type, m, cost) {
  if (S.money < cost) { msg(Tx`Nemaš dovoljno novca. Treba ${cost} $.`, true);SFX.err(); float(s.x, s.y - 14, Tx("Fali novca"), "#ff6b5b"); return; }
  S.money -= cost; S.led.buy += cost; if (s === tmp) tmp = null;
  const j = {slot:s, type, m, assigned:false, wb:type === "repair" && s.lamp && s.lamp.life <= .05}; s.job = j; jobs.push(j);
  float(s.x, s.y - 14, `−${cost} $`, "#ff9d8f");
  const [mood, why] = moodOf(s, m);
  const full = type === "install" && !s.lamp && m.power > genCap() * OVER_MAX - S.used;
  msg(type === "install" ? Tx`${m.name}: servis kreće na montažu. ${full ? Tx("Pazi: generator je pun, lampa neće svetleti dok ne kupiš jači generator.") : mood < 0 ? Tx("Pazi: ") + why : ""}` : type === "bulb" ? Tx`Servis menja sijalicu: ${m.b.name} (${cost} $).` : Tx`Servis ide da popravi svetiljku (${cost} $).`, type === "install" && (mood < 0 || full));
  save();
  SFX.buy();
  return j;
  
}
function preview(s, tool, direct) {
  if (direct || S.pending === s) { S.pending = null; return false; }
  S.pending = s; const [mood, why] = moodOf(s, tool);
  msg(Tx`Radar: +${coverGain(s, tool)}% svetla. ${why} ${s.lamp ? "" : Tx("Prevuci prstom ili strelicama, pa Postavi.")}`, mood < 0); return true;
}
function tapSlot(s, direct) {
  S.sel = s;
  if (S.addon) { applyAddon(s); return; }
  if (s.plot && !S.unlocked) { S.pending = null; msg(Tx`Ovo je stari kvart. Kupi ga u Prodavnici (${PLOT_COST} $).`, true); return; }
  if (s.job) { S.pending = null; msg(Tx("Servis je već zakazan za ovo mesto.")); return; }
  if (S.tool === "bulb") {   // bulb only: the fixture stays as it is
    S.pending = null; const L = s.lamp;
    if (!L) { msg(Tx("Sijalica ide u postojeću lampu. Za novo mesto izaberi svetiljku (Ulična, Klasični, Fenjer)."), true); return; }
    const nb = combo(L.m.f.id, S.bulb);
    if (L.state === "broken") { msg(Tx`Svetiljka je razbijena. Servis je popravlja i stavlja sijalicu ${L.m.b.name}.`); order(s, "repair", L.m, repairCost(L.m) + (L.life <= .05 ? bulbCost(L.m) : 0)); return; }
    if (nb === L.m && L.state === "ok" && L.life >= .95) { msg(Tx`${L.m.f.name} već ima sijalicu ${nb.b.name} (${Math.ceil(L.life * 100)}%).`); return; }
    order(s, "bulb", nb, bulbCost(nb)); return;
  }
  const tool = toolModel(), L = s.lamp;
  if (!L) { if (!tool) { S.pending = null; msg(s.zone === "park" ? Tx("Mesto u parku. Ovde ide fenjer.") : Tx("Prazno mesto. Izaberi lampu dole, pa dodirni ovde.")); return; } if (preview(s, tool, direct)) return; order(s, "install", tool, tool.cost); return; }
  if (tool && tool.f !== L.m.f) { if (preview(s, tool, direct)) return; order(s, "install", tool, tool.cost); return; }
  S.pending = null;
  if (L.state === "broken") { order(s, "repair", L.m, repairCost(L.m) + (L.life <= .05 ? bulbCost(L.m) : 0)); return; }
  const nb = tool || L.m;
  if (L.state === "burnt" || L.life < .95 || nb !== L.m) { order(s, "bulb", nb, bulbCost(nb)); return; }
  msg(Tx`${L.m.name} radi, ${Math.ceil(L.life * 100)}% veka. ${moodOf(s, L.m)[1]}`);
}
function tip(key, title, sub) { if (S.tips[key]) return; S.tips[key] = 1; banner(title, sub); }
function startPatrol() {
  if (S.phase !== "night") { msg(Tx("Patrola izlazi samo noću."), true); return; }
  if (S.patrol) { msg(Tx("Patrola je već na putu.")); return; }
  if (S.calm > 0) { msg(Tx`Kvart je već miran još ${Math.ceil(S.calm)} s.`); return; }
  if (S.money < PATROL.cost) { msg(Tx`Patrola košta ${PATROL.cost} $.`, true); return; }
  S.money -= PATROL.cost; S.led.buy += PATROL.cost; SFX.buy();
  const xs = [520, 100], ys = hs(); const path = MAP ? patrolPathMap() : [{x:520, y:90}];
  if (!MAP) ys.forEach((y, i) => { const a = xs[i % 2], b = xs[(i + 1) % 2]; path.push({x:a, y}, {x:b, y}); });
  if (!MAP) path.push({x:DEPOT.x, y:path[path.length - 1].y}, {x:DEPOT.x, y:DEPOT.y});
  S.patrol = {x:DEPOT.x, y:DEPOT.y, ang:-Math.PI / 2, path};
  tip("patrol", Tx("Patrola je krenula"), Tx("Vozilo obilazi sve ulice i tera huligane. Kad završi krug, kvart je miran 30 sekundi."));
  msg(Tx("Patrola obilazi kvart…"));
}
function placeReflector(p) {
  if (S.phase !== "night") { msg(Tx("Reflektori rade samo noću. Postavi ih kad padne mrak."), true); return; }
  if (p.y > boundY() - 6) { msg(Tx("To je stari kvart. Prvo ga kupi."), true); return; }
  if (refls.length >= REF.max) { msg(Tx`Najviše ${REF.max} reflektora odjednom. Ugase se u zoru.`, true); return; }
  if (S.money < REF.cost) { msg(Tx`Reflektor košta ${REF.cost} $.`, true); return; }
  S.money -= REF.cost; S.led.buy += REF.cost; refls.push({x:p.x, y:p.y, t:0});
  burst(p.x, p.y, "#d6f0ff", 12, 60); float(p.x, p.y - 14, Tx`Reflektor −${REF.cost} $`, "#d6f0ff");
  msg(Tx`Reflektor postavljen (${refls.length}/${REF.max}). Tera huligane do zore.`);
}
function scare(h, quiet) {
  if (h.state === "flee") return false;
  h.state = "flee"; h.fear = 0; h.fy = ENTRIES.reduce((a, e) => Math.abs(e - h.y) < Math.abs(a - h.y) ? e : a) + rnd(-6, 6);
  if (quiet) return true;
  S.scared++; misProg("scare");
  const G = S.gang;
  if (h.x >= TURF_X && h.x < W && h.y > 0 && h.y < boundY()) {
    const z = zones.find(z => Math.hypot(z.x - h.x, z.y - h.y) < 60);
    if (z) { z.hits++; z.until = S.night + 2; if (z.hits >= 3 && !z.perm) { z.perm = true; float(z.x, z.y - 22, Tx("Banda se odavde iselila!"), "#7ed39a", true); } }
    else { zones.push({x:Math.round(h.x), y:Math.round(h.y), r:70, until:S.night + 2, hits:1, perm:false}); float(h.x, h.y + 20, Tx("Zatvoreno za bandu"), "#7ed39a"); }
  }
  G.rage = Math.min(100, G.rage + 8 * G.presence / 60);
  G.presence = Math.max(0, G.presence - 2);
  checkGone();
  return true;
}
function checkGone() {
  const G = S.gang; if (G.gone || G.presence >= 8) return;
  G.gone = true; G.rage = 0; G.back = S.night + 3; for (const z of zones) z.perm = true;
  S.money += 100 * G.lv; S.led.bounty += 100 * G.lv;
  for (const h of hoods) scare(h, true);
  banner(Tx`${GANG_NAMES[(G.lv - 1) % GANG_NAMES.length]} su napustili kvart!`, Tx`Bonus +${100 * G.lv} $. Ali priča se da jača banda gleda vaš kvart. Spremi svetla!`);
}
function slotAt(p, rad) {
  let best = null, bd = rad;
  for (const s of slots) { const d = s.axis === "xy" || s.axis === "yd" ? Math.hypot(s.x - p.x, s.y - p.y) : Math.min(Math.hypot(s.x - p.x, s.y - p.y), Math.hypot(s.rx - p.x, s.ry - p.y) + 6); if (d < bd) { bd = d; best = s; } }
  return best;
}
function toWorld(e) { const c = scr2cv(e.clientX, e.clientY), pw = pbox().w; return unproj(c.u / cssW * pw / VZ + VX, c.v / cssW * pw / VZ + VY); }
const hitR = () => Math.max(22, 16 * W / cssW) / VZ;

cv.addEventListener("pointerdown", e => {
  e.preventDefault();
  const p = toWorld(e); if (e.pointerType === "mouse") S.hover = p;
  if (S.paused) return;
  const R = hitR();
  const th = thieves.slice().sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (th && dist(th, p) < R * 1.1) { catchThief(th, "tap"); flashes.push({x:th.x, y:th.y, t:0}); return; }
  const h = hoods.filter(h => h.state !== "flee").sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (h && dist(h, p) < R * 1.1) {
    if (S.flashCd > 0) { msg(Tx("Baterijska lampa se puni…")); return; }
    scare(h); S.flashCd = 1.5; S.money += 5; SFX.coin(); S.led.bounty += 5; flashes.push({x:h.x, y:h.y, t:0});
    recInc("hoods"); float(h.x, h.y - 14, Tx("Oteran! +5 $"), "#7ed39a", true); msg(Tx("Oterao si huligana baterijom! +5 $")); return;
  }
  if (S.tool === "ref") { placeReflector(p); return; }
  const pd = S.pending, tm = toolModel();
  if (tm) {   // a lamp is chosen: touching an empty spot grabs the lamp right away, so it follows the finger
    const hit = slotAt(p, R), pdNear = pd && !pd.lamp && !pd.job && Math.hypot(pd.x - p.x, pd.y - p.y) < R * 1.6;
    let near = hit && hit !== pd ? hit : pdNear ? pd : hit;
    if (!near) { const c = freeSpot(p); if (c) { if (pd && pd !== tmp && !pd.lamp && !pd.job) setSlotPos(pd, pd.bx, pd.by); near = useTmp(c); } }   // any free sidewalk spot
    if (!near) { if (pd && !pd.lamp && !pd.job) setSlotPos(pd, pd.bx, pd.by); S.pending = null; S.sel = null; msg(MAP ? Tx("Ovde ne može: to su kuće i dvorišta. Lampa ide samo pored ulice ili u park, i samo se oni broje u Svetlo %.") : Tx("Ovde ne može: lampa ide pored ulice ili u park, ne preblizu druge lampe."), true); return; }
    if (near && !near.lamp && !near.job && avail(near)) {
      const was = S.pending === near;
      if (!was) { if (pd && !pd.lamp && !pd.job) setSlotPos(pd, pd.bx, pd.by); S.sel = near; preview(near, tm, false); }
      drag = {s:near, p0:p, x0:near.x, y0:near.y, moved:false, was}; try { cv.setPointerCapture(e.pointerId); } catch (err) {} return;
    }
  }
  const s = slotAt(p, R); if (s) tapSlot(s, e.pointerType === "mouse"); else { S.pending = null; if (S.addon) { S.addon = null; msg(Tx("Dodatak otkazan.")); } }
});
let drag = null;
cv.addEventListener("pointermove", e => {
  if (drag) {
    const p = toWorld(e), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (!drag.moved && Math.hypot(dx, dy) > 12 * W / cssW / VZ) drag.moved = true;
    if (drag.moved) { moveSlot(drag.s, drag.x0 + dx, drag.y0 + dy); }
    return;
  }
  if (e.pointerType === "mouse") S.hover = toWorld(e);
});
const endDrag = () => {
  if (!drag) return; const d = drag; drag = null;
  if (!d.moved) { if (d.was) tapSlot(d.s, false); }
  else msg(Tx`Pomereno. Radar: +${coverGain(d.s, toolModel())}% svetla. Dodirni Postavi.`);
};
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", () => { drag = null; });
cv.addEventListener("pointerleave", () => { S.hover = null; });
cv.addEventListener("contextmenu", e => { e.preventDefault(); setTool(null); });

// ---------- UI ----------
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]);   // text from outside (town names from a search or a shared link) before it goes into innerHTML
const toolsEl = $("tools");
const shopClose = () => { if (document.body.classList.contains("shop-open")) setTimeout(() => setShop(false), 200); };
const grp = (cls, text) => { const d = document.createElement("div"); d.className = "grp " + cls; d.textContent = text; toolsEl.appendChild(d); };
grp("g1", Tx("Nova svetiljka"));
for (const F of Object.values(FIXTURES)) {
  const b = document.createElement("button"); b.type = "button"; b.className = "tool fx"; b.id = "tool-" + F.id; b.style.setProperty("--c", F.css);
  b.setAttribute("aria-pressed", "false");
  b.onclick = () => { if (palDone) { palDone = false; return; } setTool(S.tool === F.id ? null : F.id); shopClose(); };
  b.addEventListener("pointerdown", e => { if (document.body.classList.contains("shop-open")) return; pal = {f:F.id, x0:e.clientX, y0:e.clientY, moved:false, el:b}; try { b.setPointerCapture(e.pointerId); } catch (err) {} });
  toolsEl.appendChild(b);
}
grp("g2", Tx("Sijalica · samo zamena"));
const UI_ICO = {
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="#fbbf24" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="5" stroke="#fbbf24"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#fbbf24" stroke-linecap="round"/>',
};
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { r = Math.min(r || 0, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
const svgI = (inner, cls = "svg-ico") => Tx`<svg class="${cls}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${inner}</svg>`;
const SHOP_ICO = {
  crane: '<path d="M4 20h9M6 20V9l12-5v3" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 7v4" stroke="#94a3b8" stroke-width="1.6"/><rect x="15.5" y="11" width="5" height="4" rx="1" fill="#facc15"/><path d="M6 13l6-6M6 9l3 3" stroke="#facc15" stroke-width="1.4"/>',
  armor: '<path d="M2 8h13v9H2zM15 11h4l3 3v3h-7z" fill="#8b939e" stroke="#0b1120" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 11h3M10 11h3" stroke="#0b1120" stroke-width="1.6"/><circle cx="6" cy="18" r="2" fill="#0b1120" stroke="#fbbf24"/><circle cx="18" cy="18" r="2" fill="#0b1120" stroke="#fbbf24"/>',
  factory: '<path d="M2 21V11l6 3v-3l6 3V5h4v16z" fill="#64748b" stroke="#0b1120" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 17h2M10 17h2M15 17h2" stroke="#fde047" stroke-width="2"/><circle cx="16" cy="3" r="1.6" fill="#cbd5e1"/>',
  center: '<path d="M4 21h16" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><path d="M7 21v-8M17 21v-8" stroke="#94a3b8" stroke-width="2"/><rect x="5" y="9" width="4" height="4" rx="1" fill="#fbbf24"/><rect x="15" y="9" width="4" height="4" rx="1" fill="#fbbf24"/><ellipse cx="12" cy="18" rx="3.5" ry="1.8" fill="#38bdf8"/><path d="M12 16v-4" stroke="#7dd3fc" stroke-width="1.6"/>',
  heat: '<rect x="3" y="3" width="8" height="8" rx="1.5" fill="#ef4444"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="#facc15"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="#84cc16"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="#22c55e"/>',
  fixall: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 15v6M16 18h6" stroke="#34d399" stroke-width="2.2" stroke-linecap="round"/>',
  sensor: '<circle cx="12" cy="13" r="2.6" fill="#fbbf24"/><path d="M8 9.5a5 5 0 0 1 8 0M5.5 7a8.5 8.5 0 0 1 13 0" stroke="#34d399" stroke-width="2" stroke-linecap="round"/><path d="M12 15.6V21M9 21h6" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>',
  glass: '<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="rgba(56,189,248,0.22)" stroke="#38bdf8" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8l-2 4M14 7l-4 8" stroke="#e0f2fe" stroke-width="1.6" stroke-linecap="round"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#fbbf24"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  van: '<g stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h13v9H2z" fill="rgba(56,189,248,0.18)"/><path d="M15 10h4l3 3v3h-7v-6z" fill="rgba(56,189,248,0.28)"/><circle cx="6.5" cy="17.5" r="2" fill="#0f172a" stroke="#fbbf24"/><circle cx="18.5" cy="17.5" r="2" fill="#0f172a" stroke="#fbbf24"/></g>',
  sun: '<circle cx="12" cy="12" r="5" stroke="#fbbf24" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>',
  ups: '<rect x="6" y="4" width="12" height="17" rx="2" stroke="#34d399" stroke-width="1.8" fill="rgba(52,211,153,0.15)"/><path d="M10 2h4" stroke="#34d399" stroke-width="2" stroke-linecap="round"/><polygon points="13 7 9 13 12 13 11 18 15 11 12 11 13 7" fill="#fbbf24"/>',
  gen: '<rect x="3" y="7" width="18" height="12" rx="2" stroke="#94a3b8" stroke-width="1.8" fill="rgba(148,163,184,0.15)"/><polygon points="13 9 9 14 12 14 11 18 15 12 12 12 13 9" fill="#fbbf24"/><path d="M7 7V4M17 7V4" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>',
  plot: '<path d="M3 21V10l5-3 5 3v11M13 21V6l8-3v18M2 21h20" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="rgba(251,191,36,0.15)"/>',
  reflector: '<polygon points="4 6 20 6 16 15 8 15" fill="rgba(56,189,248,0.25)" stroke="#38bdf8" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10.5" r="2.2" fill="#e0f2fe"/><path d="M8 19h8M12 15v4" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>',
};
// Borko's icons for later features (fleet auto-dispatch, bank loan, city tender, reputation). Not used yet.
const TY_ICO = {
  dispatch: '<g stroke="#0b1120" stroke-width="1.6" stroke-linejoin="round"><rect x="7" y="7" width="10" height="15" rx="2.5" fill="#22d3ee"/><rect x="9.5" y="10" width="5" height="4" rx="1" fill="#0e7490"/><path d="M14 7V2.5" stroke-width="2.4" stroke-linecap="round"/><circle cx="9.8" cy="17.5" r="1" fill="#0b1120"/><circle cx="12" cy="17.5" r="1" fill="#0b1120"/><circle cx="14.2" cy="17.5" r="1" fill="#0b1120"/></g><polygon points="20 3 17 8 19 8 18 12 22 6.5 20 6.5 21 3" fill="#fbbf24" stroke="#0b1120" stroke-width="1"/><path d="M8.8 8.6h2.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>',
  bank: '<g stroke="#0b1120" stroke-width="1.6" stroke-linejoin="round"><path d="M5 9c0-3 3-5 7-5s7 2 7 5c2 2 3 5 3 8 0 3-3 5-10 5S2 20 2 17c0-3 1-6 3-8z" fill="#fbbf24"/><path d="M8 4.5l4 3 4-3" fill="#d97706"/></g><text x="12" y="19" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="10" fill="#7c2d12">$%</text><path d="M5.5 10.5q1-2 3-3" stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".85"/>',
  tender: '<g stroke="#0b1120" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5" width="16" height="14" rx="1.5" fill="#3b82f6"/><path d="M19 5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2" fill="#1d4ed8"/></g><path d="M6 9h9M6 12h6M6 15h7" stroke="#bfdbfe" stroke-width="1.3" stroke-linecap="round"/><circle cx="16" cy="16" r="3.6" fill="#ef4444" stroke="#0b1120" stroke-width="1.4"/><path d="M14.6 16l1 1 1.9-2" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M5 7h3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>',
  star: '<g stroke="#0b1120" stroke-width="1.6" stroke-linejoin="round"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#fbbf24"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none"/><path d="M12 13v4M8 21h8l-1-4H9z" fill="#d97706"/></g><polygon points="12 4.6 12.9 6.4 14.8 6.6 13.4 7.9 13.8 9.8 12 8.8 10.2 9.8 10.6 7.9 9.2 6.6 11.1 6.4" fill="#fff7cc"/><path d="M8.3 4.5v2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>',
};
const LATER_ICO = {
  dispatch: '<g stroke="#34d399" stroke-width="1.8"><circle cx="12" cy="12" r="9" fill="rgba(52,211,153,0.15)"/></g><polygon points="13 6 8 13 12 13 11 18 16 11 12 11 13 6" fill="#fbbf24"/>',
  bank: '<g stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 2 8 22 8" fill="rgba(251,191,36,0.22)"/><line x1="6" y1="8" x2="6" y2="17"/><line x1="10" y1="8" x2="10" y2="17"/><line x1="14" y1="8" x2="14" y2="17"/><line x1="18" y1="8" x2="18" y2="17"/><rect x="2" y="17" width="20" height="3" rx="1" fill="rgba(251,191,36,0.3)"/></g>',
  tender: '<g stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="rgba(56,189,248,0.15)"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></g>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(251,191,36,0.28)" stroke="#fbbf24" stroke-width="1.8" stroke-linejoin="round"/>',
};
const ICONS = {
  ul: '<svg viewBox="0 0 24 24"><circle cx="16" cy="6.5" r="5.5" fill="currentColor" opacity=".18"/><path d="M6 23V5q0-2 2-2h9" fill="none" stroke="#c9d2e3" stroke-width="1.8" stroke-linecap="round"/><rect x="12" y="2" width="8" height="3" rx="1.2" fill="#c9d2e3"/><rect x="13" y="5" width="6" height="1.6" rx=".8" fill="currentColor"/><path d="M4 23h4" stroke="#c9d2e3" stroke-width="2" stroke-linecap="round"/></svg>',
  kl: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="6" fill="currentColor" opacity=".2"/><path d="M12 23V11" stroke="#c9d2e3" stroke-width="2" stroke-linecap="round"/><path d="M8.5 4h7l-1 6h-5z" fill="currentColor" stroke="#c9d2e3" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 4l4-2.5L16 4" fill="none" stroke="#c9d2e3" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 23h6M10 15h4" stroke="#c9d2e3" stroke-width="1.6" stroke-linecap="round"/></svg>',
  fe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6" fill="currentColor" opacity=".2"/><path d="M12 23v-7" stroke="#c9d2e3" stroke-width="2" stroke-linecap="round"/><path d="M12 3v2" stroke="#c9d2e3" stroke-width="1.6" stroke-linecap="round"/><rect x="8.5" y="6" width="7" height="9" rx="1.5" fill="currentColor" stroke="#c9d2e3" stroke-width="1.4"/><path d="M12 6v9M8.5 10.5h7" stroke="#c9d2e3" stroke-width=".9" opacity=".7"/><path d="M7 5.5h10" stroke="#c9d2e3" stroke-width="1.8" stroke-linecap="round"/><path d="M8 23h8" stroke="#7ed39a" stroke-width="2" stroke-linecap="round"/></svg>',
  led: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 10a5 5 0 0 1 10 0v2H7v-2z" fill="rgba(52,211,153,0.28)" stroke="#34d399" stroke-width="1.8"/><rect x="8" y="12" width="8" height="5" rx="1" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/><path d="M10 17v3M14 17v3" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>',
  st: '<svg viewBox="0 0 24 24" fill="none"><rect x="8.5" y="15" width="7" height="4" rx="1" fill="#334155" stroke="#94a3b8" stroke-width="1.6"/><path d="M10 19v2h4v-2" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round"/><path d="M9 14c0-1.5 6-1.5 6-3s-6-1.5-6-3 6-1.5 6-3c0-1-1.5-1.5-3-1.5s-3 .5-3 1.5" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/></svg>',
  ob: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><path d="M12 3a6 6 0 0 0-4.2 10.3c.7.7 1.2 1.7 1.2 2.7h6c0-1 .5-2 1.2-2.7A6 6 0 0 0 12 3z" fill="rgba(251,191,36,0.2)" stroke="#fbbf24" stroke-width="1.8"/><path d="M10 11l1-2 1 2 1-2 1 2" stroke="#fef08a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ja: '<svg viewBox="0 0 24 24" fill="none"><rect x="7" y="4" width="10" height="13" rx="3" fill="rgba(253,224,71,0.22)" stroke="#fde047" stroke-width="1.8"/><line x1="12" y1="7" x2="12" y2="14" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><path d="M9 17v3M15 17v3" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>',
};
const BULB_SHORT = {led:Tx("LED čip"), st:Tx("Štedlj."), ob:Tx("Obična"), ja:Tx("Jaka")};
for (const B of Object.values(BULBS)) {
  const b = document.createElement("button"); b.type = "button"; b.className = "tool bl"; b.id = "tool-b-" + B.id; b.style.setProperty("--c", "var(--warn)");
  b.setAttribute("aria-pressed", "false");
  b.onclick = () => { pickBulb(B.id); shopClose(); };
  toolsEl.appendChild(b);
}
// drag and drop: pull a fixture from the bar onto the map
let pal = null, palDone = false, ghost = null;
function palSpot(p) {
  let best = null, bd = 30;
  for (const o of slots) {   // a marked spot or a lamp with another fixture (it gets replaced) right under the finger
    if (o === tmp || o.job || !avail(o) || (o.lamp && o.lamp.m.f.id === pal.f)) continue;
    const d = o.lamp ? Math.hypot(o.x - p.x, o.y - p.y) : Math.hypot(o.bx - p.x, o.by - p.y); if (d < bd) { bd = d; best = o; }
  }
  if (best) return best;
  const c = freeSpot(p); return c ? useTmp(c) : null;   // otherwise any free sidewalk spot
}
document.addEventListener("pointermove", e => {
  if (!pal) return;
  if (!pal.moved) {
    if (Math.hypot(e.clientX - pal.x0, e.clientY - pal.y0) < 12) return;
    pal.moved = true; setTool(pal.f);
    ghost = document.createElement("div"); ghost.className = "ghost-lamp"; ghost.style.setProperty("--c", FIXTURES[pal.f].css); document.body.appendChild(ghost);
  }
  ghost.style.left = e.clientX + "px"; ghost.style.top = (e.clientY - 34) + "px";   // a bit above the finger so it stays visible
  const cx = e.clientX, cy = e.clientY - 34, cc = scr2cv(cx, cy), r = cc.r;
  const pd = S.pending;
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) { if (pd && !pd.lamp && !pd.job) setSlotPos(pd, pd.bx, pd.by); S.pending = null; msg(Tx("Prevuci svetiljku na mapu, pored ulice ili u park.")); return; }
  const p = toWorld({clientX:cx, clientY:cy}), sp = palSpot(p);
  if (sp !== pd && pd && !pd.lamp && !pd.job) setSlotPos(pd, pd.bx, pd.by);
  if (!sp) { S.pending = null; msg(lanternTool() ? Tx("Ovde ne može. Fenjer ide pored ulice, u park ili u dvorište između zgrada, ne preblizu druge lampe.") : MAP ? Tx("Ovde ne može: to su kuće i dvorišta. Lampa ide samo pored ulice ili u park, i samo se oni broje u Svetlo %.") : Tx("Ovde ne može: lampa ide pored ulice ili u park, ne preblizu druge lampe."), true); return; }
  S.pending = sp; S.sel = sp; if (!sp.lamp && sp !== tmp) moveSlot(sp, p.x, p.y);
  const [mood, why] = moodOf(sp, toolModel()); msg(sp.lamp ? Tx`Pusti ovde: menjaš ${sp.lamp.m.f.name} za ${FIXTURES[pal.f].name}. ${why}` : Tx`Pusti ovde: +${coverGain(sp, toolModel())}% svetla. ${why}`, mood < 0);
});
const palEnd = e => {
  if (!pal) return; const was = pal; pal = null;
  if (!was.moved) return;
  palDone = true; setTimeout(() => { palDone = false; }, 60);
  if (ghost) { ghost.remove(); ghost = null; }
  if (e.type === "pointercancel") return;
  const s = S.pending;
  if (s && !s.job) { tapSlot(s, false); }
  else msg(Tx("Lampa nije postavljena. Pusti je pored ulice ili u parku."), true);
};
document.addEventListener("pointerup", palEnd); document.addEventListener("pointercancel", palEnd);
function refreshTools() {
  const B = BULBS[S.bulb];
  for (const F of Object.values(FIXTURES)) {
    const m = combo(F.id, S.bulb);
    $("tool-" + F.id).setAttribute("aria-label", `${F.name}, ${m.cost} $`); $("tool-" + F.id).title = F.name;
    $("tool-" + F.id).innerHTML = Tx`<span class="key">${F.key}</span><span class="ico">${ICONS[F.id]}</span>
      <span class="nm"><span class="long">${F.name}</span><span class="short">${F.short.replace(" LED", "")}</span></span><span class="pr">${m.cost} $</span>
      <span class="tg">${F.kind === "park" ? Tx("Park") : Tx("Ulica")} · ${F.tone}</span><span class="rbar"><i style="width:${Math.round(m.r / 180 * 100)}%"></i></span>
      <span class="st">${F.style} · svetiljka ${F.cost} $ + sijalica ${B.name} ${B.cost} $<br>Domet ${m.r} · struja ${m.power} · vek ${m.life}s · otpornost ${F.armor}×</span>`;
  }
  for (const b of Object.values(BULBS)) {
    const el = $("tool-b-" + b.id);
    el.innerHTML = Tx`<span class="tool-top"><span class="ico">${ICONS[b.id]}</span><span class="pct">${Math.round(b.rf * 100)}%</span></span><span class="nm"><span class="long">Sijalica ${b.name}</span><span class="short">${BULB_SHORT[b.id]}</span></span><span class="pr">${b.cost} $</span>
      <span class="tg">domet ${Math.round(b.rf * 100)}%</span><span class="rbar"><i style="width:${Math.round(b.rf / 1.2 * 100)}%"></i></span>
      <span class="st">Struja ${b.power} · vek ${b.life}s. Izaberi, pa dodirni lampu na mapi: menja se samo sijalica, stub ostaje. Nove svetiljke takođe dobijaju ovu sijalicu.</span>`;
    el.setAttribute("aria-label", Tx`Sijalica ${b.name}, ${b.cost} $, domet ${Math.round(b.rf * 100)}%`); el.title = Tx`Sijalica ${b.name}`;
    el.setAttribute("aria-pressed", String(S.tool === "bulb" && S.bulb === b.id));
    el.classList.toggle("cur", S.tool !== "bulb" && S.bulb === b.id);
  }
}
function pickBulb(id) {
  S.bulb = id;SFX.click(); if (S.tool !== "bulb") setTool("bulb");  else { refreshTools(); const B = BULBS[id]; msg(Tx`Menjaš samo sijalicu: ${B.name}. Dodirni lampu na mapi.`); }
  save();
}
function cycleBulb() { const ids = Object.keys(BULBS); pickBulb(ids[(ids.indexOf(S.bulb) + 1) % ids.length]); }
refreshTools();
function setTool(id) {
  if (id && id !== S.tool && id !== "bulb") SFX.click();
  if (S.pending && !S.pending.lamp && !S.pending.job) setSlotPos(S.pending, S.pending.bx, S.pending.by);
  S.tool = id; S.pending = null; S.sel = null; if (id) S.addon = null;
  for (const F of Object.values(FIXTURES)) $("tool-" + F.id).setAttribute("aria-pressed", String(id === F.id));
  $("btnRef").setAttribute("aria-pressed", String(id === "ref")); refreshTools();
  if (id === "ref") tip("ref", Tx("Kako radi reflektor"), Tx("Dodirni mesto na mapi gde dolaze huligani. Svetli odmah do zore i tera ih, ali ne broji se u osvetljenost. Košta 10 $, najviše 5."));
  if (id === "bulb") { const B = BULBS[S.bulb]; msg(Tx`Menjaš samo sijalicu: ${B.name}. Dodirni lampu na mapi. Stub ostaje isti.`); }
  else if (id === "ref") msg(S.phase === "night" ? Tx("Reflektor: dodirni mesto gde se skupljaju huligani.") : Tx("Reflektori rade samo noću."), S.phase !== "night");
  else if (id) { const m = toolModel(); msg(Tx`${m.f.name} sa sijalicom ${m.b.name} (${m.kind === "park" ? Tx("za park") : Tx("za ulicu")}, ${m.tone} svetlo). Dodirni mesto na mapi.`); }
  else msg(Tx("Bez alata: dodir na lampu = info ili popravka."));
}
$("btnRef").onclick = () => setTool(S.tool === "ref" ? null : "ref");
const nudge = (dx, dy) => { const s = S.pending; if (!s || s.lamp) return; if (!moveSlot(s, s.x + dx, s.y + dy)) msg(Tx("Dalje ne može: kraj ulice, raskrsnica ili druga lampa."), true); };
$("mvL").onclick = () => nudge(-5, 0); $("mvR").onclick = () => nudge(5, 0); $("mvU").onclick = () => nudge(0, -5); $("mvD").onclick = () => nudge(0, 5);
$("btnPlace").onclick = () => { if (S.pending) tapSlot(S.pending, false); };
$("btnCancel").onclick = () => { if (S.pending && !S.pending.lamp && !S.pending.job) setSlotPos(S.pending, S.pending.bx, S.pending.by); S.pending = null; msg(Tx("Otkazano.")); };
$("btnHint").onclick = () => {
  const m = toolModel(); if (!m) return;
  const b = bestSpot(m);
  if (!b) { msg(Tx("Nema slobodnog mesta za ovu lampu."), true); return; }
  if (S.pending && S.pending !== b.s && !S.pending.lamp) setSlotPos(S.pending, S.pending.bx, S.pending.by);
  setSlotPos(b.s, b.x, b.y); S.pending = b.s; S.sel = b.s;
  const [mood, why] = moodOf(b.s, m);
  msg(Tx`Savet: ovde ${m.name} daje +${coverGain(b.s, m)}% svetla. ${why}`, mood < 0);
};
$("btnNoTool").onclick = () => setTool(null);
$("upGen").onclick = () => { const c = GEN_COST[S.genLv]; if (c && S.money >= c) { S.money -= c; S.led.buy += c; S.genLv++; S.genHp = 1; msg(Tx`Novi generator nivo ${S.genLv + 1}: kapacitet ${GEN_CAP[S.genLv]}, ispravnost 100%.`); save(); } };
const genFixCost = () => S.genHp >= .995 ? null : Math.ceil((1 - S.genHp) * 90 * (S.phase === "day" ? .5 : 1));
$("upGenFix").onclick = () => { const c = genFixCost(); if (c != null && S.money >= c) { S.money -= c; S.led.buy += c; S.genHp = 1; msg(Tx("Generator je servisiran: 100% ispravan.")); float(29 + GOFF.x, 140 + GOFF.y, Tx("Generator 100%"), "#7ed39a", true); save(); } };
$("upVan").onclick = () => { const c = VAN_COST[vans.length - 1]; if (c && S.money >= c) { S.money -= c; S.led.buy += c; addVan(); msg(Tx`Novo servisno vozilo. Sada ih imaš ${vans.length}.`); save(); } };
$("upSpeed").onclick = () => { const c = SPEED_COST[S.speedLv]; if (c && S.money >= c) { S.money -= c; S.led.buy += c; S.speedLv++; msg(Tx("Majstori su brži i bolje opremljeni.")); save(); } };
$("upPatrol").onclick = () => startPatrol();
$("upFixAll").onclick = () => fixAll();
$("upCrane").onclick = () => { if (!S.crane && S.money >= CRANE_COST) { S.money -= CRANE_COST; S.led.buy += CRANE_COST; S.crane = true; SFX.buy(); msg(Tx("Dizalica sa korpom: ulični stubovi se montiraju duplo brže.")); save(); } };
$("upArmor").onclick = () => { if (!S.armor && S.money >= ARMOR_COST) { S.money -= ARMOR_COST; S.led.buy += ARMOR_COST; S.armor = true; SFX.buy(); msg(Tx("Oklopni kombi: majstori rade i dok huligani bacaju kamenice.")); save(); } };
for (const k in ZONES2) $(k === "ind" ? "upInd" : "upCen").onclick = () => { const z = ZONES2[k]; if (!S[z.key] && S.money >= z.cost) { S.money -= z.cost; S.led.buy += z.cost; S[z.key] = true; SFX.buy(); drawBg(); coverKey = "";
  banner(Tx`Kupio si: ${z.name}!`, k === "ind" ? Tx("Fabrike plaćaju 60% više, ali vole jaku, modernu LED rasvetu (Ulična LED).") : Tx("Šetalište donosi 40% više, a voli toplo, dekorativno svetlo: fenjere i klasične stubove.")); save(); } };
$("upHeat").onclick = () => { S.heat = !S.heat; SFX.click(); if (S.heat) setShop(false); save(); };
$("upSensor").onclick = () => armAddon("sensor");
$("upGlass").onclick = () => armAddon("glass");
$("dawnOk").onclick = () => { $("dawn").hidden = true; };
$("upTrafo").onclick = () => { const c = TRAFO_COST[S.trafo || 0]; if (S.genLv >= 3 && c && S.money >= c) { S.money -= c; S.led.buy += c; S.trafo = (S.trafo || 0) + 1; SFX.buy(); msg(Tx`Nova trafostanica: kapacitet je sada ${genCap()}.`); save(); } };
$("upSolar").onclick = () => { if (S.unlocked && !S.solar && S.money >= SOLAR_COST) { S.money -= SOLAR_COST; S.led.buy += SOLAR_COST; S.solar = true; SFX.buy(); msg(Tx`Solarni paneli: kapacitet ${genCap()}, struja 30% jeftinija.`); save(); } };
$("upUps").onclick = () => { if (!S.ups && S.money >= UPS_COST) { S.money -= UPS_COST; S.led.buy += UPS_COST; S.ups = true; S.upsCharge = UPS_SEC; SFX.buy(); msg(Tx`UPS baterija: kad generator stane, svetla rade još ${UPS_SEC} sekundi.`); save(); } };
$("upDispatch").onclick = () => { if (S.dispatch) { S.dispOff = !S.dispOff; SFX.click(); msg(S.dispOff ? Tx("Auto-dispečing je ISKLJUČEN: štediš novac, lampe popravljaš sam.") : Tx("Auto-dispečing je UKLJUČEN: servis sam ide na kvarove.")); save(); return; }
  if (!S.dispatch && S.money >= DISPATCH_COST) { S.money -= DISPATCH_COST; S.led.buy += DISPATCH_COST; S.dispatch = true; SFX.buy(); msg(Tx("Auto-dispečing je uključen: servis sam ide na razbijene i izgorele lampe.")); save(); } };
$("upLoan").onclick = () => { if (S.loan <= 0) { S.money += LOAN_AMOUNT; S.loan = LOAN_BACK; SFX.coin(); msg(Tx`Banka ti je dala ${LOAN_AMOUNT} $. Svake zore ide rata od ${LOAN_RATE} $ dok ne vratiš ${LOAN_BACK} $.`); save(); } };
$("upPlot").onclick = () => { if (MAP) { autoQuarter(); return; } if (!S.unlocked && S.money >= PLOT_COST) { S.money -= PLOT_COST; S.led.buy += PLOT_COST; S.unlocked = true; if (S.goal === 1) S.goal = 2; banner(Tx("Kupio si stari kvart!"), Tx`Ovde vole klasično, toplo svetlo. Uz plac dobijaš i mali generator: +${PLOT_GEN} struje.`); save(); } };

const ov = $("ov");
function setPauseLabel() { $("btnPause").textContent = S.paused && S.started ? Tx("Dalje") : Tx("Pauza"); }
function begin() { MUSIC.start(); if (MAP) { const m = meta(); if (!m.started.includes(MAP.id)) { m.started.push(MAP.id); metaSave(m); } } refreshTools(); ov.hidden = true; S.paused = false; S.started = true; setPauseLabel(); }
let saved = readSave();
if (saved && saved.S) { $("btnStart").textContent = Tx`Nastavi igru (${saved.S.phase === "day" ? "dan" : "noć"} ${saved.S.night || 1})`; $("btnNew2").hidden = false; }
$("btnStart").onclick = () => {
  if (!S.started && saved) { let ok = false; try { ok = load(saved); } catch (e) {} saved = null;
    if (ok) msg(Tx("Nastavljaš gde si stao.")); else { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} resetGame(); msg(Tx("Stara sačuvana igra je bila oštećena, pa kreće nova igra."), true); } }
  else if (!S.started) { msg(MAP ? Tx`${partName(MAP.part)}, kvart ${qNum(MAP)}: ${MAP.streets.slice(0, 2).join(", ")}. ${DIST0 === "stari" ? Tx("Stari kvart sa kućama: voli klasično, toplo svetlo.") : Tx("Kvart sa zgradama: voli modernu LED rasvetu.")}` : Tx("Izaberi lampu i dodirni prazno mesto. Razbijene lampe popravi dodirom.")); if (MAP) takeBank(); setTimeout(tutStart, 500); }
  begin();
};
// ---------- Map choice on the start card: the invented quarter or real Borča quarters ----------
const QCW = 66, QCH = 107;
const partName = k => (BQ.parts.find(p => p[0] === k) || [k, k])[1];
if (MAP && MAP.part === "my" && $("introP")) $("introP").textContent = Tx`Nasledio si kvart u mestu ${partName("my").split(",")[0]}. Generator zuji, a lampe su skoro sve ugašene. Stanari plaćaju kad im je noću svetlo i kad im se lampe sviđaju.`;   // own town: the story starts there, not in Borča
if (MAP && MAP.part === "my") { const sm = document.querySelector(".logo small"); if (sm) { sm.textContent = partName("my").split(",")[0]; sm.style.cssText = "max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block"; } }   // own town: its name under the logo
const qNum = q => BQ.q.filter(x => x.part === q.part).indexOf(q) + 1;
let QPART = MAP ? MAP.part : "c2";
function drawParts() {
  const el = $("qparts"); el.innerHTML = "";
  for (const [k, n] of BQ.parts) { const b = document.createElement("button"); b.type = "button"; b.textContent = n; b.setAttribute("aria-pressed", String(k === QPART)); b.onclick = () => { QPART = k; drawQ(); }; el.appendChild(b); }
}
function qGrid() { const qs = BQ.q.filter(q => q.part === QPART), gx0 = Math.min(...qs.map(q => q.gx)), gy0 = Math.min(...qs.map(q => q.gy)); return {qs, gx0, gy0, nx:Math.max(...qs.map(q => q.gx)) - gx0 + 1, ny:Math.max(...qs.map(q => q.gy)) - gy0 + 1}; }
function drawQ() {
  drawParts();
  const G = qGrid(), c = $("qmap"), dpr = 2; c.width = G.nx * QCW * dpr; c.height = G.ny * QCH * dpr; c.style.maxWidth = Math.min(300, G.nx * 62) + "px"; const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#0e1320"; g.fillRect(0, 0, G.nx * QCW, G.ny * QCH);
  const m = meta(), k = (QCW - 4) / W;
  for (const q of G.qs) {
    const x = (q.gx - G.gx0) * QCW + 2, y = (q.gy - G.gy0) * QCH + 2, av = qAvail(q.id, m), au = !!m.auto[q.id], cur = MAP && MAP.id === q.id;
    g.save(); g.beginPath(); g.rect(x, y, QCW - 4, QCH - 4); g.clip(); g.fillStyle = "#17211b"; g.fillRect(x, y, QCW - 4, QCH - 4);
    g.translate(x, y); g.scale(k, k); g.strokeStyle = "#59606f"; g.lineCap = "round";
    for (const [cl, , ids] of q.roads) { g.lineWidth = STW[cl] * 1.3; g.beginPath(); ids.forEach((i, n) => n ? g.lineTo(q.nodes[2 * i], q.nodes[2 * i + 1]) : g.moveTo(q.nodes[2 * i], q.nodes[2 * i + 1])); g.stroke(); }
    g.restore();
    g.fillStyle = au ? "rgba(52,160,90,.35)" : av ? "rgba(241,196,83,.10)" : "rgba(4,6,12,.72)"; g.fillRect(x, y, QCW - 4, QCH - 4);
    g.strokeStyle = cur ? "#f1c453" : au ? "#7ed39a" : av ? "rgba(241,196,83,.75)" : "rgba(120,130,150,.35)"; g.lineWidth = cur ? 3 : 1.5; g.setLineDash(av && !au && !cur ? [4, 3] : []); g.strokeRect(x + 1, y + 1, QCW - 6, QCH - 6); g.setLineDash([]);
    g.textAlign = "center"; g.fillStyle = "rgba(8,10,20,.8)"; g.fillRect(x + 6, y + QCH / 2 - 20, QCW - 16, 36);
    g.font = "800 16px Barlow Condensed, sans-serif"; g.fillStyle = av || au ? "#fff" : "#8f98ae"; g.fillText(String(qNum(q)), x + QCW / 2 - 2, y + QCH / 2 - 4);
    g.font = "700 9px Barlow, sans-serif"; g.fillStyle = au ? "#9fe0b3" : cur ? "#f1c453" : av ? "#ece6d6" : "#8f98ae"; g.fillText(au ? Tx("RADI SAM") : cur ? Tx("OVDE SI") : av ? "SLOBODAN" : Tx("ZAKLJUČAN"), x + QCW / 2 - 2, y + QCH / 2 + 10);
    g.font = "600 8px Barlow, sans-serif"; g.fillStyle = "#c9cfdb"; g.fillText(qStyle(q) === "stari" ? Tx("kuće · toplo") : Tx("zgrade · LED"), x + QCW / 2 - 2, y + QCH - 10);
    if (q.lm && q.lm.length) { g.fillStyle = "#f1c453"; g.font = "700 9px Barlow, sans-serif"; g.fillText("★ " + q.lm.length, x + 12, y + 12); }
  }
  const na = Object.keys(m.auto).length;
  $("qinfo").textContent = (na ? Tx`Automatizovano ${na} od ${BQ.q.length} kvartova. Donose +${Object.values(m.auto).reduce((a, b) => a + b, 0)} $ svake zore. ` : "") + Tx`${partName(QPART)}: ${G.qs.length} kvartova sa pravim ulicama. ★ = prava mesta (škola, crkva, pijaca...). ` + (G.qs.some(q => m.started.includes(q.id) || m.auto[q.id]) ? Tx("Kad osvetliš 90% ulica, automatizuj kvart i otvaraju se susedni.") : Tx("Dodirni kvart odakle krećeš."));
}
// ---------- Your own town: turn OpenStreetMap data (Overpass JSON, "out geom") into playable quarters, like Borča ----------
const CITY = (() => {
  const QW = 620, QH = 1000, KQ = 3, STW_ = [16, 34, 38, 44], NX = 3, NY = 3, PAD = 70;
  const ROADC = {trunk:3, primary:3, primary_link:2, secondary:3, secondary_link:2, tertiary:2, tertiary_link:2, residential:1, unclassified:1, living_street:1, service:0};
  const TY = {school:"skola", place_of_worship:"crkva", marketplace:"pijaca", library:"biblioteka", kindergarten:"vrtic", clinic:"dom zdravlja", doctors:"dom zdravlja", police:"policija"};
  const DEF = {skola:"Škola", crkva:"Crkva", pijaca:"Pijaca", biblioteka:"Biblioteka", vrtic:"Vrtić", "dom zdravlja":"Dom zdravlja", policija:"Policija"};
  const CYR = "абвгдђежзијклљмнњопрстћуфхцчџшАБВГДЂЕЖЗИЈКЛЉМНЊОПРСТЋУФХЦЧЏШ", LAT = "a b v g d đ e ž z i j k l lj m n nj o p r s t ć u f h c č dž š A B V G D Đ E Ž Z I J K L Lj M N Nj O P R S T Ć U F H C Č Dž Š".split(" ");
  const lat_ = s => [...(s || "")].map(ch => { const i = CYR.indexOf(ch); return i < 0 ? ch : LAT[i]; }).join("").replace(/[„”"]/g, "");
  const hyp = Math.hypot, dist2 = (p, q) => hyp(p[0] - q[0], p[1] - q[1]);
  function bbox(lat, lon) {   // the area the game asks for: 3×3 quarters around the point, plus a margin
    const K = Math.cos(lat * Math.PI / 180) * 111320, hw = (NX * QW / KQ / 2 + PAD), hh = (NY * QH / KQ / 2 + PAD);
    return [lat - hh / 110540, lon - hw / K, lat + hh / 110540, lon + hw / K];
  }
  function query(lat, lon) {
    const b = bbox(lat, lon).map(v => v.toFixed(6)).join(",");
    return `[out:json][timeout:40];(way["highway"](${b});way["building"](${b});way["leisure"~"^(park|pitch|playground|garden)$"](${b});way["landuse"~"^(grass|meadow|park|cemetery|recreation_ground|village_green)$"](${b});way["natural"="water"](${b});way["waterway"](${b});node["amenity"~"^(school|place_of_worship|marketplace|library|kindergarten|clinic|doctors|police)$"](${b});way["amenity"~"^(school|place_of_worship|marketplace|library|kindergarten|clinic|doctors|police)$"](${b}););out geom;`;
  }
  function inPoly(x, y, P) { let r = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r; } return r; }
  function dseg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return [hyp(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t]; }
  function rectD(r, a, b) { const [x, y, w, h] = r, n = Math.max(1, Math.floor(dist2(a, b) / 5)); let best = 1e9; for (let k = 0; k <= n; k++) { const px = a[0] + (b[0] - a[0]) * k / n, py = a[1] + (b[1] - a[1]) * k / n, dx = Math.max(x - px, 0, px - (x + w)), dy = Math.max(y - py, 0, py - (y + h)); best = Math.min(best, hyp(dx, dy)); } return best; }
  const pbox = f => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < f.length; i += 2) { x0 = Math.min(x0, f[i]); x1 = Math.max(x1, f[i]); y0 = Math.min(y0, f[i + 1]); y1 = Math.max(y1, f[i + 1]); } return [x0, y0, x1, y1]; };
  const overlap = (r, f, m = 4) => { const [x0, y0, x1, y1] = pbox(f); return !(x1 < r[0] - m || x0 > r[0] + r[2] + m || y1 < r[1] - m || y0 > r[1] + r[3] + m); };
  const areaF = f => { let a = 0; const n = f.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += f[2 * i] * f[2 * j + 1] - f[2 * j] * f[2 * i + 1]; } return Math.abs(a) / 2; };
  let seed = 1; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function build(els, lat0, lon0, idBase, gxBase) {
    const K = Math.cos(lat0 * Math.PI / 180) * 111320, P = (lat, lon) => [Math.round((lon - lon0) * K), Math.round((lat0 - lat) * 110540)];
    const NODE = new Map(), roads = [], foot = [], bldg = [], green = [], water = [], lms = [];
    for (const e of els) if (e.type === "way" && e.geometry && e.nodes) e.nodes.forEach((id, i) => { const g = e.geometry[i]; if (g) NODE.set(id, P(g.lat, g.lon)); });
    for (const e of els) {
      const t = e.tags || {};
      if (t.amenity && TY[t.amenity]) { const pts = e.type === "node" ? [P(e.lat, e.lon)] : (e.geometry || []).filter(Boolean).map(g => P(g.lat, g.lon)); if (pts.length) { const ty = TY[t.amenity]; lms.push([ty, lat_(t.name) || DEF[ty], pts]); } }
      if (e.type !== "way" || !e.geometry || e.geometry.length < 2) continue;
      const pts = e.geometry.filter(Boolean).map(g => P(g.lat, g.lon)), h = t.highway;
      if (h in ROADC) { if (h === "service" && (t.service === "parking_aisle" || t.service === "driveway")) continue; roads.push([ROADC[h], lat_(t.name || ""), e.nodes.filter(id => NODE.has(id))]); }
      else if (h === "footway" || h === "path" || h === "pedestrian") foot.push(pts);
      else if (t.building) {
        let p = pts; if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p = p.slice(0, -1);
        const out = [p[0]]; for (const q of p.slice(1)) if (Math.abs(q[0] - out[out.length - 1][0]) + Math.abs(q[1] - out[out.length - 1][1]) >= 2) out.push(q);
        if (out.length >= 3) { const ar = areaF(out.flat()); const kind = ["school", "kindergarten", "townhall", "library", "place_of_worship", "post_office"].includes(t.amenity) || ["school", "church", "public", "commercial", "retail", "apartments"].includes(t.building) || +t["building:levels"] >= 4 ? 2 : (["garage", "garages", "shed", "roof", "hut"].includes(t.building) || ar < 35 ? 0 : 1); bldg.push([kind, out]); }
      }
      else if (["park", "pitch", "playground", "garden"].includes(t.leisure) || ["grass", "meadow", "park", "cemetery", "recreation_ground", "village_green"].includes(t.landuse)) green.push([t.leisure === "pitch" ? 1 : 0, pts]);
      else if (t.waterway || t.natural === "water") water.push(pts);
    }
    const ww = QW / KQ, wh = QH / KQ, ox = -NX * ww / 2, oy = -NY * wh / 2, OUT = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x0 = ox + i * ww, y0 = oy + j * wh, L = p => [Math.round((p[0] - x0) * KQ * 10) / 10, Math.round((p[1] - y0) * KQ * 10) / 10];
      const M = 140, inwin = (p, m = M) => p[0] >= -m && p[0] <= QW + m && p[1] >= -m && p[1] <= QH + m;
      const used = new Map(), NO = [], ni = k => { if (!used.has(k)) { used.set(k, NO.length); NO.push(L(NODE.get(k))); } return used.get(k); };
      const R = [], names = new Map();
      for (const [cl, name, ids] of roads) {
        let seg = [], prev = null;
        for (const k of ids) {
          if (inwin(L(NODE.get(k)))) { if (!seg.length && prev !== null) seg.push(prev); seg.push(k); }
          else if (seg.length) { seg.push(k); if (seg.length >= 2) R.push([cl, name, seg.map(ni)]); seg = []; }
          prev = k;
        }
        if (seg.length >= 2) R.push([cl, name, seg.map(ni)]);
      }
      let inner = 0;
      for (const [cl, name, ids] of R) for (let n = 1; n < ids.length; n++) { const p = NO[ids[n - 1]], q = NO[ids[n]], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (mx >= 0 && mx <= QW && my >= 0 && my <= QH && cl >= 1) { inner += dist2(p, q); if (name) names.set(name, (names.get(name) || 0) + dist2(p, q)); } }
      if (inner < 2200) continue;   // too few streets for a game
      const segs = []; for (const [cl, , ids] of R) for (let n = 1; n < ids.length; n++) segs.push([NO[ids[n - 1]], NO[ids[n]], STW_[cl] / 2 + 3, cl]);
      const clash = pts => {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), bx0 = Math.min(...xs) - 30, bx1 = Math.max(...xs) + 30, by0 = Math.min(...ys) - 30, by1 = Math.max(...ys) + 30;
        const near = segs.filter(s => !(Math.max(s[0][0], s[1][0]) < bx0 || Math.min(s[0][0], s[1][0]) > bx1 || Math.max(s[0][1], s[1][1]) < by0 || Math.min(s[0][1], s[1][1]) > by1));
        if (!near.length) return false;
        const samp = []; for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length], n = Math.max(1, Math.floor(dist2(p, q) / 4)); for (let t = 0; t < n; t++) samp.push([p[0] + (q[0] - p[0]) * t / n, p[1] + (q[1] - p[1]) * t / n]); }
        for (const [a, b, w] of near) { for (const p of samp) if (dseg(p, a, b)[0] < w) return true; const n = Math.max(1, Math.floor(dist2(a, b) / 6)); for (let t = 0; t <= n; t++) if (inPoly(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n, pts)) return true; }
        return false;
      };
      let bl = [];
      for (const [kind, pts0] of bldg) {
        const pts = pts0.map(L), gx = pts.reduce((a, p) => a + p[0], 0) / pts.length, gy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        if (!inwin([gx, gy], 30)) continue;
        for (const f of [1, .85, .72, .6]) { const q = pts.map(p => [Math.round((gx + (p[0] - gx) * f) * 10) / 10, Math.round((gy + (p[1] - gy) * f) * 10) / 10]); if (!clash(q)) { bl.push([kind, q.flat()]); break; } }
      }
      const gr = green.map(([t, p]) => [t, p.map(L)]).filter(([, p]) => p.some(q => inwin(q, 20))).map(([t, p]) => [t, p.flat()]);
      const wa = water.map(p => p.map(L)).filter(p => p.some(q => inwin(q))).map(p => p.flat());
      const fo = foot.map(p => p.map(L)).filter(p => p.some(q => inwin(q))).map(p => p.flat());
      const lm = [];
      for (const [typ, name, p0] of lms) { const pts = p0.map(L), gx = Math.round(pts.reduce((a, p) => a + p[0], 0) / pts.length), gy = Math.round(pts.reduce((a, p) => a + p[1], 0) / pts.length); if (gx > 30 && gx < QW - 30 && gy > 60 && gy < QH - 40 && !lm.some(l => l[1] === name)) lm.push([typ, name, gx, gy, pts.length > 2 ? pts.flat() : []]); }
      // depot, generator, kiosk, bus stop, parked cars (same rules as Borča)
      const main = segs.filter(s => s[3] >= 1);
      if (!main.length) continue;
      const lmr = lm.map(l => { const f = l[4].length ? l[4] : [l[2] - 15, l[3] - 15, l[2] + 15, l[3] + 15]; const [a, b, c, d] = pbox(f); return [a, b, c - a, d - b]; });
      const place = (w, h, prefer, avoid) => {
        let best = null;
        for (let x = 12; x < QW - w - 12; x += 8) for (let y = 70; y < QH - h - 60; y += 8) {
          const r = [x, y, w, h];
          if (segs.some(([a, b, , cl]) => !(Math.max(a[0], b[0]) < x - 40 || Math.min(a[0], b[0]) > x + w + 40 || Math.max(a[1], b[1]) < y - 40 || Math.min(a[1], b[1]) > y + h + 40) && rectD(r, a, b) < STW_[cl] / 2 + 4)) continue;
          if (avoid.some(o => !(x + w < o[0] - 8 || x > o[0] + o[2] + 8 || y + h < o[1] - 8 || y > o[1] + o[3] + 8))) continue;
          let road = 1e9; for (const [a, b, , cl] of main) road = Math.min(road, rectD(r, a, b) - STW_[cl] / 2); if (road > 26) continue;
          let cover = 0; for (const [, f] of bl) if (overlap(r, f)) cover += areaF(f);
          const sc = cover / 400 + road / 4 + hyp(x + w / 2 - prefer[0], y + h / 2 - prefer[1]) / 60;
          if (!best || sc < best[0]) best = [sc, r];
        }
        return best && best[1];
      };
      const dep = place(66, 112, [QW - 60, 160], lmr); if (!dep) continue;
      const gen = place(50, 112, [60, 160], [dep, ...lmr]); if (!gen) continue;
      const c = [dep[0] + dep[2] / 2, dep[1] + dep[3] / 2]; let bp = null;
      for (const [a, b] of main) { const [d, t] = dseg(c, a, b); if (!bp || d < bp[0]) bp = [d, [Math.round((a[0] + (b[0] - a[0]) * t) * 10) / 10, Math.round((a[1] + (b[1] - a[1]) * t) * 10) / 10], Math.atan2(b[1] - a[1], b[0] - a[0])]; }
      const sideSpot = (cands, avoid) => {
        for (const [a, b, , cl] of cands) {
          const Ln = dist2(a, b); if (Ln < 60) continue; const ux = (b[0] - a[0]) / Ln, uy = (b[1] - a[1]) / Ln;
          for (const t of [.5, .35, .65, .2, .8]) for (const sd of [1, -1]) {
            const off = STW_[cl] / 2 + 22, x = a[0] + ux * Ln * t - uy * off * sd, y = a[1] + uy * Ln * t + ux * off * sd;
            if (!(x > 40 && x < QW - 40 && y > 90 && y < QH - 60)) continue;
            const r = [x - 13, y - 11, 26, 22];
            if (segs.some(([a2, b2, , c2]) => rectD(r, a2, b2) < STW_[c2] / 2 + 1)) continue;
            if (avoid.some(o => hyp(x - o[0], y - o[1]) < 120)) continue;
            if ([dep, gen, ...lmr].some(o => !(r[0] + r[2] < o[0] || r[0] > o[0] + o[2] || r[1] + r[3] < o[1] || r[1] > o[1] + o[3]))) continue;
            return [Math.round(x), Math.round(y)];
          }
        }
        return null;
      };
      const bus = sideSpot(main.slice().sort((s, t) => (t[3] - s[3]) || (dist2(t[0], t[1]) - dist2(s[0], s[1]))), []);
      const kiosk = sideSpot(main.slice().sort((s, t) => hyp((s[0][0] + s[1][0]) / 2 - QW / 2, (s[0][1] + s[1][1]) / 2 - QH * .4) - hyp((t[0][0] + t[1][0]) / 2 - QW / 2, (t[0][1] + t[1][1]) / 2 - QH * .4)), bus ? [bus] : []);
      seed = 7 + i * 31 + j * 17;
      const cars = [], cols = ["#8a2f2f", "#2f5a8a", "#c9c9c9", "#3d7a4a", "#b88a2f", "#5a3d7a"], cand = main.filter(s => s[3] === 1 && dist2(s[0], s[1]) > 70).sort(() => rand() - .5);
      for (const [a, b, , cl] of cand) {
        if (cars.length >= 6) break;
        const Ln = dist2(a, b), ux = (b[0] - a[0]) / Ln, uy = (b[1] - a[1]) / Ln, t = .3 + rand() * .4, sd = rand() < .5 ? 1 : -1, off = STW_[cl] / 2 - 7, x = a[0] + ux * Ln * t - uy * off * sd, y = a[1] + uy * Ln * t + ux * off * sd;
        if (!(x > 30 && x < QW - 30 && y > 90 && y < QH - 40) || cars.some(c2 => hyp(x - c2[0], y - c2[1]) < 90)) continue;
        cars.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(Math.atan2(uy, ux) * 1000) / 1000, cols[cars.length]]);
      }
      const clear = [dep, gen, ...[kiosk, bus].filter(Boolean).map(s => [s[0] - 18, s[1] - 16, 36, 30])];
      bl = bl.filter(b => !clear.some(r => overlap(r, b[1], 5)));
      const top = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
      OUT.push({id:idBase + OUT.length, gx:gxBase + i, gy:j, part:"my", lm, name:`Kvart ${OUT.length + 1}`, streets:top.length ? top : ["ulice bez imena"], nodes:NO.flat(), roads:R, bldg:bl, green:gr, water:wa, foot:fo, border:[], depot:dep, gen, depotPt:bp[1], depotAng:Math.round(bp[2] * 1000) / 1000, spots:[kiosk, bus], cars});
    }
    return OUT;
  }
  return {query, build, bbox};
})();

// ---------- Records: a few numbers that follow the player across games and towns ----------
const REC_KEY = "lightThemUp.records";
function recs() { try { return Object.assign({nights:0, thieves:0, hoods:0, rep:0, cover:0, auto:0, cities:[]}, JSON.parse(localStorage.getItem(REC_KEY) || "{}")); } catch (e) { return {nights:0, thieves:0, hoods:0, rep:0, cover:0, auto:0, cities:[]}; } }
function recSet(fn) { const r = recs(); fn(r); try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) {} }
const recInc = k => recSet(r => { r[k] = (r[k] || 0) + 1; });
function RECS_ADD_CITY(n) { recSet(r => { r.cities = [n, ...r.cities.filter(x => x !== n)].slice(0, 12); }); }
function recShow() {
  const r = recs(), box = $("recs"); if (!box) return; box.hidden = !(r.nights || r.thieves || r.hoods);
  box.innerHTML = Tx`<b>Rekordi</b><div class="rec-g"><span><em>${r.nights}</em>noći</span><span><em>${r.cover}%</em>najviše svetla</span><span><em>${r.rep}</em>najveći ugled</span><span><em>${r.thieves}</em>uhvaćenih lopova</span><span><em>${r.hoods}</em>oteranih huligana</span><span><em>${r.auto}</em>automatizovanih kvartova</span></div>`
    + (r.cities.length ? Tx`<p class="qinfo">Gradovi: ${r.cities.map(esc).join(", ")}</p>` : "");
}
// downloaded towns are kept in IndexedDB (hundreds of MB, not the ~5 MB of localStorage), so going back to one needs no new download
const CDB = (() => {
  let dbp = null; const db = () => dbp || (dbp = new Promise((ok, no) => { try { const r = indexedDB.open("lightThemUp", 1); r.onupgradeneeded = () => r.result.createObjectStore("cities", {keyPath:"key"}); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }));
  const tx = (mode, fn) => db().then(d => new Promise((ok, no) => { const t = d.transaction("cities", mode), st = t.objectStore("cities"), r = fn(st); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }));
  return {key:(lat, lon) => (+lat).toFixed(3) + "," + (+lon).toFixed(3),
    get:k => tx("readonly", st => st.get(k)).catch(() => null),
    put:rec => tx("readwrite", st => st.put(rec)).then(() => CDB.all()).then(a => Promise.all(a.slice(6).map(x => tx("readwrite", st => st.delete(x.key))))).catch(() => null),
    all:() => tx("readonly", st => st.getAll()).then(a => (a || []).sort((x, y) => y.t - x.t)).catch(() => [])};
})();
async function cityRecent() {   // up to 3 buttons for the last downloaded towns
  const box = $("cityRecent"); if (!box) return; const a = (await CDB.all()).slice(0, 3); box.innerHTML = ""; box.hidden = !a.length;
  for (const c of a) { const b = document.createElement("button"); b.type = "button"; b.className = "ghost"; b.textContent = c.name; b.onclick = () => cityLoad(c.lat, c.lon, c.name, c.cc); box.appendChild(b); }
}
function cityLink(c) { const u = new URL(location.href); u.search = ""; u.hash = ""; u.searchParams.set("city", c.name); u.searchParams.set("lat", (+c.lat).toFixed(5)); u.searchParams.set("lon", (+c.lon).toFixed(5)); return u.toString(); }
const CITY_HOSTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
async function cityLoad(lat, lon, name, cc) {
  const say = t => { $("cityMsg").textContent = t; };
  $("cityGo").disabled = $("cityGeo").disabled = true;
  try {
    const key = CDB.key(lat, lon), hit = await CDB.get(key);
    let q = hit && hit.q;
    if (!q) {
    say(Tx`Preuzimam ulice za „${name}"… (do pola minuta)`);
    let data = null;
    let why = "";
    for (let round = 1; round <= 2 && !data; round++) {   // all map servers are asked at once (40 s each); the first answer wins. If none answers, one more try.
      if (round > 1) { say(Tx`Mapa ne može da se preuzme: ${why}. Probaj ponovo za minut.`); await new Promise(r => setTimeout(r, 4000)); }
      const acs = CITY_HOSTS.map(() => new AbortController()), t0 = Date.now(), body = "data=" + encodeURIComponent(CITY.query(lat, lon));
      const tick = setInterval(() => say(Tx`Preuzimam ulice za „${name}"… server ${round}/${2}, ${Math.round((Date.now() - t0) / 1000)} s`), 1000), kill = setTimeout(() => acs.forEach(a => a.abort()), 40000);
      const one = (h, ac) => fetch(h, {method:"POST", body, headers:{"Content-Type":"application/x-www-form-urlencoded"}, signal:ac.signal}).then(async r => {
        if (!r.ok) { why = r.status === 429 ? Tx("server je zauzet (previše zahteva)") : Tx`server javlja grešku ${r.status}`; throw 0; }
        const d = await r.json(); if (!d || !d.elements) throw 0; return d; }, e => { if (!why || ac.signal.aborted) why = ac.signal.aborted ? Tx("server se ne javlja (isteklo 40 s)") : Tx("nema veze sa serverom (internet ili blokada)"); throw e; });
      try { data = await Promise.any(CITY_HOSTS.map((h, k) => one(h, acs[k]))); acs.forEach(a => a.abort()); } catch (e) {}
      finally { clearInterval(tick); clearTimeout(kill); }
    }
    if (!data) { say(Tx`Mapa ne može da se preuzme: ${why}. Probaj ponovo za minut.`); return; }
    say(Tx("Pravim kvartove…")); await new Promise(r => setTimeout(r, 50));
    q = CITY.build(data.elements || [], lat, lon, BQ0.q.length, 1000);
    if (!q.length) { say(Tx("Ovde nema dovoljno ulica za igru. Probaj centar mesta ili neki gušći deo.")); return; }
    }
    const base = BQ0.q.length; CDB.put({key, name, lat, lon, cc, q, t:Date.now()}); RECS_ADD_CITY(name);
    const PK = "lightThemUp.prog.", same = CITYD && CDB.key(CITYD.lat, CITYD.lon) === key;
    let m = meta();
    try {   // every town keeps its own progress: park the old town's saves and quarters, bring back this town's
      if (!same) {
        if (S.started && MAP && MAP.part === "my") { save(); NOSAVE = true; }
        const pr = {saves:{}, auto:{}, started:m.started.filter(k => k >= base)};
        for (let id = base; id < base + 20; id++) { const v = localStorage.getItem("lightThemUp.borca.q" + id); if (v) pr.saves[id] = v; localStorage.removeItem("lightThemUp.borca.q" + id); }
        for (const k of Object.keys(m.auto)) if (+k >= base) { pr.auto[k] = m.auto[k]; delete m.auto[k]; }
        m.started = m.started.filter(k => k < base);
        if (CITYD && (pr.started.length || Object.keys(pr.auto).length || Object.keys(pr.saves).length)) localStorage.setItem(PK + CDB.key(CITYD.lat, CITYD.lon), JSON.stringify(pr));
        const back = JSON.parse(localStorage.getItem(PK + key) || "null");
        if (back) { for (const id in back.saves) localStorage.setItem("lightThemUp.borca.q" + id, back.saves[id]); Object.assign(m.auto, back.auto); m.started.push(...back.started); localStorage.removeItem(PK + key); }
        metaSave(m);
        localStorage.setItem("lightThemUp.city", JSON.stringify({name, lat, lon, q}));
      }
    } catch (e) { say(Tx("Nema mesta za čuvanje mape na ovom uređaju.")); return; }
    const last = q.find(x => m.started.includes(x.id) && !m.auto[x.id]) || q.find(x => !m.auto[x.id]) || q[0];
    const local = cc && LANGS[CC_LANG[cc]] ? CC_LANG[cc] : null, go = () => goMap("borca:" + last.id, !same && !!MAP && MAP.part === "my");
    const offer = [...new Set([LANG, "en", local].filter(l => l && LANGS[l]))];
    if (cc && offer.length > 1 && (local !== LANG || LANG !== "en")) {   // a town abroad: offer my language, English and the local one; never switch by itself
      $("cityMsg").innerHTML = ""; $("cityMsg").append(Tx`Gotovo: ${q.length} kvartova. Na kom jeziku da igraš?`);
      const row = document.createElement("div"); row.className = "city-row";
      for (const l of offer) { const b = document.createElement("button"); b.type = "button"; b.textContent = LANGS[l]; if (l !== LANG) b.className = "ghost"; b.onclick = () => { if (l !== LANG) { try { localStorage.setItem("lightThemUp.lang", l); } catch (e) {} } go(); }; row.append(b); }
      $("cityMsg").append(row); return;
    }
    say(Tx`Gotovo: ${q.length} kvartova. Krećem…`); setTimeout(go, 600);
  } finally { $("cityGo").disabled = $("cityGeo").disabled = false; }
}
$("cityGo").onclick = async () => {
  const v = $("cityQ").value.trim(); if (!v) { $("cityMsg").textContent = Tx("Upiši ime mesta."); return; }
  $("cityMsg").textContent = Tx("Tražim mesto…");
  const short = x => (x.display_name || v).split(",").slice(0, 2).map(t => t.trim()).join(", ").slice(0, 40);
  const pick = x => cityLoad(+x.lat, +x.lon, short(x), ((x.address || {}).country_code || "").toLowerCase());
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=1&accept-language=" + (LANG === "sr" ? "sr-Latn,en" : LANG) + "&q=" + encodeURIComponent(v));
    const a = (await r.json()).sort((x, y) => (/^(place|boundary)$/.test(y.class) ? 1 : 0) - (/^(place|boundary)$/.test(x.class) ? 1 : 0)); if (!a.length)   // towns and neighbourhoods first, single buildings last
    { $("cityMsg").textContent = Tx("Ne nalazim to mesto. Probaj sa imenom grada, npr. „Kotež, Beograd”."); return; }
    if (a.length === 1) { pick(a[0]); return; }
    // several places with that name: let the player choose the right one
    const box = $("cityMsg"); box.textContent = Tx("Našao sam više mesta. Koje je tvoje?");
    for (const x of a) { const b = document.createElement("button"); b.type = "button"; b.className = "ghost city-pick"; b.textContent = x.display_name.split(",").slice(0, 4).map(t => t.trim()).join(", "); b.onclick = () => pick(x); box.appendChild(b); }
  } catch (e) { $("cityMsg").textContent = Tx("Pretraga ne radi bez interneta."); }
};
cityRecent(); recShow();
if (CITYD) { $("cityShare").hidden = false; $("cityShare").onclick = async () => {
  const url = cityLink(CITYD), txt = Tx`Igraj Light Them Up u mom gradu: ${CITYD.name}`;
  try { if (navigator.share) { await navigator.share({title:"Light Them Up", text:txt, url}); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); $("cityMsg").textContent = Tx("Link je kopiran. Pošalji ga drugaru."); } catch (e) { $("cityMsg").textContent = url; }
}; }
{ const P = new URLSearchParams(location.search), pc = P.get("city"), plat = parseFloat(P.get("lat")), plon = parseFloat(P.get("lon"));   // a shared link: ?city=Name&lat=..&lon=..
  if (pc) { history.replaceState(null, "", location.pathname); setTimeout(() => { $("mapCity").click(); $("cityQ").value = pc;
    if (isFinite(plat) && isFinite(plon)) cityLoad(plat, plon, pc.slice(0, 40), ""); else $("cityGo").click(); }, 400); } }
$("mapCity").onclick = () => { $("qbox").hidden = false; drawQ(); $("cityBox").scrollIntoView({block:"center"}); setTimeout(() => $("cityQ").focus(), 300); };
const setLangSave = l => setLang(l, () => { if (S.started) save(); });
for (const l in LANGS) { const b = document.createElement("button"); b.type = "button"; b.textContent = LANGS[l]; b.setAttribute("aria-pressed", String(l === LANG)); b.onclick = () => { if (l !== LANG) setLangSave(l); }; $("langs").appendChild(b); }
for (const l in LANGS) { const o = document.createElement("option"); o.value = l; o.textContent = l.toUpperCase(); o.title = LANGS[l]; if (l === LANG) o.selected = true; $("langSel").appendChild(o); }   // quick language switch in the top bar
$("langSel").onchange = e => setLangSave(e.target.value);
$("cityQ").addEventListener("keydown", e => { if (e.key === "Enter") $("cityGo").click(); });
$("cityGeo").onclick = () => {
  if (!navigator.geolocation) { $("cityMsg").textContent = Tx("Ovaj uređaj ne daje lokaciju."); return; }
  $("cityMsg").textContent = Tx("Čekam lokaciju…");
  navigator.geolocation.getCurrentPosition(p => cityLoad(p.coords.latitude, p.coords.longitude, Tx("Moj kraj")), () => { $("cityMsg").textContent = Tx("Lokacija nije dozvoljena. Upiši ime mesta."); }, {timeout:15000});
};
function goMap(v, noSave) { if (S.started && !noSave) save(); try { localStorage.setItem("lightThemUp.map", v); } catch (e) {} location.reload(); }
$("mapBorca").onclick = () => { if (MAP) { goMap("fake"); return; } $("qbox").hidden = !$("qbox").hidden; if (!$("qbox").hidden) { drawQ(); $("qbox").scrollIntoView({block:"nearest"}); } };
$("qmap").onclick = e => {
  const G = qGrid(), r = $("qmap").getBoundingClientRect(), x = (e.clientX - r.left) / r.width * G.nx * QCW + G.gx0 * QCW, y = (e.clientY - r.top) / r.height * G.ny * QCH + G.gy0 * QCH;
  const q = G.qs.find(q => x >= q.gx * QCW && x < (q.gx + 1) * QCW && y >= q.gy * QCH && y < (q.gy + 1) * QCH); if (!q) return;
  if (MAP && q.id === MAP.id) { $("qinfo").textContent = Tx`Već si u kvartu ${qNum(q)} (${q.streets.slice(0, 2).join(", ")}). Dodirni dugme ispod.`; return; }
  if (!qAvail(q.id, meta())) { $("qinfo").textContent = Tx`Kvart ${qNum(q)} (${q.streets.slice(0, 2).join(", ")}) je zaključan. Automatizuj kvart pored njega da ga otvoriš.`; return; }
  goMap("borca:" + q.id);
};
if (MAP) $("mapBorca").textContent = Tx("Nazad na izmišljeni kvart");
if (MAP) { $("qbox").hidden = false; drawQ(); }
function takeBank() { const m = meta(); if (m.bank > 0) { S.money += m.bank; msg(Tx`Doneo si ${m.bank} $ iz prethodnog kvarta.`); } m.bank = 0; metaSave(m); }
function openPicker() { S.paused = true; setPauseLabel(); ov.hidden = false; $("btnStart").textContent = Tx("Ostani ovde"); $("btnNew2").hidden = true; $("qbox").hidden = false; drawQ(); }
function autoQuarter() {
  if (S.auto) { openPicker(); return; }
  if (S.goal < 1) { msg(Tx`Prvo osvetli 90% ulica ovog kvarta (sad ${Math.floor(S.cover * 100)}%).`, true); return; }
  if (S.money < autoCost()) { msg(Tx`Automatizacija košta ${autoCost()} $.`, true); return; }
  S.money -= autoCost(); S.led.buy += autoCost(); S.auto = true;
  const m = meta(), rate = Math.max(30, Math.round((S.lastPay || 80) * .4 / 5) * 5); S.autoRate = rate;
  const keep = Math.floor(S.money * .5); m.auto[MAP.id] = rate; m.bank = (m.bank || 0) + keep; S.money = 0; metaSave(m); SFX.win(); save();
  recInc("auto"); banner(Tx`Kvart ${qNum(MAP)} radi sam!`, Tx`Donosi +${rate} $ svake zore dok igraš u drugim kvartovima. Pola novca (${m.bank} $) nosiš sa sobom, pola ostaje za održavanje. Sledeći kvart je teži.`);
  setTimeout(openPicker, 2600);
}

$("btnNew2").onclick = () => { clearSave(); saved = null; resetGame(); try { localStorage.removeItem(TUT_KEY); } catch (e) {} begin(); setTimeout(tutStart, 500); msg(Tx("Nova igra. Srećno!")); };
let newArm = 0;
$("btnNew").onclick = () => {
  const b = $("btnNew");
  if (Date.now() - newArm > 3000) { newArm = Date.now(); b.textContent = Tx("Sigurno? Dodirni ponovo"); b.classList.add("danger"); setTimeout(() => { b.textContent = Tx("Nova igra"); b.classList.remove("danger"); }, 3000); return; }
  newArm = 0; b.textContent = Tx("Nova igra"); b.classList.remove("danger");
  clearSave(); resetGame(); setTool(null); setShop(false); try { localStorage.removeItem(TUT_KEY); } catch (e) {} begin(); setTimeout(tutStart, 500); msg(Tx("Nova igra. Srećno!"));   // a new game offers the tutorial again (it can be skipped with "Igram sam")
};
$("btnHelp").onclick = () => { ov.hidden = false; S.paused = true; $("btnTut").hidden = !S.started; if (S.started) $("btnStart").textContent = Tx("Nastavi"); $("btnNew2").hidden = true; };
const SVG_SND_ON = '<svg class="svg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const SVG_SND_OFF = '<svg class="svg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>';
const ICO_THIEF = '<svg class="svg-ico" viewBox="0 0 24 24" fill="none" stroke="#ffd84a" stroke-width="2"><path d="M3 11c2-3 5-4 9-4s7 1 9 4c-2 3-5 4-9 4s-7-1-9-4z"/><circle cx="9" cy="11" r="1.5" fill="#ffd84a"/><circle cx="15" cy="11" r="1.5" fill="#ffd84a"/></svg>';
const ICO_HOOD = '<svg class="svg-ico" viewBox="0 0 24 24" fill="none" stroke="#ff6b5b" stroke-width="2"><path d="M12 3c-4 0-7 3-7 8v6h14v-6c0-5-3-8-7-8z"/><circle cx="9.5" cy="11" r="1.2" fill="#ff6b5b"/><circle cx="14.5" cy="11" r="1.2" fill="#ff6b5b"/></svg>';
// background music: soft chords and a slow arpeggio, calmer at night. Made with Web Audio, no files.
const MUSIC = (() => {
  let ac = null, on = true, timer = null, step = 0, master = null, next = 0;
  try { on = localStorage.getItem("lightThemUp.music") !== "off"; } catch (e) {}
  const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  function note(n, t, dur, vol, type) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = hz(n); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.6, dur * .3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05); }
  function tick() {
    if (!ac) return;
    while (next < ac.currentTime + .6) {
      const ch = CH[Math.floor(step / 8) % 4], night = S.phase === "night", t = next;
      if (step % 8 === 0) for (const n of ch) { note(n, t, 4.2, .02, "triangle"); note(n - 12, t, 4.2, .012, "sine"); }
      const arp = [0, 1, 2, 1, 0, 2, 1, 2][step % 8]; if (!night || step % 2 === 0) note(ch[arp] + 12, t, .9, night ? .009 : .013, "sine");
      step++; next += night ? .55 : .45;
    }
  }
  function start() {
    if (!on || SFX.muted || timer) return;
    try {
      if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1800; master.connect(f); f.connect(ac.destination); }
      if (ac.state === "suspended") ac.resume();
      next = ac.currentTime + .1; timer = setInterval(tick, 200);
    } catch (e) {}
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } try { if (ac && ac.state === "running") ac.suspend(); } catch (e) {} }
  return {start, stop, get on() { return on; }, set on(v) { on = v; try { localStorage.setItem("lightThemUp.music", v ? "on" : "off"); } catch (e) {} if (v) start(); else stop(); }};
})();
function setSoundBtn() { const b = $("btnSound"); b.innerHTML = SFX.muted ? SVG_SND_OFF : SVG_SND_ON; b.setAttribute("aria-pressed", String(!SFX.muted)); b.title = SFX.muted ? Tx("Zvuk je isključen") : !MUSIC.on ? Tx("Samo zvukovi, bez muzike") : Tx("Zvuk i muzika"); }
setSoundBtn(); $("btnSound").onclick = () => {   // three steps: sound and music, sound only, silence
  if (!SFX.muted && MUSIC.on) { MUSIC.on = false; msg(Tx("Muzika je isključena, zvukovi rade.")); }
  else if (!SFX.muted) { SFX.toggle(); MUSIC.stop(); msg(Tx("Zvuk je isključen.")); }
  else { SFX.toggle(); MUSIC.on = true; msg(Tx("Zvuk i muzika su uključeni.")); }
  setSoundBtn(); };
document.addEventListener("visibilitychange", () => { if (document.hidden) MUSIC.stop(); else if (S.started) MUSIC.start(); });
$("btnPause").onclick = () => { if (!S.started) return; S.paused = !S.paused; setPauseLabel(); };
$("btnSkip").onclick = () => { if (S.phase === "day") S.phaseT = 0; };
document.addEventListener("keydown", e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;   // typing a town name must not pick lamps or pause
  if (e.key === "Escape" && document.body.classList.contains("shop-open")) { setShop(false); return; }   // Esc: first close the Shop, then cancel the placement, then drop the tool
  if (e.key === "Escape" && S.pending && !S.pending.lamp && !S.pending.job) { $("btnCancel").click(); return; }
  const k = {"1":"ul", "2":"kl", "3":"fe", "5":"ref"}[e.key];
  if (e.key === "4" && S.started && ov.hidden) startPatrol();
  else if (k) setTool(k); else if (e.key === "b" || e.key === "B") cycleBulb(); else if (e.key === "Escape") { setTool(null); S.addon = null; } else if (e.key === "h" || e.key === "H") { S.heat = !S.heat; }
  else if ((e.key === " " || e.key === "p" || e.key === "P") && S.started && ov.hidden) { e.preventDefault(); $("btnPause").click(); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) { save(); if (S.started && !S.paused) $("btnPause").click(); } });
window.addEventListener("pagehide", save);

const UP_ICO = {upCrane:"crane", upArmor:"armor", upInd:"factory", upCen:"center", upHeat:"heat", upFixAll:"fixall", upSensor:"sensor", upGlass:"glass", upDispatch:"dispatch", upLoan:"bank", upTender:"tender", upGen:"gen", upTrafo:"bolt", upSolar:"sun", upUps:"ups", upGenFix:"wrench", upVan:"van", upSpeed:"van", upPlot:"plot"};
function setUp(el, title, desc, cost) {
  const can = cost != null && S.money >= cost, ic = UP_ICO[el.id];
  el.innerHTML = Tx`<b>${ic ? svgI(SHOP_ICO[ic] || TY_ICO[ic], "svg-ico up-ico") : ""}${title}</b><span>${desc}</span><span>${cost == null ? Tx("Maksimum") : Tx`<em>${cost} $</em>`}</span>`;
  el.disabled = cost == null; el.classList.toggle("cant", cost != null && !can);
}
let lastSub = false;
const fmtT = t => Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
function updateUI() {
  if (VH() !== lastVH) { fitStage(); resize(); }
  if (tmp && S.pending !== tmp && !pal && !drag) dropTmp();
  { const G = S.gang, g = $("gang"), pr = Math.round(G.presence), rg = Math.round(G.rage);
    g.classList.toggle("gone", G.gone); g.classList.toggle("mad", !G.gone && rg > 50);
    if (G.gone) { $("gangR").textContent = ""; g.querySelectorAll(".gb").forEach(e => e.hidden = true); }
    const nT = thieves.length; $("gang").title = nT ? Tx`Lopova u kvartu: ${nT}` : Tx("Banda: prisustvo i bes");
    if (G.gone) { $("gangP").innerHTML = nT ? Tx`${ICO_THIEF} Lopovi: ${nT}` : Tx`Nova banda za ${Math.max(0, G.back - S.night)} n.`; }
    else { const nH = hoods.filter(h => h.state !== "flee").length; $("gangP").innerHTML = Tx`Banda${G.lv > 1 ? " " + G.lv : ""} ${pr}%` + (nT ? ` · ${ICO_THIEF} ${nT}` : "") + (nH ? ` · ${ICO_HOOD} ${nH}` : ""); $("gangR").textContent = rg > 50 ? Tx`Bes ${rg}%!` : Tx`Bes ${rg}%`; g.querySelectorAll(".gb").forEach(e => e.hidden = false);
      $("gPb").style.width = Math.min(100, pr) + "%"; $("gRb").style.width = Math.min(100, rg) + "%"; } }
  $("hMoney").textContent = Math.floor(S.money) + " $";
  $("hIncL").textContent = S.phase === "day" ? Tx("Dnevnica") : Tx("Prihod");
  $("hInc").textContent = (S.inc >= 0 ? "+" : "−") + Math.abs(S.inc).toFixed(1) + "/s";
  $("hInc").style.color = S.inc > 0 ? "var(--good)" : S.inc < 0 ? "var(--bad)" : "";
  $("hCover").textContent = Math.floor(S.cover * 100) + "%";
  $("hCover").style.color = S.cover > .95 ? "var(--good)" : S.cover > .6 ? "var(--warn)" : "var(--bad)";
  const pw = v => Number.isInteger(v) ? v : v.toFixed(1);
  $("hPow").textContent = pw(S.used) + "/" + genCap();
  $("hPowL").textContent = `Gen ${Math.round(S.genHp * 100)}%`; $("hPowL").title = Tx("Ispravnost generatora");
  $("hPowL").style.color = S.genHp < .3 ? "var(--bad)" : S.genHp < .6 ? "var(--warn)" : "";
  $("hPow").style.color = S.overload || S.out > 0 || S.trip > 0 || S.genHp <= 0 || S.load > .95 ? "var(--bad)" : S.load > .8 ? "var(--sodium)" : S.load > 0 ? "var(--good)" : "";
  if (S.out > 0 && !S.upsOn) $("hPow").textContent = "½ " + pw(S.used) + "/" + Math.floor(genCap() / 2);
  if (S.trip > 0) $("hPow").textContent = S.upsOn ? "UPS " + Math.ceil(S.upsCharge) + "s" : "OFF";
  $("hPhase").textContent = (S.phase === "day" ? "Dan " : Tx("Noć ")) + S.night;
  $("hPhaseT").textContent = (S.phase === "day" ? Tx("do noći ") : Tx("do zore ")) + fmtT(Math.max(0, S.phaseT));
  $("hPhaseC").classList.toggle("day", S.phase === "day");
  { const ico = $("hPhaseIco"), want = S.phase === "day" ? "sun" : "moon"; if (ico.dataset.k !== want) { ico.dataset.k = want; ico.innerHTML = UI_ICO[want]; } }
  $("btnSkip").hidden = !(S.phase === "day" && S.started);
  $("btnRef").classList.toggle("off", S.phase !== "night");
  document.body.classList.toggle("bignight", !!S.big && S.phase === "night");
  { const placing = !!(S.pending && toolModel()), ax = placing && !S.pending.lamp ? S.pending.axis : "";
    $("placeBar").hidden = !placing; $("actions").hidden = placing; $("btnHint").hidden = !toolModel();
    $("mvL").hidden = $("mvR").hidden = $("mvU").hidden = $("mvD").hidden = !ax; }
  $("btnRef").querySelector("span").textContent = refls.length ? `${refls.length}/${REF.max}` : `${REF.cost} $`;
  setUp($("upGen"), Tx("Jači generator"), Tx`Nivo ${S.genLv + 1}, kapacitet ${GEN_CAP[S.genLv]}${S.genLv < 3 ? " → " + GEN_CAP[S.genLv + 1] : ""}`, GEN_COST[S.genLv]);
  setUp($("upTrafo"), Tx("Trafostanica"), S.genLv < 3 ? Tx("Prvo jači generator do kraja") : Tx`+${TRAFO_CAP} struje. Imaš ${S.trafo || 0} od ${TRAFO_COST.length}`, S.genLv < 3 ? null : TRAFO_COST[S.trafo || 0]);
  if (S.genLv < 3) $("upTrafo").querySelector("span:last-child").textContent = Tx("Zaključano");
  setUp($("upSolar"), Tx("Solarni paneli"), S.unlocked ? Tx`+${SOLAR_CAP} struje i 30% jeftinija struja` : Tx("Posle kupovine starog kvarta"), S.unlocked && !S.solar ? SOLAR_COST : null);
  if (!S.unlocked) $("upSolar").querySelector("span:last-child").textContent = Tx("Zaključano");
  setUp($("upUps"), Tx("UPS baterija"), S.ups ? Tx`Drži svetla ${UPS_SEC}s kad generator stane. Puni se danju` : Tx`Kad generator štucne ili osigurač iskoči, drži svetla još ${UPS_SEC}s`, S.ups ? null : UPS_COST);
  setUp($("upDispatch"), Tx("Auto-dispečing"), S.dispatch ? (S.dispOff ? Tx("Isključen: dodirni da ga uključiš") : Tx("Servis sam ide na kvarove. Dodirni da isključiš")) : Tx("Servis sam popravlja lampe čim ima para"), S.dispatch ? null : DISPATCH_COST);
  if (S.dispatch) { const e = $("upDispatch"); e.disabled = false; e.classList.toggle("toggle-off", S.dispOff); e.querySelector("span:last-child").innerHTML = S.dispOff ? Tx('<span class="sw">ISKLJ</span>') : Tx('<span class="sw on">UKLJ</span>'); } else $("upDispatch").classList.remove("toggle-off");
  { const fl = fixList(), tot = fl.reduce((a, f) => a + f.cost, 0);
    setUp($("upFixAll"), Tx("Popravi / zameni sve"), fl.length ? Tx`${fl.length} lamp${fl.length === 1 ? "a" : "i"}: razbijene, izgorele i ispod 20% veka` : Tx("Sve lampe su ispravne"), fl.length ? tot : null);
    if (!fl.length) $("upFixAll").querySelector("span:last-child").textContent = Tx("Nema posla"); }
  { const ns = slots.filter(s => s.lamp && s.lamp.sensor).length, ng = slots.filter(s => s.lamp && s.lamp.glass).length;
    setUp($("upSensor"), Tx("Senzor pokreta"), Tx`Za jednu lampu: 0 struje dok niko ne priđe, plaši huligane. Ugrađeno ${ns}`, SENSOR_COST);
    setUp($("upGlass"), Tx("Ojačano staklo"), Tx`Za jednu lampu: duplo trpi kamenice. Ugrađeno ${ng}`, GLASS_COST);
    $("upSensor").classList.toggle("armed", S.addon === "sensor"); $("upGlass").classList.toggle("armed", S.addon === "glass"); }
  if (S.started && stars() !== S.lastStars) { const up = stars() > S.lastStars; S.lastStars = stars();
    if (up) { SFX.win(); banner(Tx`Reputacija ${starStr(stars())}`, Tx`Nova nagrada: ${STAR_PERK[stars() - 1]}.`); } else msg(Tx`Reputacija je pala na ${starStr(stars())}.`, true); }
  if (subsidy() !== lastSub) { lastSub = subsidy(); BULBS.led.cost = lastSub ? 34 : 40; refreshTools(); if (lastSub) S.tips.rep75 = 1; }
  setUp($("upCrane"), Tx("Dizalica (korpa)"), S.crane ? Tx("Ulični stubovi se montiraju duplo brže") : Tx("Duplo brža montaža uličnih stubova"), S.crane ? null : CRANE_COST);
  setUp($("upArmor"), Tx("Oklopni kombi"), S.armor ? Tx("Majstori rade i pod kamenicama") : Tx("Obični majstori čekaju kad su huligani blizu"), S.armor ? null : ARMOR_COST);
  setUp($("upInd"), Tx("Industrijska zona"), S.zInd ? Tx("Fabrike plaćaju +60%, vole LED") : Tx("Fabrike plaćaju +60%, traže jaku LED rasvetu"), S.zInd ? null : ZONES2.ind.cost);
  setUp($("upCen"), Tx("Centar · Šetalište"), S.zCen ? Tx("+40% prihoda, vole toplo svetlo") : Tx("+40% prihoda, traži fenjere i klasične stubove"), S.zCen ? null : ZONES2.cen.cost);
  for (const id of ["upCrane", "upArmor", "upInd", "upCen"]) if ($(id).disabled) $(id).querySelector("span:last-child").textContent = Tx("Kupljeno");
  setUp($("upHeat"), Tx("Toplotna mapa zadovoljstva"), Tx("Kuće obojene po zadovoljstvu: zeleno srećni, crveno nezadovoljni (taster H)"), null);
  { const e = $("upHeat"); e.disabled = false; e.querySelector("span:last-child").innerHTML = S.heat ? Tx('<span class="sw on">UKLJ</span>') : Tx('<span class="sw">ISKLJ</span>'); }
  setUp($("upLoan"), Tx("Kredit u banci"), S.loan > 0 ? Tx`Dug ${S.loan} $, rata ${LOAN_RATE} $ svake zore` : Tx`+${LOAN_AMOUNT} $ odmah, vraćaš ${LOAN_BACK} $ u ratama`, null);
  { const e = $("upLoan"); e.disabled = S.loan > 0; e.querySelector("span:last-child").innerHTML = S.loan > 0 ? Tx("Otplaćuješ") : Tx`<em>+${LOAN_AMOUNT} $</em>`; e.classList.remove("cant"); }
  { const e = $("upTender"), T = S.tender; e.innerHTML = Tx`<b>${svgI(TY_ICO.tender, "svg-ico up-ico")}Gradski tender</b><span>${T ? tenderText(T) : S.night < 3 ? Tx("Grad nudi tendere od 3. noći") : Tx("Novi tender stiže uskoro")}</span><span>${svgI(TY_ICO.star, "svg-ico up-ico")}${starStr(stars())} ${S.rep}/100 · ${STAR_PERK[stars() - 1]} · struja −${Math.round(repDiscount() * 100)}%</span>`; e.disabled = false; }
  setUp($("upGenFix"), Tx("Servis generatora"), Tx`Ispravnost ${Math.round(S.genHp * 100)}%. Najduže traje na 80–85% opterećenja`, genFixCost());
  setUp($("upVan"), Tx("Servisno vozilo"), Tx`Imaš ${vans.length} od 4 · plata +20 $ po zori`, VAN_COST[vans.length - 1]);
  setUp($("upSpeed"), Tx("Brža vozila i majstori"), Tx`Brzina ${Math.round(SPEED_MULT[S.speedLv] * 100)}% · plata +10 $ po zori · sad plate ${wageOf()} $`, SPEED_COST[S.speedLv]);
  { const e = $("upPatrol"), busy = S.patrol || S.calm > 0;
    e.innerHTML = Tx`<b>${svgI(SHOP_ICO.van, "svg-ico up-ico")}Patrola</b><span>${S.patrol ? Tx("Obilazi kvart…") : S.calm > 0 ? Tx`Kvart je miran još ${Math.ceil(S.calm)} s` : S.phase !== "night" ? Tx("Izlazi samo noću") : Tx("Obiđe kvart, pa 30 s nema huligana")}</span><span><em>${PATROL.cost} $</em></span>`;
    e.disabled = !!busy || S.phase !== "night"; e.classList.toggle("cant", S.money < PATROL.cost); }
  if (MAP) { setUp($("upPlot"), S.auto ? Tx("Kvart radi sam") : Tx("Automatizuj kvart"), S.auto ? Tx`+${S.autoRate || 0} $ svake zore u drugim kvartovima` : S.goal >= 1 ? Tx("Kvart radi sam, a ti prelaziš u susedni") : Tx`Prvo osvetli 90% ulica (sad ${Math.floor(S.cover * 100)}%)`, autoCost());
    if (S.auto) { const e = $("upPlot"); e.disabled = false; e.classList.remove("cant"); e.querySelector("span:last-child").textContent = Tx("Izaberi kvart"); } else if (S.goal < 1) $("upPlot").classList.add("cant"); }
  else setUp($("upPlot"), Tx("Stari kvart"), S.unlocked ? Tx("Kupljen, jug mape") : Tx("Novi plac na jugu, 10 mesta"), S.unlocked ? null : PLOT_COST);
  $("fScared").textContent = S.scared; $("fBroken").textContent = S.broken; $("fHoods").textContent = hoods.filter(h => h.state !== "flee").length;
  const any = [S.genHp < .6 ? genFixCost() : null, GEN_COST[S.genLv], VAN_COST[vans.length - 1], SPEED_COST[S.speedLv], MAP ? (S.goal >= 1 && !S.auto ? autoCost() : null) : S.unlocked ? null : PLOT_COST,
    S.genLv >= 3 ? TRAFO_COST[S.trafo || 0] : null, S.unlocked && !S.solar ? SOLAR_COST : null, S.ups ? null : UPS_COST, S.dispatch ? null : DISPATCH_COST,
    S.crane ? null : CRANE_COST, S.armor ? null : ARMOR_COST, ...Object.values(ZONES2).map(z => S[z.key] ? null : z.cost)].some(c => c != null && S.money >= c);
  $("btnShop").classList.toggle("has", any); $("btnShop2").classList.toggle("has", any);
  const s2 = S.sel || (S.hover && slotAt(S.hover, hitR()));
  let html;
  if (s2 && s2.plot && !S.unlocked) html = Tx`<b>Stari kvart</b><br>Zaključano. Kupi ga u nadogradnjama.`;
  else if (s2 && s2.lamp) {
    const L = s2.lamp, [mood, why] = moodOf(s2, L.m);
    const st = s2.job ? Tx("servis je na putu") : L.state === "broken" ? Tx`razbijena svetiljka, dodir = popravka ${repairCost(L.m) + (L.life <= .05 ? bulbCost(L.m) : 0)} $` : L.state === "burnt" ? Tx`izgorela sijalica, dodir = nova ${bulbCost(L.m)} $` : !L.powered ? Tx("bez struje, generator je pun") : "radi";
    html = Tx`<b>${L.m.name}</b> · ${Math.ceil(L.life * 100)}% veka<br>Stanje: ${st}<br>Stanari: ${mood > 0 ? "srećni" : mood < 0 ? "nesrećni" : "ravnodušni"}. ${why}`;
  } else if (s2) html = Tx`<b>${s2.zone === "park" ? Tx("Mesto u parku") : s2.district === "stari" ? Tx("Mesto u starom kvartu") : Tx("Prazno mesto na ulici")}</b><br>${toolModel() ? Tx`Dodir = radar, drugi dodir = montaža (${toolModel().name}, ${toolModel().cost} $)` : Tx("Izaberi svetiljku, pa dodirni ovde.")}`;
  else { const L = S.led, r = v => Math.round(v);
    html = Tx`<b>Novac od prošle zore</b><br>Stanari +${r(L.pay)} $ · nagrade +${r(L.bounty)} $ · struja −${r(L.fuel)} $ · kupovina i popravke −${r(L.buy)} $${L.theft ? Tx` · lopovi −${r(L.theft)} $` : ""}` +
      (S.report ? Tx`<br><span style="color:var(--muted)">Prošla ${S.report}</span>` : "") + Tx`<br>Zadovoljstvo stanara: ${Math.round(S.sat * 100)}%` +
      Tx`<br>Banda: ${S.gang.gone ? Tx("odselila se") : Tx`prisustvo ${Math.round(S.gang.presence)}%, bes ${Math.round(S.gang.rage)}%, otvorenih ruta ${routesNow().filter(routeOpen).length} od ${routesNow().length}`}`; }
  $("info").innerHTML = html;
}

// ---------- Simulation ----------
function step(dt) {
  S.t += dt; S.flashCd = Math.max(0, S.flashCd - dt);
  if (S.phase === "night" && S.boAt > 0 && S.phaseT < S.boAt && dt > 0) {   // blackout in all of Borča: only the UPS keeps lamps on
    S.boAt = -1; S.trip = 14 + 2 * Math.min(5, BL); SFX.outage(); S.thiefT = Math.min(S.thiefT, 3);
    banner((MAP && MAP.part === "my" ? Tx`Nestala struja u celom mestu: ${partName("my").split(",")[0]}!` : Tx("Nestala struja u celoj Borči!")), S.ups ? Tx("UPS baterija drži deo lampi. Banda jedva čeka mrak!") : Tx("Sve lampe su ugašene. UPS baterija iz Prodavnice bi ih držala upaljene."));
    if (!S.gang.gone) { spawnHood(false); spawnHood(false); }
  }
  if (S.phase === "night" && S.outAt > 0 && S.phaseT < S.outAt && dt > 0) { S.outAt = -1; S.out = 9; SFX.outage(); tip("outage", Tx("Generator štuca!"), Tx("Nekoliko sekundi radi samo pola struje i deo lampi se gasi. Lopovi i banda jedva čekaju mrak!")); msg(Tx("Generator štuca! 9 sekundi pola struje."), true); }
  if (S.out > 0) S.out = Math.max(0, S.out - dt);
  if (S.trip > 0) { S.trip = Math.max(0, S.trip - dt); if (S.trip === 0) { msg(Tx("Osigurač je vraćen, struja opet radi.")); SFX.done(); } }
  const fullCap = genCap(), dead = S.genHp <= 0 || S.trip > 0;
  S.upsOn = (dead || S.out > 0) && S.ups && S.upsCharge > 0 && S.phase === "night";
  if (S.upsOn) S.upsCharge = Math.max(0, S.upsCharge - dt);
  const baseCap = dead && !S.upsOn ? 0 : fullCap * OVER_MAX;
  const cap = S.out > 0 && !S.upsOn ? Math.floor(fullCap / 2) : baseCap; let used = 0; S.overload = false;
  const on = slots.filter(s => s.lamp && s.lamp.state === "ok" && avail(s)).sort((a, b) => a.lamp.order - b.lamp.order);
  for (const s of on) { const p = sensorIdle(s.lamp) ? 0 : s.lamp.m.power; if (used + p <= cap) { s.lamp.powered = true; used += p; } else { s.lamp.powered = false; S.overload = true; } }
  S.used = used; S.load = genCap() ? used / genCap() : 0;
  if (S.phase === "night" && dt > 0 && !S.trip) {
    S.tripCd -= dt;
    if (S.load > 1 && S.tripCd <= 0) {   // red zone: every few seconds the breaker may trip
      S.tripCd = 5;
      if (Math.random() < .1 + (S.load - 1) * 2) { S.trip = rnd(5, 8); SFX.outage(); S.thiefT = Math.min(S.thiefT, 2);
        banner(Tx("Iskočio osigurač!"), S.ups && S.upsCharge > 0 ? Tx("Preopterećenje! UPS baterija drži svetla dok se osigurač ne vrati.") : Tx("Preopterećenje! Mrak na nekoliko sekundi, lopovi jedva čekaju. Smanji potrošnju ispod 100%."));
        if (!S.tips.trip) tip("trip", Tx("Osigurač je iskočio"), Tx("Generator može da radi i preko 100% (do 110%), ali tada osigurač povremeno iskoči i nastane mrak. Na 85–100% radi, ali se brže troši. Najbolje je 80–85%.")); }
    }
    if (S.load > .85) { S.humT -= dt; if (S.humT <= 0) { S.humT = S.load > 1 ? 1.2 : 3; SFX.hum(); } }
  }
  if (S.phase === "night" && dt > 0 && S.mission && S.mission.type === "load" && !S.mission.fail && S.load > .86) { S.mission.over += dt; if (S.mission.over > 3) misFail(Tx("Generator je predugo bio preopterećen.")); }
  if (S.phase === "night" && S.genHp > 0 && dt > 0) {   // wear: gentle at 80-85% load, fast near 100%
    const L = S.load, f = L <= .85 ? .45 : L <= 1 ? .9 : 3.2;
    const was = S.genHp; S.genHp = Math.max(0, S.genHp - dt * .00045 * f);
    if (was > .3 && S.genHp <= .3) msg(Tx("Generator je istrošen (30%). Servisiraj ga u Prodavnici, inače češće štuca."), true);
    if (S.genHp <= 0) { S.genHp = 0; SFX.outage(); banner(Tx("Generator se pokvario!"), Tx("Sve lampe su ugašene. Servisiraj ga u Prodavnici (danju upola cene).")); }
  }
  let mh = 0, ms = 0;
  for (const s of slots) if (s.lamp && avail(s)) { const md = moodOf(s, s.lamp.m)[0]; s.lamp.mood = md; if (md > 0) mh++; else if (md < 0) ms++; }
  S.moodHappy = mh; S.moodSad = ms;
  // day / night
  S.phaseT -= dt;
  S.dark += ((S.phase === "night" ? .78 : .12) - S.dark) * Math.min(1, dt * .9);
  if (S.phaseT <= 0 && dt > 0) {
    if (S.phase === "night") {
      S.phase = "day"; S.phaseT = DAY_LEN; recSet(r => { r.nights++; r.rep = Math.max(r.rep, Math.round(S.rep)); r.cover = Math.max(r.cover, Math.floor(S.cover * 100)); });
      S.dayRate = S.nightN ? .5 * S.nightVal / S.nightN * NIGHT_LEN / DAY_LEN : 0; S.nightVal = 0; S.nightN = 0;
      if (S.mission && !S.mission.done && !S.mission.fail) { if (["house", "nobreak", "load"].includes(S.mission.type)) misWin(); else misFail(Tx("Nisi stigao do cilja.")); }
      const repD = repStep(S.cover);
      if (S.tender && (S.tender.type === "cover" && S.cover >= .9 || S.tender.type === "safe" && !S.tenderTheft)) S.tender.prog++;
      S.tenderTheft = 0; checkTender();
      let tenLine = "";
      if (S.tender && S.night >= S.tender.until) { const pen = Math.min(Math.floor(S.money), S.tender.pen || 0); S.money -= pen; S.led.ten -= pen; tenLine = Tx` Tender je propao: penal −${pen} $.`; SFX.fail(); S.rep = Math.max(0, S.rep - 5); S.tender = null; S.tenderCd = 2; }
      else if (!S.tender && S.night >= 3 && --S.tenderCd <= 0) { S.tender = newTender(); S.money += S.tender.adv; S.led.ten += S.tender.adv; tenLine = Tx` Novi gradski tender: ${S.tender.text}. Avans +${S.tender.adv} $ odmah, na kraju +${S.tender.reward} $, a ako ne uspeš penal −${S.tender.pen} $.`; }
      const wage = Math.min(Math.floor(S.money), wageOf()); if (wage > 0) { S.money -= wage; S.led.wage += wage; }
      if (stars() >= 5) { S.money += 60; S.led.ten += 60; }
      let loanLine = "";
      if (S.loan > 0) { const p = Math.min(S.loan, LOAN_RATE, Math.floor(S.money)); S.money -= p; S.loan -= p; S.led.buy += p; loanLine = S.loan > 0 ? Tx` Rata kredita −${p} $ (ostalo ${S.loan} $).` : Tx(" Kredit je otplaćen!"); }
      const misLine = S.mission ? (S.mission.done ? Tx` Misija uspela (+${S.mission.reward} $).` : Tx(" Misija propala.")) : ""; S.mission = null;
      if (S.ups) S.upsCharge = UPS_SEC; S.trip = 0;
      let bigLine = "";
      if (S.big) { S.big = false;
        if (S.bigBroke <= 5) { const bonus = Math.round(Math.max(150, .5 * (S.led.pay || 0)) / 10) * 10; S.money += bonus; S.led.bounty += bonus; bigLine = Tx` Preživeo si Veliku noć: +${bonus} $!`; SFX.win(); }
        else bigLine = Tx` Velika noć: razbijeno ${S.bigBroke} lampi, bez nagrade.`; }
      if (MAP) { const ai = autoIncome(); if (ai) { const up = Math.round(ai * Math.min(.5, .1 + .06 * BL) + (Math.random() < .2 ? ai * .4 : 0)); S.money += ai - up; S.led.auto = ai - up; S.autoUp = up; } }
      const L = S.led, r = v => Math.round(v);
      const net = r(L.pay + L.bounty + (L.obj || 0) + (L.ten || 0) + (L.auto || 0) - L.fuel - L.buy - (L.wage || 0) - (L.theft || 0) - (L.mis || 0));
      S.report = Tx`Noć ${S.night}: stanari +${r(L.pay)} $, nagrade +${r(L.bounty)} $,${L.obj ? Tx` trafika i stajalište +${r(L.obj)} $,` : ""} struja −${r(L.fuel)} $${S.tariff > 1 ? Tx(" (skupa tarifa)") : ""}, kupovina i popravke −${r(L.buy)} $${L.wage ? Tx`, plate −${r(L.wage)} $` : ""}${L.ten ? Tx`, tender ${L.ten > 0 ? "+" : "−"}${r(Math.abs(L.ten))} $` : ""}${L.theft ? Tx`, lopovi −${r(L.theft)} $` : ""}${L.mis ? Tx`, kazna misije −${r(L.mis)} $` : ""}. Ukupno ${net >= 0 ? "+" : ""}${net} $.${misLine}${bigLine}${tenLine}${loanLine} Reputacija ${S.rep}${repD >= 0 ? " (+" + repD + ")" : " (" + repD + ")"}.${S.trafficPay ? Tx` Putarina +${S.trafficPay} $.` : ""}${(S.night + 1) % 5 === 0 ? Tx(" Sledeća noć je VELIKA NOĆ!") : ""}`;
      S.trafficPay0 = S.trafficPay; S.trafficPay = 0; S.lastPay = L.pay; S.led = {pay:0, fuel:0, buy:0, bounty:0, theft:0, mis:0, obj:0, wage:0, ten:0};
      for (const t of thieves) if (t.state !== "flee") { t.state = "flee"; t.exit = edgeFor(t); }
      for (const c of CARS) c.gone = false;
      for (const h of hoods) scare(h, true);
      { const G = S.gang; G.rage = Math.max(0, G.rage - 15); const before = zones.length; zones = zones.filter(z => z.perm || z.until > S.night); if (zones.length < before && !G.gone) S.reopened = before - zones.length; }
      refls = []; S.patrol = null; S.calm = 0;
      SFX.dawn(); msg(Tx`Svanulo! Noć ${S.night} je prošla. Ukupno ${net >= 0 ? "+" : ""}${net} $.`);
      S.dawn = {night:S.night, net, day:Math.round(S.dayRate * DAY_LEN), rows:[[Tx("Stanari"), L.pay], [Tx("Nagrade"), L.bounty], [Tx("Automatizovani kvartovi (posle održavanja)"), L.auto || 0], [MAP ? Tx("Trafika, stajalište i mesta") : Tx("Trafika i stajalište"), L.obj], [stars() >= 5 ? Tx("Grad i tenderi") : Tx("Tender (avans / penal)"), L.ten || 0], [S.tariff > 1 ? Tx("Struja (skupa tarifa)") : Tx("Struja"), -L.fuel], [Tx("Kupovina i popravke"), -L.buy], [Tx("Plate radnika"), -(L.wage || 0)], [Tx("Lopovi"), -(L.theft || 0)], [Tx("Kazna misije"), -(L.mis || 0)]].filter(r => Math.round(r[1]) !== 0),
        notes:[misLine, bigLine, tenLine, loanLine, S.trafficPay0 ? Tx` Putarina +${S.trafficPay0} $.` : "", Tx` Reputacija ${starStr(stars())} ${S.rep}/100 (${repD >= 0 ? "+" : ""}${repD}).`, (S.night + 1) % 5 === 0 ? Tx(" Sledeća noć je VELIKA NOĆ!") : ""].map(t => t.trim()).filter(Boolean)};
      showDawn(); S.weather = ""; S.tariff = 1;
      if (S.tool === "ref") setTool(null);
    } else {
      $("dawn").hidden = true; SFX.night(); S.phase = "night"; S.phaseT = NIGHT_LEN; S.night++; S.spawnT = 8; S.thiefT = rnd(12, 25);
      S.outAt = S.night >= 3 && Math.random() < .3 + (1 - S.genHp) * .7 ? rnd(15, NIGHT_LEN - 15) : -1;
      S.boAt = BL && S.night >= 2 && Math.random() < Math.min(.6, .2 + .08 * BL) ? rnd(20, NIGHT_LEN - 30) : -1;
      const G = S.gang;
      if (G.gone && G.back && S.night >= G.back) {
        G.lv++; Object.assign(G, {presence:60 + 10 * G.lv, rage:0, gone:false, back:0}); zones = [];
        banner(Tx`Stigla je nova banda: ${GANG_NAMES[(G.lv - 1) % GANG_NAMES.length]}!`, Tx`Jači su od prošlih: manje se plaše svetla i gađaju iz daljine. Nivo bande ${G.lv}.`);
      } else banner(Tx`Pada noć ${S.night}.`, S.gang.gone ? Tx`Banda se odselila. Nova stiže za ${S.gang.back - S.night} noć${S.gang.back - S.night === 1 ? "" : "i"}. Pazi na lopove!` : S.night === 2 ? Tx("Pazi, stižu prvi huligani! Dolaze iz baze na levoj ivici, crvenim rutama.") : S.reopened ? Tx("Neki zatvoreni delovi su se opet otvorili za bandu.") : Tx("Lampe svetle, banda vreba."));
      S.reopened = 0;
      S.tariff = S.night >= 2 && Math.random() < .25 ? TARIFF : 1;
      if (S.tariff > 1) S.banner.sub += " " + Tx("Skupa struja +40%") + ".";
      S.weather = S.night >= 3 ? (Math.random() < .2 ? "fog" : Math.random() < .2 ? "storm" : "") : ""; S.stormT = rnd(6, 10);
      if (S.weather) { S.banner.sub += " " + (S.weather === "fog" ? Tx("Magla: domet −25%") : Tx("Oluja: pazi na stare lampe")) + "."; if (!S.tips[S.weather]) { S.tips[S.weather] = 1; } }
      S.mission = newMission(); if (S.mission) { S.banner.sub += " " + misText(S.mission); S.msgT = 0; }
      S.big = S.night >= 5 && S.night % 5 === 0; S.bigBroke = 0;
      if (S.big) {
        banner(Tx`VELIKA NOĆ ${S.night}!`, Tx`Banda i lopovi napadaju duplo jače. Ako do zore ostane najviše 5 razbijenih lampi, dobijaš veliku nagradu.${S.mission ? " " + misText(S.mission) : ""}`);
        SFX.alarm(); S.thiefT *= .5; S.spawnT = 2; if (!S.gang.gone) { S.gang.rage = Math.min(100, S.gang.rage + 20); spawnHood(false); spawnHood(false); }
      }
    }
    save();
  }
  for (const s of slots) if (isLit(s)) {
    s.lamp.life -= dt / s.lamp.m.life;
    if (s.lamp.life <= 0) { s.lamp.life = 0; s.lamp.state = "burnt"; SFX.fizz(); float(s.x, s.y - 14, Tx("Izgorela!"), "#ff6b5b"); }
  }
  S.coverT -= dt;
  if (S.coverT <= 0) {
    S.coverT = .25;
    let key = boundY() + "|";
    for (const s of slots) if (isOn(s)) key += s.id + ":" + Math.round(s.x) + ":" + Math.round(s.y) + ":" + Math.round(lr(s)) + ",";
    if (key !== coverKey) { coverKey = key; S.cover = computeCover(); }
    if (S.started && S.cover >= (MAP ? .9 : 1) && S.goal === 0) { S.goal = 1; S.money += 150; banner(MAP ? Tx("Kvart je rešen!") : Tx("Ceo kvart je osvetljen!"), MAP ? Tx`Bonus +150 $. U Prodavnici ga sad možeš automatizovati (${autoCost()} $): radi sam, a ti prelaziš u susedni kvart.` : Tx("Bonus +150 $. Sledeći cilj: kupi stari kvart.")); }
    if (S.started && S.cover >= 1 && S.goal === 2) { S.goal = 3; S.money += 300; banner(Tx("Ceo prošireni kvart svetli!"), Tx("Bonus +300 $. Bravo, majstore rasvete!")); }
  }
  // houses: mood of their light and satisfaction that grows while lit
  const tone = {novi:districtTone("novi").bonus, stari:districtTone("stari").bonus};
  let val = 0, satSum = 0, n = 0;
  for (const h of houses) {
    if (!hOn(h)) continue;
    let best = -2;
    for (const s of slots) if (isOn(s) && Math.hypot(s.x - h.cx, s.y - h.cy) < lr(s) * LIGHT_K) best = Math.max(best, s.lamp.mood);
    h.mood = best; h.lit = best > -2 && S.phase === "night" ? 1 : 0;
    if (S.phase === "night") {
      const target = best > 0 ? 1 : best === 0 ? .7 : best === -1 ? .35 : 0;
      if (h.lit && h.sat < target) h.sat = Math.min(target, h.sat + SAT_UP * dt);
      else if (!h.lit || h.sat > target) h.sat = Math.max(h.lit ? target : 0, h.sat - SAT_DOWN * dt);
    }
    if (best > -2) { const zk = zoneAt(h.cx, h.cy); val += INCOME_PER_HOUSE * (h.wt || 1) * HOUSE_K * (best > 0 ? 1 : best === 0 ? .7 : .35) * (0.5 + h.sat) * tone[h.plot || (MAP && DIST0 === "stari") ? "stari" : "novi"] * (zk ? ZONES2[zk].mult : 1) * (stars() >= 2 ? 1.05 : 1); }
    satSum += h.sat; n++;
    h.glow += (h.lit - h.glow) * Math.min(1, dt * 2);
  }
  S.sat = n ? satSum / n : 0;
  const active = hoods.filter(h => h.state !== "flee").length;
  if (S.phase === "night") {
    const pay = Math.max(0, val - active * .2), fuel = used * FUEL_PER_POWER * (S.solar ? .7 : 1) * (1 - repDiscount()) * (S.tariff || 1);
    S.nightVal += pay * dt; S.nightN += dt;
    S.money += pay * dt; S.led.pay += pay * dt;
    S.money = Math.max(0, S.money - fuel * dt); S.led.fuel += fuel * dt;
    S.inc = pay - fuel;
  } else { S.inc = S.dayRate; S.money += S.dayRate * dt; S.led.pay += S.dayRate * dt; }
  // jobs & vans
  const spd = 92 * SPEED_MULT[S.speedLv] * (S.phase === "day" ? 1.2 : 1);   // a bit faster than traffic, not flying past it
  for (const v of vans) {
    if (!v.job) {
      const free = jobs.filter(j => !j.assigned);
      if (free.length) {
        const j = free.sort((a, b) => (Math.abs(a.slot.rx - v.x) + Math.abs(a.slot.ry - v.y)) - (Math.abs(b.slot.rx - v.x) + Math.abs(b.slot.ry - v.y)))[0];
        j.assigned = true; v.job = j; v.path = route(v, {x:j.slot.rx, y:j.slot.ry}); v.state = "drive";
      } else if (v.state !== "home" && v.state !== "return") { v.path = route(v, v.home); v.state = "return"; }
    }
    if (v.state === "drive" || v.state === "return") {
      let st = spd * dt;
      if (v.path.length && v.va != null) { const q = v.path[0], d = Math.atan2(q.y - v.y, q.x - v.x) - v.va; if (Math.hypot(q.x - v.x, q.y - v.y) > 2 && Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) > 1.2) st = 0; }   // a sharp turn (leaving the depot, U-turn): turn on the spot first, don't spin while driving
      while (st > 0 && v.path.length) {
        const q = v.path[0], dx = q.x - v.x, dy = q.y - v.y, d = Math.hypot(dx, dy);
        if (d > .01) v.ang = Math.atan2(dy, dx);
        if (d <= st) { v.x = q.x; v.y = q.y; v.path.shift(); st -= d; } else { v.x += dx / d * st; v.y += dy / d * st; st = 0; }
      }
      if (!v.path.length) { if (v.state === "drive") { v.state = "work"; v.t = WORK_TIME / SPEED_MULT[S.speedLv] * (S.crane && v.job.type === "install" && v.job.m.kind === "ulica" ? .5 : 1); } else v.state = "home"; }
    } else if (v.state === "work") {
      const threat = !S.armor && S.phase === "night" && hoods.some(h => h.state !== "flee" && Math.hypot(h.x - v.x, h.y - v.y) < 80);
      v.wait = threat; v.waitCd = Math.max(0, (v.waitCd || 0) - dt);
      if (threat && v.waitCd <= 0) { v.waitCd = 4; float(v.x, v.y - 16, Tx("Majstori čekaju!"), "#ffb02e"); if (!S.tips.armor) { S.tips.armor = 1; msg(Tx("Huligani bacaju kamenice, pa majstori čekaju. Oteraj ih, ili kupi oklopni kombi."), true); } }
      if (!threat) v.t -= dt;
      if (!v.wait && Math.random() < dt * 5) burst(v.job.slot.x, v.job.slot.y - 6, "#ffd84a", 2 + (Math.random() * 2 | 0), 55);
      if (v.t <= 0) {
        const j = v.job, s = j.slot;
        if (j.type === "install") { s.lamp = newLamp(j.m); const md = moodOf(s, j.m)[0]; float(s.x, s.y - 14, md > 0 ? Tx("Montirano, stanari srećni") : md < 0 ? Tx("Montirano, stanari nesrećni") : Tx("Montirano"), md < 0 ? "#ff9d8f" : "#7ed39a"); }
        else if (j.type === "bulb") { s.lamp.m = j.m; s.lamp.life = 1; if (s.lamp.state === "burnt") s.lamp.state = "ok"; float(s.x, s.y - 14, Tx`Nova sijalica: ${j.m.b.name}`, "#7ed39a"); }
        else { if (j.wb) s.lamp.life = 1; s.lamp.state = s.lamp.life > 0 ? "ok" : "burnt"; s.lamp.hp = LAMP_HP; float(s.x, s.y - 14, s.lamp.state === "ok" ? Tx("Popravljeno") : Tx("Popravljeno, fali sijalica"), s.lamp.state === "ok" ? "#7ed39a" : "#f1c453"); }
        burst(s.x, s.y, "rgb(" + s.lamp.m.col + ")", 14, 70); SFX.done();
        s.job = null; jobs.splice(jobs.indexOf(j), 1); v.job = null; v.state = "return"; v.path = route(v, v.home);
        save();
      }
    }
  }
  if (S.patrol) {
    const P = S.patrol; let st = PATROL.speed * dt;
    while (st > 0 && P.path.length) {
      const q = P.path[0], dx = q.x - P.x, dy = q.y - P.y, d = Math.hypot(dx, dy);
      if (d > .01) P.ang = Math.atan2(dy, dx);
      if (d <= st) { P.x = q.x; P.y = q.y; P.path.shift(); st -= d; } else { P.x += dx / d * st; P.y += dy / d * st; st = 0; }
    }
    if (!P.path.length) { S.patrol = null; S.calm = PATROL.calm; for (const h of hoods) scare(h, true); banner(Tx("Kvart je miran"), Tx`Patrola je završila krug. Huligani ne dolaze ${PATROL.calm} sekundi.`); }
  }
  if (S.calm > 0) S.calm = Math.max(0, S.calm - dt);
  const G = S.gang;
  if (!G.gone) G.rage = Math.max(0, G.rage - dt * .12);
  if (S.phase === "night" && S.night >= GANG_N && S.calm <= 0 && !G.gone) {
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      S.spawnT = Math.max(6, 16 - (S.night - 2) * 1.5) * (60 / Math.max(15, G.presence)) * (1 - G.rage / 200) * (S.unlocked ? .85 : 1) * (S.big ? .5 : 1) / Math.min(2.2, 1 + .3 * BL);
      if (G.rage > 50) {
        G.rage -= 20; spawnHood(true); spawnHood(true);
        if (!S.tips.revenge) tip("revenge", Tx("Banda je besna!"), Tx("Previše si ih terao, pa dolaze u osvetu: po dvojica, brži i jače bacaju. Ako ih opet oteraš, bes i prisustvo im padaju."));
        else msg(Tx("Banda je besna i dolazi da se osveti!"), true);
      } else { let k = 1 + (S.night >= 4 && Math.random() < .3 ? 1 : 0) + (BL >= 2 && Math.random() < Math.min(.5, .12 * BL) ? 1 : 0); while (k--) spawnHood(false); }
    }
  }
  for (const h of hoods) updateHood(h, dt);
  if (S.phase === "night" && S.night >= 2 && dt > 0) { S.thiefT -= dt; if (S.thiefT <= 0) { S.thiefT = rnd(18, 30) * (S.gang.gone ? .8 : 1) * (S.mission && S.mission.type === "thief" && !S.mission.done ? .5 : 1) * (S.big ? .5 : 1); spawnThief(); } }
  for (const t of thieves) updateThief(t, dt);
  if (dt > 0) { updateSensors(dt); updateSpots(dt); updateStorm(dt); }
  if (dt > 0) { updateTraffic(dt); updatePeds(dt); autoDispatch(dt); if (S.tender && (S.tender.type === "park" || S.tender.type === "led")) checkTender(); }
  thieves = thieves.filter(t => !t.gone);
  hoods = hoods.filter(h => !h.gone);
  for (const r of refls) r.t += dt;
  for (const r of rocks) {
    r.t += dt;
    if (r.t >= r.dur) {
      r.done = true; const s = r.slot;
      if (s.lamp && s.lamp.state === "ok") {
        s.lamp.hp -= 1 / (s.lamp.m.armor * (s.lamp.glass ? 2 : 1)); burst(s.x, s.y, "#cfd6e6", 4, 50);
        if (s.lamp.hp <= 0) { s.lamp.state = "broken"; if (S.big) S.bigBroke++;SFX.smash(); S.broken++; if (S.mission && S.mission.type === "nobreak") misFail(Tx("Huligani su razbili lampu.")); S.gang.presence = Math.min(100, S.gang.presence + 3); S.gang.rage = Math.max(0, S.gang.rage - 5); burst(s.x, s.y, "rgb(" + s.lamp.m.col + ")", 22, 110); float(s.x, s.y - 14, Tx("Razbijena!"), "#ff6b5b"); msg(Tx("Huligani su razbili lampu! Dodirni je za popravku."), true); }
      }
    }
  }
  rocks = rocks.filter(r => !r.done);
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; }
  parts = parts.filter(p => p.t < p.life);
  for (const f of floats) f.t += dt; floats = floats.filter(f => f.t < 1.4);
  for (const f of flashes) f.t += dt; flashes = flashes.filter(f => f.t < .5);
  if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0) { const el = $("msg"); el.textContent = ""; el.classList.remove("hot"); } }
  misHint();
}


// ---------- Live traffic: cars drive the streets, use high beams in the dark, honk at hooligans ----------
const CAR_COLS = ["#b8bec7", "#2f4a78", "#7a2e3a", "#4a4f58", "#8c8f94"];   // muted, so the lamps and the van stand out
const CAR_TYPES = ["hatch", "hatch", "hatch", "taxi", "truck", "police"];
function pickCarType() { return S.zInd && Math.random() < .4 ? "truck" : CAR_TYPES[Math.random() * CAR_TYPES.length | 0]; }   // industry bought: more trucks (~50% vs ~17%)
function spawnCar() {
  if (traffic.length >= MAX_CARS) return;
  if (MAP) return spawnCarMap();
  const by = boundY(), vert = Math.random() < .5, dir = Math.random() < .5 ? 1 : -1;
  const type = pickCarType();
  const c = {type, col:type === "taxi" ? "#f2c230" : type === "police" ? "#eef1f6" : type === "truck" ? "#e6e2d6" : CAR_COLS[Math.random() * CAR_COLS.length | 0], sp:rnd(62, 80) * (type === "truck" ? .8 : 1), dir, vert, honked:new Set(), lit:0, n:0};
  if (vert) { const x = VS[Math.random() * VS.length | 0]; c.x = x + (dir > 0 ? -5 : 5); c.y = dir > 0 ? -20 : by + 20; }
  else { const ys = hs(), y = ys[Math.random() * ys.length | 0]; c.y = y + (dir > 0 ? 5 : -5); c.x = dir > 0 ? -20 : W + 20; }
  traffic.push(c);
}
function updateTraffic(dt) {
  S.carT -= dt;
  if (S.carT <= 0) { S.carT = S.phase === "night" ? rnd(5, 9) : rnd(3, 6); spawnCar(); }
  S.honkT = Math.max(0, S.honkT - dt);
  const by = boundY();
  for (const c of traffic) {
    const night = S.phase === "night", lit = !night || litAt(c.x, c.y, LIGHT_K);
    c.dark = night && !lit;
    const sp = c.sp * (c.dark ? .6 : 1) * dt;
    if (c.path) movePath(c, sp); else if (c.vert) c.y += sp * c.dir; else c.x += sp * c.dir;
    if (night) { c.n++; if (lit) c.lit++; }
    if (c.type === "police" && S.phase === "night") for (const h of hoods) if (h.state !== "flee" && Math.hypot(h.x - c.x, h.y - c.y) < 60 && scare(h)) { S.money += 3; S.led.bounty += 3; float(h.x, h.y - 14, Tx("Policija! +3 $"), "#7ed39a", true); }
    for (const h of hoods) if (h.state !== "flee" && !c.honked.has(h) && Math.abs(h.x - c.x) < 24 && Math.abs(h.y - c.y) < 24) {
      c.honked.add(h); h.fear = (h.fear || 0) + .3; float(c.x, c.y - 12, Tx("Biiip!"), "#ffd37a");
      if (S.honkT <= 0) { SFX.honk(); S.honkT = 1; }
    }
    if (c.path ? c.done : c.x < -30 || c.x > W + 30 || c.y < -30 || c.y > by + 30) {
      c.gone = true;
      if (night && c.n > 20 && c.lit / c.n > .8) { S.money += 2; S.led.bounty += 2; S.trafficPay += 2; float(Math.max(20, Math.min(W - 20, c.x)), Math.max(20, Math.min(by - 20, c.y)), Tx("+2 $ putarina"), "#7ed39a"); }
    }
  }
  traffic = traffic.filter(c => !c.gone);
}
// Vehicles as real little boxes: each part is a box turned along the street. Only the walls that face the viewer are drawn,
// lit by the same light as the buildings (light from the upper left, shadow down right), so they look right in both views and all 4 directions.
const nrm = v => { const l = Math.hypot(v.x, v.y) || 1; return {x:v.x / l, y:v.y / l}; };
const VDN = nrm(unproj(0, 1)), LDN = nrm(unproj(-1, .35));   // on the ground: toward the viewer, toward the light
const pxPerU = () => sc * VZ / Math.min(2, window.devicePixelRatio || 1);   // css px per projected unit
function vSize(L) { return Math.min(2.2, Math.max(1, 20 / (2 * L * pxPerU()))); }   // zoomed far out, cars keep a readable size
function smoothAng(o, a) { if (o.va == null || !isFinite(o.va)) o.va = a; let d = a - o.va; d = Math.atan2(Math.sin(d), Math.cos(d)); o.va += d * Math.min(1, .22); return o.va; }   // turn into a corner, don't snap
// One box: length a0..a1 along the car, half width w, from height z0 to z1 (screen units). ti = how much the top is pulled in (a rounded cabin).
// col = body colour; opt.face(i, pts) draws details on a visible wall (i: 0 front, 1 left, 2 rear, 3 right), opt.top(pts) on the roof.
function vBox(x, y, c, s, a0, a1, w, z0, z1, col, opt = {}) {
  const ti = opt.ti || 0, tw = opt.tw != null ? opt.tw : ti;
  const P = (a, b, z) => ({x:x + a * c - b * s + UPV.x * z, y:y + a * s + b * c + UPV.y * z});
  const lo = [P(a1, -w, z0), P(a1, w, z0), P(a0, w, z0), P(a0, -w, z0)];
  const hi = [P(a1 - ti, -w + tw, z1), P(a1 - ti, w - tw, z1), P(a0 + (opt.tr != null ? opt.tr : ti), w - tw, z1), P(a0 + (opt.tr != null ? opt.tr : ti), -w + tw, z1)];
  const N = [{x:c, y:s}, {x:-s, y:c}, {x:-c, y:-s}, {x:s, y:-c}];   // front, left(+b), rear, right(-b)
  const E = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (let i = 0; i < 4; i++) {
    const n = N[i], vis = n.x * VDN.x + n.y * VDN.y; if (vis <= .02) continue;
    const lit = n.x * LDN.x + n.y * LDN.y, [p, q] = E[i], pts = [lo[p], lo[q], hi[q], hi[p]];
    ctx.fillStyle = shade(col, .62 + .26 * lit); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let k = 1; k < 4; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.closePath(); ctx.fill();
    if (opt.face) opt.face(i, pts, vis);
  }
  ctx.fillStyle = opt.roof || shade(col, 1.12); ctx.beginPath(); ctx.moveTo(hi[0].x, hi[0].y); for (let k = 1; k < 4; k++) ctx.lineTo(hi[k].x, hi[k].y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = .7; ctx.stroke();   // light top edge: shows the shape on a dark street
  if (opt.top) opt.top(hi, P);
}
const quadAt = (pts, u0, u1, v0, v1) => { const L = (A, B, t) => ({x:A.x + (B.x - A.x) * t, y:A.y + (B.y - A.y) * t});   // a part of a wall: u along the bottom edge, v up the wall
  const b0 = L(pts[0], pts[1], u0), b1 = L(pts[0], pts[1], u1), t0 = L(pts[3], pts[2], u0), t1 = L(pts[3], pts[2], u1);
  return [L(b0, t0, v0), L(b1, t1, v0), L(b1, t1, v1), L(b0, t0, v1)]; };
const fillQ = (q, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y); ctx.closePath(); ctx.fill(); };
// A whole vehicle. kind: car, taxi, police, truck, van. o = the object (for smooth turning), lights: "off" | "on" | "brake".
function drawVehicle(o, x, y, ang, kind, col, lights, extra) {
  const big = kind === "van" || kind === "truck", L0 = kind === "truck" ? 15 : kind === "van" ? 14 : 10, W0 = kind === "truck" ? 6.5 : kind === "van" ? 7 : 5;
  const G = 1.3, k = G * vSize(L0 * G), L = L0 * k, Wd = W0 * k, a = o ? smoothAng(o, ang) : ang, c = Math.cos(a), s = Math.sin(a), Z = (ISO ? 1.35 : 1) * k;
  // layer 1: soft shadow on the road + wheels
  ctx.save(); ctx.translate(x + SHV.x * 3 * Z, y + SHV.y * 3 * Z); ctx.rotate(a); ctx.fillStyle = "rgba(0,0,0,.42)"; ctx.beginPath(); ctx.roundRect(-L - 1.5, -Wd - 1.5, 2 * L + 3, 2 * Wd + 3, 4 * k); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = "#0d0e12";
  if (Math.abs(-s * VDN.x + c * VDN.y) < .1) for (const sx of [-.6, .62]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.ellipse(L * sx, sy * (Wd - .3 * k), 2.6 * k, 1.5 * k, 0, 0, 6.28); ctx.fill(); }   // wheels on the road only when no side is in view (else the side wheels show, and these peeked out as extra wheels)
  ctx.restore();
  const night = lights !== "off", glass = "#1d2738", glassHi = "#5d7896";
  const wheels = (pts, us = [.2, .8]) => { for (const u of us) { const p = quadAt(pts, u, u, .12, .12)[0], r = 2.3 * Z;   // wheels on the visible sides, lying in the side wall (turn with the car, not flat circles facing the screen)
    ctx.save(); ctx.transform(c * r, s * r, UPV.x * r, UPV.y * r, p.x, p.y); ctx.fillStyle = "#101116"; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.28); ctx.fill(); ctx.fillStyle = "#6b7280"; ctx.beginPath(); ctx.arc(0, 0, .42, 0, 6.28); ctx.fill(); ctx.restore(); } };
  const lamps = (i, pts, vis) => {   // headlights on the front wall, tail lights on the rear wall
    if (i === 0) { const f = night ? "#fff6d0" : "#e9e4cf"; if (night) { ctx.shadowColor = "#fff2b0"; ctx.shadowBlur = 8; } fillQ(quadAt(pts, .08, .26, .35, .75), f); fillQ(quadAt(pts, .74, .92, .35, .75), f); ctx.shadowBlur = 0; }
    if (i === 2) { const f = lights === "brake" ? "#ff2a1f" : night ? "#d3261c" : "#8f1f1a"; if (lights === "brake") { ctx.shadowColor = "#ff2a1f"; ctx.shadowBlur = 8; } fillQ(quadAt(pts, .06, .24, .4, .78), f); fillQ(quadAt(pts, .76, .94, .4, .78), f); ctx.shadowBlur = 0; }
    if (i === 1 || i === 3) wheels(pts);
  };
  if (kind === "truck") {
    const cargo = () => vBox(x, y, c, s, -L, L * .22, Wd, 1.2 * Z, 10 * Z, "#d9d4c6", {face:(i, pts, v) => { if (i === 2) lamps(i, pts, v); if (i === 1 || i === 3) { fillQ(quadAt(pts, .05, .95, .82, .9), "rgba(0,0,0,.18)"); wheels(pts, [.25, .75]); } }});;
    const cab = () => vBox(x, y, c, s, L * .3, L, Wd * .95, 1.2 * Z, 7 * Z, "#3d6fc9", {ti:1.6 * k, tr:0, face:(i, pts) => { if (i === 0) { fillQ(quadAt(pts, .1, .9, .58, .96), glass); lamps(i, pts); } else if (i !== 2) { fillQ(quadAt(pts, i === 1 ? .08 : .5, i === 1 ? .5 : .92, .55, .95), glass); wheels(pts, [.5]); } }});   // cab
    if (c * VDN.x + s * VDN.y > 0) { cargo(); cab(); } else { cab(); cargo(); }   // the nearer part last
    return;
  }
  if (kind === "van") {
    vBox(x, y, c, s, -L, L, Wd, 1.2 * Z, 6 * Z, col, {face:(i, pts, v) => { if (i === 1 || i === 3) { fillQ(quadAt(pts, .08, .92, .5, .78), "#f08a24"); fillQ(quadAt(pts, i === 1 ? .42 : .3, i === 1 ? .7 : .58, .05, .95), "rgba(0,0,0,.12)"); } lamps(i, pts, v); }});   // lower body with the orange stripe and the side door
    vBox(x, y, c, s, -L, L * .78, Wd, 6 * Z, 10 * Z, col, {ti:0, tr:0, tw:.6 * k, face:(i, pts) => { if (i === 0) fillQ(quadAt(pts, .08, .92, .12, .9), glass); else if (i === 1 || i === 3) fillQ(quadAt(pts, i === 1 ? .72 : .08, i === 1 ? .92 : .28, .18, .85), glass); else fillQ(quadAt(pts, .15, .85, .2, .8), "rgba(0,0,0,.2)"); },
      top:(hi, P) => extra && extra(P, 10 * Z, L, Wd, k)});   // tall box with dark glass; ladder, beacon, crane on the roof
    return;
  }
  vBox(x, y, c, s, -L, L, Wd, 1.2 * Z, 4.6 * Z, col, {ti:.4 * k, face:lamps});   // lower body
  vBox(x, y, c, s, -L * .55, L * .35, Wd * .92, 4.6 * Z, 7.6 * Z, col, {ti:1.6 * k, tw:.9 * k, roof:shade(col, 1.22),   // cabin: glass all round, light roof
    face:(i, pts) => { if (i === 1 || i === 3) { fillQ(quadAt(pts, .07, .47, .12, .86), glass); fillQ(quadAt(pts, .53, .93, .12, .86), glass); } else fillQ(quadAt(pts, .06, .94, .1, .88), i === 0 ? glassHi : glass); },   // side windows with a pillar
    top:(hi) => {
      const cx = (hi[0].x + hi[2].x) / 2, cy = (hi[0].y + hi[2].y) / 2;
      if (kind === "taxi") uprightAt(ctx, cx, cy, () => { ctx.fillStyle = night ? "#fff3b0" : "#2c2f38"; if (night) { ctx.shadowColor = "#fff3b0"; ctx.shadowBlur = 8; } ctx.fillRect(cx - 3 * k, cy - 3 * k, 6 * k, 3 * k); ctx.shadowBlur = 0; });
      if (kind === "police") uprightAt(ctx, cx, cy, () => { const on = (performance.now() / 220 | 0) % 2; ctx.fillStyle = "#2b2f3a"; ctx.fillRect(cx - 4.5 * k, cy - 2.6 * k, 9 * k, 2.6 * k);
        ctx.shadowBlur = 10; ctx.fillStyle = ctx.shadowColor = on ? "#4d8bff" : "#7a1a1a"; ctx.fillRect(cx - 4.5 * k, cy - 2.6 * k, 4.3 * k, 2.6 * k); ctx.fillStyle = ctx.shadowColor = on ? "#1a2a6a" : "#ff4d4d"; ctx.fillRect(cx + .2 * k, cy - 2.6 * k, 4.3 * k, 2.6 * k); ctx.shadowBlur = 0; });
    }});
}
const CAR_KIND = {hatch:"car", taxi:"taxi", police:"police", truck:"truck"};
const ZLBL = {};
function zoneLabelAt(k, r, tw) {   // the zone's name goes where no lamp badge sits on it
  const key = k + "|" + Math.round(tw); if (ZLBL[key]) return ZLBL[key];
  const cx = r[0] + r[2] / 2, c = [[cx, r[1] + r[3] - 10], [r[0] + tw / 2 + 8, r[1] + r[3] - 10], [r[0] + r[2] - tw / 2 - 8, r[1] + r[3] - 10], [cx, r[1] + r[3] - 34], [cx, r[1] + 18], [cx, r[1] + r[3] / 2]];
  const free = ([x, y]) => lblFree(x, y, tw / 2);
  return (ZLBL[key] = c.find(free) || c[0]);
}
function drawTraffic() {
  const night = S.phase === "night";
  for (const c of traffic) drawVehicle(c, c.x, c.y, c.path ? c.ang : c.vert ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI), CAR_KIND[c.type] || "car", c.col, night ? (c.dark ? "brake" : "on") : "off");
}

// ---------- Pedestrians: worried in the dark, happy under the lamps ----------
const PED_COLS = ["#e07a5f", "#81b29a", "#f2cc8f", "#a5a6f6", "#9ad1d4", "#e5989b"];
function updatePeds(dt) {
  if (MAP && peds.length < 6 && Math.random() < dt * .35) spawnPedMap();
  else if (!MAP && peds.length < 5 && Math.random() < dt * .35) {
    const by = boundY(), vert = Math.random() < .5, dir = Math.random() < .5 ? 1 : -1, side = Math.random() < .5 ? -17 : 17;
    const p = {vert, dir, col:PED_COLS[Math.random() * PED_COLS.length | 0], sp:rnd(16, 22), bob:Math.random() * 6, mood:0, moodT:0, happy:false, worried:false};
    if (vert) { p.x = VS[Math.random() * VS.length | 0] + side; p.y = dir > 0 ? -8 : by + 8; } else { const ys = hs(); p.y = ys[Math.random() * ys.length | 0] + side; p.x = dir > 0 ? -8 : W + 8; }
    peds.push(p);
  }
  const night = S.phase === "night", by = boundY();
  for (const p of peds) {
    const lit = !night || litAt(p.x, p.y, LIGHT_K), sp = p.sp * (night && !lit ? 1.4 : 1) * dt;   // they hurry through the dark
    if (p.path) movePath(p, sp); else if (p.vert) p.y += sp * p.dir; else p.x += sp * p.dir; p.bob += dt * 9;
    p.moodT = Math.max(0, p.moodT - dt);
    if (night && !lit && !p.worried && p.moodT <= 0) { p.worried = true; p.mood = -1; p.moodT = 2.2; }
    if (night && lit && p.worried && !p.happy) { p.happy = true; p.mood = 1; p.moodT = 2; S.money += 1; S.led.bounty += 1; float(p.x, p.y - 18, "+1", "#7ed39a"); }
    if (p.path ? p.done : p.x < -12 || p.x > W + 12 || p.y < -12 || p.y > by + 12) p.gone = true;
  }
  peds = peds.filter(p => !p.gone);
}
function drawPeds() {
  for (const p of peds) {
    const yb = Math.sin(p.bob) * .8;
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 4, 3.5, 1.6, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y + yb, 3.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#f1d3b3"; ctx.beginPath(); ctx.arc(p.x, p.y - 3.5 + yb, 2, 0, 6.28); ctx.fill();
    if (p.moodT > 0) {   // emotion bubble
      const bx = p.x, bY = p.y - 15;
      ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.arc(bx, bY, 6, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx - 2, bY + 4); ctx.lineTo(bx, bY + 8); ctx.lineTo(bx + 2, bY + 4); ctx.fill();
      ctx.font = "800 10px Barlow, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = p.mood > 0 ? "#e11d48" : "#475569"; ctx.fillText(p.mood > 0 ? "♥" : "?", bx, bY + 3.5);
    }
  }
}

// ---------- Motion sensors: zero power until someone comes near, then full light that scares hooligans ----------
function updateSensors(dt) {
  const night = S.phase === "night";
  for (const s of slots) {
    const L = s.lamp; if (!L || !L.sensor || !avail(s)) continue;
    if (L.wake > 0) L.wake -= dt; if (L.cd > 0) L.cd -= dt;
    if (!night || L.state !== "ok") continue;
    const R = L.m.r * LIGHT_K * (S.weather === "fog" ? FOG_K : 1), near = o => Math.hypot(o.x - s.x, o.y - s.y) < R;
    const hood = hoods.find(h => h.state !== "flee" && near(h)), thief = thieves.find(near);
    if (hood || thief || peds.some(near) || traffic.some(near)) { if (!(L.wake > 0) && (hood || thief)) burst(s.x, s.y, "#fff3c4", 6, 40); L.wake = 3; }
    if (hood && L.powered && !(L.cd > 0) && scare(hood)) { L.cd = 2; S.money += 3; S.led.bounty += 3; SFX.coin(); float(hood.x, hood.y - 14, Tx("Senzor! +3 $"), "#7ed39a", true); }
  }
}
// ---------- Kiosk and bus stop: steady bonus when lit at night ----------
function updateSpots(dt) {
  if (MAP) updateLandmarks(dt);
  for (const o of SPOTS) {
    o.lit = S.phase === "night" && litAt(o.x, o.y, LIGHT_K, true);
    if (o.lit) { const v = spotRate() * dt; S.money += v; S.led.obj += v; o.acc = (o.acc || 0) + v; if (o.acc >= 5) { o.acc -= 5; float(o.x, o.y - 16, "+5 $", "#7ed39a"); } }
  }
}
// ---------- Storm: lightning and short circuits on worn or damaged lamps ----------
function updateStorm(dt) {
  if (S.lightning > 0) S.lightning = Math.max(0, S.lightning - dt);
  if (S.weather !== "storm" || S.phase !== "night") return;
  S.stormT -= dt; if (S.stormT > 0) return;
  S.stormT = rnd(6, 11); S.lightning = .35;
  const weak = slots.filter(s => isOn(s) && (s.lamp.life < .5 || s.lamp.hp < LAMP_HP));
  if (!weak.length || Math.random() < .35) return;
  const s = weak[Math.random() * weak.length | 0];
  s.lamp.state = "broken"; SFX.smash(); burst(s.x, s.y, "#bfe3ff", 20, 120); float(s.x, s.y - 14, Tx("Kratki spoj!"), "#ff6b5b", true);
  msg(Tx("Oluja: kratki spoj na staroj lampi! Drži lampe iznad 50% veka."), true);
}
// ---------- Lamp add-ons and "fix everything" ----------
function armAddon(kind) {
  const c = kind === "sensor" ? SENSOR_COST : GLASS_COST;
  if (S.money < c) { msg(Tx`Treba ti ${c} $.`, true); SFX.err(); return; }
  setTool(null); S.addon = kind; setShop(false);
  msg(kind === "sensor" ? Tx`Dodirni lampu da ugradiš senzor pokreta (${c} $).` : Tx`Dodirni lampu da staviš ojačano staklo (${c} $).`);
}
function applyAddon(s) {
  const kind = S.addon; S.addon = null; const L = s.lamp, c = kind === "sensor" ? SENSOR_COST : GLASS_COST;
  if (!L) { msg(Tx("Tu nema lampe. Dodatak ide na postojeću lampu."), true); return; }
  if (L[kind]) { msg(kind === "sensor" ? Tx("Ova lampa već ima senzor.") : Tx("Ova lampa već ima ojačano staklo.")); return; }
  if (S.money < c) { msg(Tx`Treba ti ${c} $.`, true); SFX.err(); return; }
  S.money -= c; S.led.buy += c; L[kind] = true; if (kind === "glass") L.hp = Math.max(L.hp, LAMP_HP);
  SFX.buy(); burst(s.x, s.y, kind === "sensor" ? "#fff3c4" : "#9fd8ff", 14, 60); float(s.x, s.y - 14, kind === "sensor" ? Tx`Senzor −${c} $` : Tx`Staklo −${c} $`, "#ff9d8f");
  msg(kind === "sensor" ? Tx("Senzor ugrađen: lampa ne troši struju dok niko ne prođe, a huligane odmah plaši.") : Tx("Ojačano staklo: svetiljka sad trpi duplo više kamenica.")); save();
}
function fixList() {
  return slots.filter(s => s.lamp && !s.job && avail(s) && (s.lamp.state !== "ok" || s.lamp.life < .2)).map(s => {
    const L = s.lamp, cost = L.state === "broken" ? repairCost(L.m) + (L.life <= .05 ? bulbCost(L.m) : 0) : bulbCost(L.m);
    return {s, type:L.state === "broken" ? "repair" : "bulb", cost};
  });
}
function fixAll() {
  const list = fixList(); if (!list.length) { msg(Tx("Sve lampe su ispravne.")); return; }
  let n = 0, spent = 0;
  for (const f of list) {
    if (S.money < f.cost) break;
    S.money -= f.cost; S.led.buy += f.cost; spent += f.cost; n++;
    const j = {slot:f.s, type:f.type, m:f.s.lamp.m, assigned:false, wb:f.type === "repair" && f.s.lamp.life <= .05}; f.s.job = j; jobs.push(j);
  }
  if (!n) { msg(Tx`Nemaš dovoljno novca ni za prvu popravku (${list[0].cost} $).`, true); SFX.err(); return; }
  SFX.buy(); msg(n < list.length ? Tx`Servis kreće na ${n} od ${list.length} lampi (−${spent} $). Za ostale fali novca.` : Tx`Servis kreće na sve lampe: ${n} (−${spent} $).`, n < list.length); save();
}
// ---------- Dawn report card ----------
function showDawn() {
  const D = S.dawn, el = document.getElementById("dawn"); if (!D || !el) return;
  const r = v => Math.round(v);
  el.querySelector(".dn-t").textContent = Tx`Svanulo! Noć ${D.night} je prošla`;
  el.querySelector(".dn-rows").innerHTML = D.rows.map(([k, v]) => Tx`<div class="dn-r"><span>${k}</span><b class="${v >= 0 ? "pos" : "neg"}">${v >= 0 ? "+" : "−"}${Math.abs(r(v))} $</b></div>`).join("") +
    Tx`<div class="dn-r dn-sum"><span>Ukupno</span><b class="${D.net >= 0 ? "pos" : "neg"}">${D.net >= 0 ? "+" : "−"}${Math.abs(D.net)} $</b></div>`;
  el.querySelector(".dn-notes").innerHTML = [...D.notes, Tx`Danas stanari daju još oko ${D.day} $.`].map(t => Tx`<li>${t}</li>`).join("");
  el.hidden = false;
}

// ---------- Auto-dispatch: the crew goes out on its own to fix broken and burnt lamps ----------
function autoDispatch(dt) {
  if (!S.dispatch || S.dispOff) return;
  S.dispT -= dt; if (S.dispT > 0) return; S.dispT = 1.5;
  const s = slots.find(s => s.lamp && !s.job && avail(s) && (s.lamp.state === "broken" || s.lamp.state === "burnt"));
  if (!s) return;
  const L = s.lamp, cost = L.state === "broken" ? repairCost(L.m) + (L.life <= .05 ? bulbCost(L.m) : 0) : bulbCost(L.m);
  if (S.money < cost + 20) return;   // keep a small reserve
  order(s, L.state === "broken" ? "repair" : "bulb", L.m, cost);
  msg(Tx`Auto-dispečing: servis sam kreće na ${L.state === "broken" ? "popravku" : Tx("zamenu sijalice")} (${cost} $).`);
}

// ---------- City tenders: multi-day goals with a big payout ----------
function newTender() {
  const parkSlots = slots.filter(s => s.zone === "park");
  const opts = [
    {type:"park", text:Tx("Osvetli ceo park fenjerima"), n:parkSlots.length},
    {type:"led", text:Tx("Postavi 6 lampi sa LED čip sijalicom"), n:6},
    {type:"cover", text:Tx("Dve noći završi sa 90% osvetljenog kvarta"), n:2},
    {type:"safe", text:Tx("Dve noći bez ijedne krađe"), n:2},
  ];
  const o2 = opts.filter(o => o.n > 0), t = o2[Math.random() * o2.length | 0];
  const reward = Math.round((300 + 25 * S.night) * (1 + S.rep / 100) * (stars() >= 3 ? 1.15 : 1) / 10) * 10;
  return Object.assign(t, {prog:0, until:S.night + 3, reward, adv:Math.round(reward * .3 / 10) * 10, pen:Math.round(reward * .8 / 10) * 10});
}
function tenderProgress() {
  const T = S.tender; if (!T) return 0;
  if (T.type === "park") return slots.filter(s => s.zone === "park" && s.lamp && s.lamp.state === "ok" && s.lamp.m.f.id === "fe").length;
  if (T.type === "led") return slots.filter(s => s.lamp && s.lamp.state === "ok" && s.lamp.m.b.id === "led").length;
  return T.prog;
}
function tenderText(T) { return T ? Tx`${T.text} (${Math.min(tenderProgress(), T.n)}/${T.n}) do noći ${T.until} · +${T.reward} $${T.pen ? Tx` · penal −${T.pen} $` : ""}` : ""; }
function checkTender() {
  const T = S.tender; if (!T) return;
  if (tenderProgress() >= T.n) {
    S.money += T.reward; S.led.bounty += T.reward; S.rep = Math.min(100, S.rep + 8); S.tender = null; S.tenderCd = 2;
    SFX.win(); banner(Tx("Tender ispunjen!"), Tx`Grad isplaćuje +${T.reward} $. Reputacija firme raste.`);
  }
}

// ---------- Reputation: grows with good nights, falls with thefts and failures ----------
function repStep(cover) {
  let d = 0;
  if (cover > .8) d += 4; else if (cover < .5) d -= 3;
  d += S.nightTheft ? -2 * S.nightTheft : 2;
  if (S.mission) d += S.mission.done ? 3 : S.mission.fail ? -4 : 0;
  S.rep = Math.max(0, Math.min(100, S.rep + d)); S.nightTheft = 0;
  return d;
}
const repDiscount = () => S.rep / 500;   // up to 20% cheaper power

// ---------- Night missions: one goal per night, big reward, penalty on failure ----------
function misReward() { return Math.round(Math.max(50 + 10 * S.night, .35 * (S.lastPay || 0)) / 10) * 10; }
function newMission() {
  if (S.night < GANG_N) return null;
  const types = ["thief", "house", "nobreak"];
  if (!S.gang.gone) types.push("scare", "scare");
  if (S.load > .7 && S.load <= .86) types.push("load", "load");
  const type = types[Math.random() * types.length | 0], m = {type, prog:0, n:0, over:0, done:false, fail:false, reward:misReward()};
  if (type === "thief") m.n = 2 + Math.floor(S.night / 5);
  if (type === "scare") m.n = 4 + Math.floor(S.night / 3);
  if (type === "house") {
    const hs = houses.filter(h => hOn(h) && !h.fac && h.y > 120), dark = hs.filter(h => !litAt(h.cx, h.y + h.h + 5, LIGHT_K));
    const pick = (dark.length ? dark : hs); m.house = pick[Math.random() * pick.length | 0].id;
  }
  return m;
}
function misText(m) {
  if (!m) return "";
  const t = m.type === "thief" ? Tx`uhvati ${m.n} lopova (${m.prog}/${m.n})` : m.type === "scare" ? Tx`oteraj ${m.n} huligana (${m.prog}/${m.n})`
    : m.type === "house" ? Tx("čuvaj kuću ČUVAJ do zore") : m.type === "nobreak" ? Tx("nijedna razbijena lampa") : Tx`generator ispod 86% (${Math.round(m.over)}/3 s)`;
  return m.done ? Tx`Misija uspela! +${m.reward} $` : m.fail ? Tx("Misija propala.") : Tx`Misija: ${t} · +${m.reward} $`;
}
function misWin() {
  const m = S.mission; if (!m || m.done || m.fail) return;
  m.done = true; S.money += m.reward; SFX.win(); S.led.bounty += m.reward;
  burst(W / 2, 120, "#7ed39a", 30, 140); banner(Tx("Misija uspela!"), Tx`+${m.reward} $ nagrade.`);
}
function misFail(why) {
  const m = S.mission; if (!m || m.done || m.fail) return;
  m.fail = true; SFX.fail(); const pen = Math.min(Math.floor(S.money), Math.round(m.reward * .4)); S.money -= pen; S.led.mis = (S.led.mis || 0) + pen;
  banner(Tx("Misija propala!"), Tx`${why} Kazna −${pen} $.`);
}
function misProg(type) { const m = S.mission; if (!m || m.done || m.fail || m.type !== type) return; m.prog++; if (m.prog >= m.n) misWin(); }
function misHint() {
  if (S.msgT <= 0 && S.phase === "day" && S.tender) { const el = $("msg"), t = Tx("Tender: ") + tenderText(S.tender); if (el.textContent !== t) { el.textContent = t; el.classList.remove("hot"); } return; } const el = $("msg"); if (S.msgT <= 0 && S.phase === "night" && S.mission) { const t = misText(S.mission); if (el.textContent !== t) { el.textContent = t; el.classList.toggle("hot", !S.mission.done && !S.mission.fail); } } }

// ---------- Thieves: they rob dark houses and cars, light catches them ----------
function edgeFor(t) { const by = boundY(), o = [{x:-20, y:t.y, d:t.x}, {x:W + 20, y:t.y, d:W - t.x}, {x:t.x, y:-20, d:t.y}, {x:t.x, y:by + 20, d:by - t.y}]; return o.sort((a, b) => a.d - b.d)[0]; }
function spawnThief() {
  const targets = [...houses.filter(hOn).map(h => ({kind:"house", ref:h, x:h.cx, y:h.y + h.h + 5})), ...CARS.filter(c => !c.gone).map(c => ({kind:"car", ref:c, x:c.x + (c.v ? 14 : 0), y:c.y + (c.v ? 0 : 12)}))];
  for (const o of SPOTS) for (let k = 0; k < 3; k++) targets.push({kind:"spot", ref:o, x:o.x, y:o.y + 10});   // three times as likely
  const dark = targets.filter(g => !litAt(g.x, g.y, LIGHT_K));
  if(!dark.length && Math.random() > 0.4) return;
  const list = dark.length ? dark : targets; 
  const mh = S.mission && S.mission.type === "house" && !S.mission.fail ? targets.find(g => g.kind === "house" && g.ref.id === S.mission.house) : null;
  const g = mh && Math.random() < .5 ? mh : list[Math.random() * list.length | 0], by = boundY(), side = Math.random() * 4 | 0;
  const p = side === 0 ? {x:-12, y:rnd(30, by - 30)} : side === 1 ? {x:W + 12, y:rnd(30, by - 30)} : side === 2 ? {x:rnd(30, W - 30), y:-12} : {x:rnd(30, W - 30), y:by + 12};
  const th = {x:p.x, y:p.y, g, state:"go", work:0, seen:0, sp:rnd(44, 54), bob:0, loot:0, rep:0}; thieves.push(th);
  if (subsidy()) { th.rep = 5; msg(Tx`Stanari javljaju: lopov ulazi u kvart sa ${["zapada", "istoka", "severa", "juga"][side]}!`, true); }
  if (!S.tips.thief) tip("thief", Tx("Lopov u kvartu!"), Tx("Lopovi obijaju mračne stanove i kradu kola. Svetlo ih hvata: ako lopov stoji u svetlu, uhvaćen je i dobijaš nagradu. Možeš ga i dodirnuti."));
}
function catchThief(t, how) {
  SFX.catch();
  t.gone = true; recInc("thieves"); const prize = THIEF.reward + t.loot;
  S.money += prize; S.led.bounty += THIEF.reward; misProg("thief"); if (t.loot) S.led.theft = Math.max(0, S.led.theft - t.loot);
  burst(t.x, t.y, "#f1c453", 16, 80); float(t.x, t.y - 14, Tx`Lopov uhvaćen! +${prize} $`, "#7ed39a", true);
  msg(how === "tap" ? Tx`Uhvatio si lopova! +${prize} $` : Tx`Svetlo je otkrilo lopova, uhvaćen je! +${prize} $`);
}
function updateThief(t, dt) {
  t.bob += dt * 10;
  if (t.rep > 0) t.rep -= dt;
  if (litAt(t.x, t.y, LIGHT_K)) { t.seen += dt; if (t.seen > (S.weather === "fog" ? 1.8 : 1.1)) { catchThief(t); return; } } else t.seen = Math.max(0, t.seen - dt);
  if (t.state === "go") {
    if (t.g.kind === "car" && t.g.ref.gone) { t.state = "flee"; t.exit = edgeFor(t); return; }
    if (moveTo(t, t.g.x, t.g.y, t.sp, dt)) t.state = "work";
  } else if (t.state === "work") {
    t.work += dt;
    if (t.work >= THIEF.work) {
      SFX.alarm(); S.nightTheft++; S.tenderTheft = (S.tenderTheft || 0) + 1; const loot = Math.min(Math.floor(S.money), THIEF.steal); S.money -= loot; S.led.theft += loot; t.loot = loot;
      if (t.g.kind === "house") { t.g.ref.sat = Math.max(0, t.g.ref.sat - .3); float(t.x, t.y - 14, Tx`Obijen stan! −${loot} $`, "#ff6b5b", true); msg(Tx`Lopov je obio stan u mraku! −${loot} $. Osvetli tu kuću.`, true); if (S.mission && S.mission.type === "house" && S.mission.house === t.g.ref.id) misFail(Tx("Lopov je obio kuću koju si čuvao.")); }
      else if (t.g.kind === "spot") { float(t.x, t.y - 14, Tx`Opljačkana ${t.g.ref.name.toLowerCase()}! −${loot} $`, "#ff6b5b", true); msg(Tx`Lopov je opljačkao: ${t.g.ref.name}. Osvetli je noću!`, true); }
      else { t.g.ref.gone = true; float(t.x, t.y - 14, Tx`Ukradena kola! −${loot} $`, "#ff6b5b", true); msg(Tx`Lopov je ukrao kola iz mraka! −${loot} $`, true); }
      t.state = "flee"; t.exit = edgeFor(t);
    }
  } else if (t.state === "flee") {
    moveTo(t, t.exit.x, t.exit.y, t.sp * 1.5, dt);
    if (t.x < -10 || t.x > W + 10 || t.y < -10 || t.y > boundY() + 10) t.gone = true;
  }
}
function spawnHood(rev) {
  let list = routesNow().filter(routeOpen);
  if (!list.length) {
    if (!rev) { S.gang.presence = Math.max(0, S.gang.presence - 1); msg(Tx("Huligani nemaju kuda da prođu. Banda slabi.")); checkGone(); return null; }
    list = routesNow();
  }
  const r = list[Math.random() * list.length | 0];
  const h = {x:BASE.x, y:r.pts[0][1] + rnd(-6, 6), path:r.pts.map(([x, y]) => ({x, y})), i:1, route:r.id, sp:rnd(34, 46) * (rev ? 1.25 : 1) * (1 + .1 * (S.gang.lv - 1)), fear:0, state:"walk",
    target:null, sx:0, sy:0, throwT:0, look:.5, attacks:0, maxAtt:rev ? 3 : 2, rev:!!rev, bob:Math.random() * 6};
  hoods.push(h); return h;
}
function pickTarget(h) {
  let best = null, bs = 1e9, spot = null;
  for (const s of slots) {
    if (!isLit(s) || Math.hypot(s.x - h.x, s.y - h.y) > 190) continue;
    const R = lr(s) * LIGHT_K + 10 + 25 * (S.gang.lv - 1);   // stronger gangs throw from farther away
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * 6.283, x = s.x + Math.cos(a) * R, y = s.y + Math.sin(a) * R;
      if (x < 6 || x > W - 6 || y < 6 || y > boundY() - 6 || litAt(x, y, LIGHT_K) || inZone(x, y)) continue;
      const sc2 = Math.hypot(x - h.x, y - h.y) + Math.random() * 80 - (SPOTS.some(o => Math.hypot(o.x - s.x, o.y - s.y) < 110) ? 70 : 0);
      if (sc2 < bs) { bs = sc2; best = s; spot = {x, y}; }
    }
  }
  if (best) { h.target = best; h.state = "seek"; h.sx = spot.x; h.sy = spot.y; }
}
function moveTo(h, x, y, sp, dt) { const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy); if (d < 2) return true; const st = Math.min(d, sp * dt); h.x += dx / d * st; h.y += dy / d * st; h.bob += dt * 10; return false; }
function updateHood(h, dt) {
  if (h.state !== "flee") {
    if (litAt(h.x, h.y, LIGHT_K)) h.fear += dt * (h.rev ? .7 : 1); else h.fear = Math.max(0, h.fear - dt * .6);
    if (h.fear > Math.min(1.6, .75 + .3 * (S.gang.lv - 1)) && scare(h)) { S.money += 3; SFX.coin(); S.led.bounty += 3; recInc("hoods"); float(h.x, h.y - 14, Tx("Svetlo ga oteralo! +3 $"), "#7ed39a", true); msg(Tx("Svetlo je oteralo huligana. +3 $ Tuda više ne prolaze.")); return; }
  }
  if (h.state === "walk") {
    const q = h.path[h.i];
    if (!q) { h.gone = true; return; }
    if (moveTo(h, q.x, q.y, h.sp, dt) && ++h.i >= h.path.length) { h.gone = true; return; }
    h.look -= dt;
    if (h.look <= 0 && h.attacks < h.maxAtt && h.x > 0) { h.look = .6; pickTarget(h); }
  } else if (h.state === "seek") {
    if (!isLit(h.target)) { h.state = "walk"; return; }
    if (moveTo(h, h.sx, h.sy, h.sp, dt)) { h.state = "throw"; h.throwT = .5; }
  } else if (h.state === "throw") {
    if (!isLit(h.target)) { h.attacks++; h.state = "walk"; h.look = 1.5; return; }
    h.throwT -= dt;
    if (h.throwT <= 0) { h.throwT = 1.5 * (1 - S.gang.rage / 250) * (h.rev ? .75 : 1); rocks.push({x:h.x, y:h.y, tx:h.target.x, ty:h.target.y, t:0, dur:.35, slot:h.target}); }
  } else if (h.state === "flee") {
    moveTo(h, BASE.x - 10, h.fy, h.sp * 1.9, dt);
    if (h.x < -12) h.gone = true;
  }
}

// ---------- Render ----------
function face(x, y, mood) {
  ctx.fillStyle = mood > 0 ? "#7ed39a" : mood < 0 ? "#ff6b5b" : "#c9cfdb";
  ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.28); ctx.fill();
  ctx.fillStyle = "#10131c"; ctx.fillRect(x - 3, y - 2.5, 1.6, 1.6); ctx.fillRect(x + 1.4, y - 2.5, 1.6, 1.6);
  ctx.strokeStyle = "#10131c"; ctx.lineWidth = 1.2; ctx.beginPath();
  if (mood > 0) ctx.arc(x, y + .5, 2.6, .2, Math.PI - .2); else if (mood < 0) ctx.arc(x, y + 4, 2.6, Math.PI + .3, -.3); else { ctx.moveTo(x - 2.5, y + 2); ctx.lineTo(x + 2.5, y + 2); }
  ctx.stroke();
}
function lampHead(s, col, lit) { uprightAt(ctx, s.x, s.y, () => lampHead0(s, col, lit)); }
function lampHead0(s, col, lit) {
  if (s.lamp.m.style === "moderna" && s.lamp.m.kind !== "park") {
    ctx.fillStyle = lit ? col : "#6b6f7a"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(s.x - 6, s.y - 2.5, 12, 5, 2) : ctx.rect(s.x - 6, s.y - 2.5, 12, 5); ctx.fill();
  } else if (s.lamp.m.style === "klasična" && s.lamp.m.kind !== "park") {
    ctx.fillStyle = lit ? col : "#6b6f7a"; ctx.beginPath(); ctx.arc(s.x, s.y, lit ? 4.5 : 4, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#2a2d35"; ctx.beginPath(); ctx.moveTo(s.x - 6, s.y - 3); ctx.lineTo(s.x + 6, s.y - 3); ctx.lineTo(s.x, s.y - 7); ctx.closePath(); ctx.fill();
  } else if (s.lamp.m.kind === "park") {
    ctx.fillStyle = lit ? col : "#5a5f6b"; ctx.fillRect(s.x - 3.5, s.y - 4, 7, 8);
    ctx.fillStyle = "#2a2d35"; ctx.beginPath(); ctx.moveTo(s.x - 5, s.y - 4); ctx.lineTo(s.x + 5, s.y - 4); ctx.lineTo(s.x, s.y - 8); ctx.closePath(); ctx.fill();
  } else { ctx.fillStyle = lit ? col : "#6b6f7a"; ctx.beginPath(); ctx.arc(s.x, s.y, lit ? 4.5 : 4, 0, 6.28); ctx.fill(); }
}
function tenderLamp(s) {
  const T = S.tender; if (!T || !s.lamp || s.lamp.state !== "ok") return false;
  return T.type === "park" ? s.zone === "park" && s.lamp.m.f.id === "fe" : T.type === "led" ? s.lamp.m.b.id === "led" : false;
}
function drawSpots() {
  const night = S.phase === "night";
  for (const o of SPOTS) {
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(-9, -5, 20, 14);
    if (o.id === "kiosk") {
      ctx.fillStyle = "#3d6fc9"; ctx.fillRect(-7, -6, 14, 12);
      ctx.fillStyle = o.lit || !night ? "#fff1b8" : "#3a3f4f"; ctx.fillRect(-5, -2, 10, 5);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? "#f4f4f4" : "#e04848"; ctx.fillRect(-8 + i * 4, -9, 4, 4); }
    } else {
      ctx.fillStyle = "#58607a"; ctx.fillRect(-12, -4, 24, 7);
      ctx.fillStyle = o.lit || !night ? "rgba(190,225,255,.85)" : "rgba(70,90,120,.8)"; ctx.fillRect(-10, -3, 20, 3);
      ctx.fillStyle = "#2f80ed"; ctx.fillRect(12, -10, 6, 6); ctx.fillStyle = "#fff"; ctx.font = "800 5px Barlow, sans-serif"; ctx.textAlign = "center"; ctx.fillText("B", 15, -5.5);
    }
    ctx.restore();
    if (night) { ctx.font = "700 10px Barlow, sans-serif"; ctx.textAlign = "center"; const t = o.lit ? "$" : "?", c = o.lit ? "#7ed39a" : "#ff9d8f";
      ctx.fillStyle = "rgba(8,10,20,.8)"; ctx.beginPath(); ctx.arc(o.x - 14, o.y - 12, 6, 0, 6.28); ctx.fill(); ctx.fillStyle = c; ctx.fillText(t, o.x - 14, o.y - 8.5); }
  }
}
const FOG = Array.from({length:7}, (_, i) => ({x:Math.random() * 620, y:Math.random() * 1000, r:140 + Math.random() * 120, v:6 + Math.random() * 8}));
const RAIN = Array.from({length:70}, () => ({x:Math.random() * 620, y:Math.random() * 1000, v:520 + Math.random() * 200}));
let wxT = performance.now();
function drawWeather() {
  const now = performance.now(), dt = Math.min(.05, (now - wxT) / 1000); wxT = now;
  if (S.phase !== "night" || !S.weather) return;
  const by = boundY();
  if (S.weather === "fog") {
    for (const f of FOG) {
      f.x += f.v * dt; if (f.x - f.r > W) f.x = -f.r;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); g.addColorStop(0, "rgba(170,180,200,.22)"); g.addColorStop(1, "rgba(170,180,200,0)");
      ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
  } else {
    ctx.strokeStyle = "rgba(170,200,255,.35)"; ctx.lineWidth = 1; ctx.beginPath();
    for (const d of RAIN) { d.y += d.v * dt; d.x -= d.v * .2 * dt; if (d.y > by) { d.y = -10; d.x = Math.random() * (W + 100); } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + 12); }
    ctx.stroke();
    if (S.lightning > 0) { ctx.fillStyle = `rgba(220,230,255,${S.lightning * 1.2})`; ctx.fillRect(0, 0, W, by); }
  }
}
function drawGen() { if (!MAP) return drawGen0(); ctx.save(); ctx.translate(GOFF.x, GOFF.y); drawGen0(); ctx.restore(); }
function drawGen0() {
  const n = S.genLv + 1;
  for (let i = 0; i < n; i++) { ctx.fillStyle = "#59627a"; ctx.fillRect(11 + i * 9.5, 164, 7, 8); ctx.fillStyle = "#7d879e"; ctx.fillRect(11 + i * 9.5, 164, 7, 2); }
  if (S.solar) { ctx.fillStyle = "#1f3f78"; ctx.fillRect(6, 100, 46, 10); ctx.strokeStyle = "#7fa6e8"; ctx.lineWidth = 1; for (let x = 6; x <= 52; x += 11.5) { ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x, 110); ctx.stroke(); } }
  for (let i = 0; i < (S.trafo || 0); i++) { const x = 8 + i * 15, y = 197; ctx.fillStyle = "#4d5566"; ctx.fillRect(x, y, 13, 13); ctx.fillStyle = "#f1c453"; ctx.beginPath(); ctx.moveTo(x + 7.5, y + 2); ctx.lineTo(x + 3.5, y + 7.5); ctx.lineTo(x + 6.5, y + 7.5); ctx.lineTo(x + 5.5, y + 11.5); ctx.lineTo(x + 9.5, y + 6); ctx.lineTo(x + 6.5, y + 6); ctx.closePath(); ctx.fill(); }
  if (S.ups) { const k = S.upsCharge / UPS_SEC; ctx.fillStyle = "#222"; ctx.fillRect(40, 122, 9, 15); ctx.fillStyle = k > .3 ? "#7ed39a" : "#ff6b5b"; ctx.fillRect(41, 136 - 13 * k, 7, 13 * k); }
  const L = S.load, t = performance.now();
  const col = S.trip > 0 || S.genHp <= 0 ? "#ff3b30" : L > 1 ? ((t / 120 | 0) % 2 ? "#ff3b30" : "#5a1410") : L > .85 ? ((t / 400 | 0) % 2 ? "#ffb02e" : "#5a3a10") : "#58d68d";
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(16, 127, 4, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0;
  if (S.phase === "night" && (L > 1 || S.trip > 0) && Math.random() < .25) burst(rnd(12, 46) + GOFF.x, rnd(120, 160) + GOFF.y, "#ffd37a", 2, 60);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#05070f"; ctx.fillRect(0, 0, cv.width, cv.height);
  { const k = VZ / bgV.z, ox = (bgV.x - VX) * sc * VZ - cv.width * BGM * k, oy = (bgV.y - VY) * sc * VZ - cv.height * BGM * k;   // copy only the part of the map picture that is on the screen
    const sx = Math.max(0, -ox / k), sy = Math.max(0, -oy / k), sw = Math.min(bg.width - sx, cv.width / k + 1), sh = Math.min(bg.height - sy, cv.height / k + 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); if (sw > 0 && sh > 0) ctx.drawImage(bg, sx, sy, sw, sh, ox + sx * k, oy + sy * k, sw * k, sh * k); }   // stretched for a moment while zooming, redrawn sharp right after
  VT(ctx);
  for (const s of slots) {
    if (!avail(s)) continue;
    if (!s.lamp) { ctx.strokeStyle = s.zone === "park" ? "rgba(255,200,130,.5)" : "rgba(200,210,230,.28)"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, 6.28); ctx.stroke(); ctx.setLineDash([]); continue; }
    const pb = {x:s.x - UPV.x * 6.5, y:s.y - UPV.y * 6.5};   // foot of the post, straight below the lamp on the screen
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pb.x + SHV.x * 9, pb.y + SHV.y * 9); ctx.stroke();   // post shadow on the ground
    uprightAt(ctx, pb.x, pb.y, () => { ctx.strokeStyle = "#5a606c"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pb.x, pb.y - 6.5); ctx.stroke(); });
    ctx.fillStyle = "#4a4f5c"; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, 6.28); ctx.fill();
  }
  for (const r of refls) { // tripod
    ctx.strokeStyle = "#7a8496"; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 6, r.y + 7); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + 6, r.y + 7); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + 8); ctx.stroke();
  }
  for (const h of hoods) uprightAt(ctx, h.x, h.y, () => {   // hooligans: a standing figure in a red hoodie with a light outline, never smaller than about 22 px
    const b = Math.sin(h.bob) * 1.2, k = Math.max(1.5, 22 / (20 * pxPerU())), x = h.x, y = h.y;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(1.5, 4, 7, 2.6, 0, 0, 6.28); ctx.fill();   // shadow
    if (S.phase === "night") { ctx.fillStyle = "rgba(255,70,60,.18)"; ctx.beginPath(); ctx.arc(0, -6 + b, 12, 0, 6.28); ctx.fill(); }
    ctx.lineWidth = .8; ctx.strokeStyle = "rgba(255,225,215,.8)";
    ctx.fillStyle = "#1c1d24"; ctx.beginPath(); ctx.roundRect(-3.6, -3 + b, 3, 7, 1.2); ctx.roundRect(.6, -3 + b, 3, 7, 1.2); ctx.fill();   // legs
    ctx.fillStyle = "#e0343e"; ctx.beginPath(); ctx.roundRect(-5.5, -11 + b, 11, 10, 3.5); ctx.fill(); ctx.stroke();   // hoodie
    ctx.fillStyle = "#b8242d"; ctx.beginPath(); ctx.arc(0, -14 + b, 4.6, 0, 6.28); ctx.fill(); ctx.stroke();   // hood
    ctx.fillStyle = "#1b1c22"; ctx.beginPath(); ctx.arc(.8, -13.4 + b, 2.6, 0, 6.28); ctx.fill();   // dark face
    ctx.restore();
  });
  for (const c of CARS) {
    if (c.gone || (c.y > boundY())) continue;
    drawVehicle(null, c.x, c.y, c.ang != null ? c.ang : c.v ? Math.PI / 2 : 0, "car", c.col, "off");   // parked cars
  }
  for (const t of thieves) uprightAt(ctx, t.x, t.y, () => {   // the thief from the title picture: striped shirt, black beanie and mask, a sack of loot
    const b = Math.sin(t.bob) * 1.1, k = Math.max(1.5, 22 / (20 * pxPerU()));
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(k, k); ctx.strokeStyle = "rgba(255,240,200,.8)"; ctx.lineWidth = .8;
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(1.5, 4, 8, 2.6, 0, 0, 6.28); ctx.fill();   // shadow
    ctx.fillStyle = "#1c1d24"; ctx.beginPath(); ctx.roundRect(-3.6, -3 + b, 3, 7, 1.2); ctx.roundRect(.6, -3 + b, 3, 7, 1.2); ctx.fill();   // legs
    ctx.fillStyle = "#8a6a3c"; ctx.beginPath(); ctx.arc(6.5, -4 + b, 4.2, 0, 6.28); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#6b5030"; ctx.fillRect(5.6, -9.2 + b, 1.8, 2);   // sack on his back
    ctx.save(); ctx.beginPath(); ctx.roundRect(-5.5, -11 + b, 11, 10, 3.5); ctx.clip(); ctx.fillStyle = "#f1f1ee"; ctx.fillRect(-6, -12 + b, 12, 12);   // striped shirt
    ctx.fillStyle = "#1b1c22"; for (let y = -10; y < 0; y += 3) ctx.fillRect(-6, y + b, 12, 1.5); ctx.restore();
    ctx.beginPath(); ctx.roundRect(-5.5, -11 + b, 11, 10, 3.5); ctx.stroke();
    ctx.fillStyle = "#f3c9a4"; ctx.beginPath(); ctx.arc(0, -14.5 + b, 4.4, 0, 6.28); ctx.fill(); ctx.stroke();   // face
    ctx.fillStyle = "#1b1c22"; ctx.fillRect(-4.4, -15.6 + b, 8.8, 2.4);   // black eye mask
    ctx.fillStyle = "#fff"; ctx.fillRect(-2.6, -15 + b, 1.4, 1.1); ctx.fillRect(1.2, -15 + b, 1.4, 1.1);
    ctx.fillStyle = "#24252d"; ctx.beginPath(); ctx.arc(0, -16.4 + b, 4.6, Math.PI, 0); ctx.fill(); ctx.fillRect(-4.8, -16.8 + b, 9.6, 1.6);   // beanie
    ctx.restore();
  });
  drawSpots();
  for (const k in ZONES2) { const z = ZONES2[k], r = z.r, own = S[z.key];
    if (own && k === "ind" && S.phase === "day") for (const h of houses) if (h.fac) { const t = performance.now() / 900 + h.id; for (let i = 0; i < 3; i++) { const k2 = (t + i / 3) % 1; ctx.fillStyle = `rgba(200,205,215,${.35 * (1 - k2)})`; ctx.beginPath(); ctx.arc(h.x + h.w - 6 + k2 * 6, h.y + 3 - k2 * 18, 2.5 + k2 * 4, 0, 6.28); ctx.fill(); } }
    if (!own) { ctx.strokeStyle = "rgba(241,196,83,.28)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.strokeRect(r[0] + 2, r[1] + 2, r[2] - 4, r[3] - 4); ctx.setLineDash([]); }
  }
  for (const r of rocks) { const k = r.t / r.dur; ctx.fillStyle = "#bbb"; ctx.beginPath(); ctx.arc(r.x + (r.tx - r.x) * k, r.y + (r.ty - r.y) * k - Math.sin(k * Math.PI) * 14, 2.2, 0, 6.28); ctx.fill(); }

  // darkness (strong at night, a light dusk tint by day)
  dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = "source-over"; dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = `rgba(3,5,16,${S.dark.toFixed(3)})`; dctx.fillRect(0, 0, dark.width, dark.height);
  VT(dctx); { const m = dctx.getTransform(); dctx.setTransform(m.a * DKS, m.b * DKS, m.c * DKS, m.d * DKS, m.e * DKS, m.f * DKS); } dctx.globalCompositeOperation = "destination-out";
  const lit = slots.filter(isLit);
  const hole = (x, y, r, a) => { const g = dctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.6, `rgba(0,0,0,${.8 * a})`); g.addColorStop(1, "rgba(0,0,0,0)"); dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x, y, r, 0, 6.28); dctx.fill(); };
  for (const s of lit) { const a = lampAlpha(s.lamp); s.lamp.fa = a; hole(s.x, s.y, lr(s), a); }
  if (S.phase === "night") for (const r of refls) hole(r.x, r.y, REF.r, .9);
  if (S.patrol) hole(S.patrol.x, S.patrol.y, PATROL.r, .85);
  for (const v of vans) if (v.state === "drive" || v.state === "return") {
    const fx = v.x + Math.cos(v.ang) * 12, fy = v.y + Math.sin(v.ang) * 12;
    const g = dctx.createRadialGradient(fx, fy, 0, fx, fy, 75);
    g.addColorStop(0, "rgba(0,0,0,.75)"); g.addColorStop(1, "rgba(0,0,0,0)");
    dctx.fillStyle = g; dctx.beginPath(); dctx.moveTo(fx, fy); dctx.arc(fx, fy, 75, v.ang - .45, v.ang + .45); dctx.closePath(); dctx.fill();
  }
  for (const f of flashes) {
    const g = dctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 55), a = 1 - f.t / .5;
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); dctx.fillStyle = g; dctx.fillRect(f.x - 60, f.y - 60, 120, 120);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dark, 0, 0, cv.width, cv.height); VT(ctx);
  ctx.globalCompositeOperation = "lighter";
  const glow = (x, y, r, c, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${c},${.32 * a})`); g.addColorStop(.35, `rgba(${c},${.12 * a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); };
  for (const s of lit) glow(s.x, s.y, lr(s), lampCol(s), s.lamp.fa);
  if (S.phase === "night") for (const r of refls) glow(r.x, r.y, REF.r, REF.col, .9);
  for (const c of traffic) if (S.phase === "night") { const a = c.path ? c.ang : c.vert ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI), px = -Math.sin(a) * 4, py = Math.cos(a) * 4, d = c.dark ? 30 : 22, r = c.dark ? 34 : 22, k = c.dark ? .85 : .45;
    glow(c.x + Math.cos(a) * d + px, c.y + Math.sin(a) * d + py, r, [255,236,180], k); glow(c.x + Math.cos(a) * d - px, c.y + Math.sin(a) * d - py, r, [255,236,180], k);
    if (c.type === "police") glow(c.x, c.y, 30, (performance.now() / 220 | 0) % 2 ? [90,140,255] : [255,80,80], .7); }
  if (S.patrol) glow(S.patrol.x, S.patrol.y, PATROL.r, (performance.now() / 300 | 0) % 2 ? [90,140,255] : [255,80,80], .9);
  ctx.globalCompositeOperation = "source-over";
  drawWeather();
  if (S.heat) { ctx.font = "700 10px Barlow, sans-serif"; ctx.textAlign = "center";
    for (const h of houses) { if (!hOn(h)) continue; const v = h.sat;
      const o = up(BZ(h)); ctx.fillStyle = `hsla(${Math.round(v * 120)},85%,50%,.62)`; ctx.save(); ctx.translate(o.x, o.y); if (h.poly) { polyPath(ctx, h.poly); ctx.fill(); } else ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = "#0b1120"; ctx.fillText(Math.round(v * 100) + "%", h.cx, h.cy + 3.5); ctx.restore(); } }

  if (MAP) drawLandmarks();
  drawGen();
  drawGang();
  // windows and satisfaction bars
  for (const h of houses) {
    if (!hOn(h)) continue;
    const z = BZ(h), o = up(z), Y1 = h.y + h.h, X1 = h.x + h.w;
    const wq = (pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
    [[.25, .28], [.68, .28], [.25, .68], [.68, .68]].forEach((p, i) => {
      if (!h.win[i]) return;
      ctx.fillStyle = h.glow > .05 ? `rgba(255,205,110,${.25 + .7 * h.glow})` : S.phase === "day" ? "rgba(150,180,210,.5)" : "rgba(40,50,80,.5)";
      ctx.fillRect(h.x + h.w * p[0] - 2.5 + o.x, h.y + h.h * p[1] - 3 + o.y, 5, 6);
      if (h.glow > .05 && !h.poly && !h.fac) {   // the same light in the walls
        const x = h.x + 4 + 9 * i; if (x + 4 < X1 - 2) wq([[x + o.x * .2, Y1 + o.y * .2], [x + 4 + o.x * .2, Y1 + o.y * .2], [x + 4 + o.x * .8, Y1 + o.y * .8], [x + o.x * .8, Y1 + o.y * .8]]);
        const y = h.y + 4 + 9 * i; if (ISO && y + 4 < Y1 - 2) wq([[X1 + o.x * .2, y + o.y * .2], [X1 + o.x * .2, y + 4 + o.y * .2], [X1 + o.x * .8, y + 4 + o.y * .8], [X1 + o.x * .8, y + o.y * .8]]);
      }
    });
    if (h.lit || (S.phase === "day" && h.sat > .02)) {
      ctx.fillStyle = "rgba(8,10,20,.75)"; ctx.fillRect(h.x + 3 + o.x, h.y + h.h - 6 + o.y, h.w - 6, 4);
      ctx.fillStyle = h.sat > .6 ? "#7ed39a" : h.sat > .3 ? "#f1c453" : "#ff9d8f"; ctx.fillRect(h.x + 3.5 + o.x, h.y + h.h - 5.5 + o.y, (h.w - 7) * h.sat, 3);
    }
  }
  for (const s of slots) {
    if (!s.lamp || !avail(s)) continue;
    const L = s.lamp;
    if (isLit(s)) { const lc = lampCol(s); ctx.shadowColor = `rgb(${lc})`; ctx.shadowBlur = 12; lampHead(s, `rgba(${lc},${L.fa})`, true); ctx.shadowBlur = 0; }
    else if (L.state === "broken") { ctx.strokeStyle = "#ff6b5b"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 4); ctx.lineTo(s.x + 4, s.y + 4); ctx.moveTo(s.x + 4, s.y - 4); ctx.lineTo(s.x - 4, s.y + 4); ctx.stroke(); }
    else lampHead(s, "", false);
    if (L.glass) { ctx.strokeStyle = "rgba(159,216,255,.85)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(s.x, s.y, 7.5, 0, 6.28); ctx.stroke(); }
    if (L.sensor) { ctx.fillStyle = L.wake > 0 ? "#58d68d" : "#ff4d4d"; ctx.beginPath(); ctx.arc(s.x + 6, s.y + 5, 2, 0, 6.28); ctx.fill(); }
    if (tenderLamp(s)) { const pu = .55 + .3 * Math.sin(performance.now() / 300); ctx.strokeStyle = `rgba(251,191,36,${pu})`; ctx.lineWidth = 2; ctx.strokeRect(s.x - 10, s.y - 10, 20, 20); }
  }
  if (S.phase === "night") for (const r of refls) { ctx.fillStyle = "#eaf7ff"; ctx.shadowColor = "#d6f0ff"; ctx.shadowBlur = 10; ctx.fillRect(r.x - 4, r.y - 3, 8, 5); ctx.shadowBlur = 0; }
  for (const h of hoods) {
    const b = Math.sin(h.bob) * 1.2;
    const nq = h.path && h.path[h.i] || BASE, tg = h.state === "flee" ? {x:BASE.x, y:h.fy} : (h.state === "seek" || h.state === "throw") && h.target ? h.target : nq, tx = tg.x, ty = tg.y;
    const ang = Math.atan2(ty - h.y, tx - h.x);
    const ex = Math.cos(ang) * 2.2, ey = Math.sin(ang) * 2.2 - 3 + b, px = -Math.sin(ang) * 1.8, py = Math.cos(ang) * 1.8;
    if (h.rev && h.state !== "flee") { ctx.strokeStyle = "rgba(255,120,40,.8)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.x, h.y + b, 10, 0, 6.28); ctx.stroke(); }
    ctx.fillStyle = h.state === "flee" ? "rgba(255,90,70,.45)" : "#ff4a3a"; ctx.shadowColor = "#ff2a1a"; ctx.shadowBlur = 6;
    ctx.fillRect(h.x + ex + px - 1, h.y + ey + py - 1, 2, 2); ctx.fillRect(h.x + ex - px - 1, h.y + ey - py - 1, 2, 2); ctx.shadowBlur = 0;
    if (h.fear > .15 && h.state !== "flee") { ctx.fillStyle = "#f1c453"; ctx.font = "700 13px Barlow Condensed, sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", h.x, h.y - 13); }
  }
  for (const t of thieves) {
    const b = Math.sin(t.bob) * 1.1;
    ctx.fillStyle = "#ffd84a"; ctx.shadowColor = "#ffd84a"; ctx.shadowBlur = 6; ctx.fillRect(t.x - 2.5, t.y - 4 + b, 2, 2); ctx.fillRect(t.x + .5, t.y - 4 + b, 2, 2); ctx.shadowBlur = 0;
  }
  drawPeds();
  drawTraffic();
  for (const v of vans) drawVan(v);
  if (S.patrol) {
    const P = S.patrol; ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.ang);
    ctx.fillStyle = "#e8ecf3"; ctx.fillRect(-12, -7, 24, 14); ctx.fillStyle = "#2b4fb0"; ctx.fillRect(-12, -2, 24, 4);
    const on = (performance.now() / 300 | 0) % 2; ctx.fillStyle = on ? "#4d8bff" : "#ff4d4d"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12; ctx.fillRect(-3, -6, 6, 12); ctx.shadowBlur = 0;
    ctx.restore();
  }
  for (const v of vans) {
    if (v.state === "work") { const onb = (performance.now() / 250 | 0) % 2; ctx.fillStyle = onb ? "#ffb02e" : "#7a4b0a"; ctx.shadowColor = "#ffb02e"; ctx.shadowBlur = onb ? 10 : 0; ctx.beginPath(); ctx.arc(v.x, v.y, 3, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0; }
    if (v.state === "drive" || v.state === "return") { const bx = v.x - Math.cos(v.ang) * 12, by = v.y - Math.sin(v.ang) * 12; ctx.fillStyle = "#ff3b30"; ctx.fillRect(bx - 1.5, by - 1.5, 3, 3); }
  }
  for (const p of parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
  ctx.globalAlpha = 1;

  // labels: life % and mood face
  ctx.textAlign = "center"; ctx.font = "600 11px Barlow, sans-serif";
  // Badges never overlap: problem lamps first, then the weakest. Zoomed far out, only lamps that need you get a badge.
  const far = pxPerU() < 1.15, keep = S.sel || S.pending, cand = [];
  for (const s of slots) {
    if (!avail(s)) continue;
    if (s.job) { const pulse = 7 + Math.sin(performance.now() / 160) * 2; ctx.strokeStyle = "#f1c453"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x, s.y, pulse + 3, 0, 6.28); ctx.stroke(); }
    if (!s.lamp) continue;
    const L = s.lamp, pct = Math.ceil(L.life * 100);
    let txt, col;
    if (L.state === "broken") { txt = Tx("razbijena"); col = "#ff6b5b"; }
    else if (L.state === "burnt") { txt = "0%"; col = "#ff6b5b"; }
    else if (!L.powered) { txt = Tx("bez struje"); col = "#8f98ae"; }
    else { txt = pct + "%"; col = pct > 50 ? "#9fe0b3" : pct > 20 ? "#f1c453" : "#ff6b5b"; }
    if (L.state === "ok" && L.powered) { ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(s.x - 9, s.y + 7, 18, 2.5); ctx.fillStyle = col; ctx.fillRect(s.x - 9, s.y + 7, 18 * L.life, 2.5); }
    const mood = L.mood ?? moodOf(s, L.m)[0], bad = L.state !== "ok" || !L.powered || pct <= 20 || mood < 0;
    if (far && s !== keep) { if (!bad || !L.powered) continue;   // far out: no power is already on the top bar
      if (L.state === "broken") txt = "✕"; }   // and short badges
    cand.push({s, txt, col, mood:far && mood >= 0 && s !== keep ? null : mood, pr:(s === keep ? -1e3 : 0) + (bad ? 0 : 500) + pct});
  }
  cand.sort((a, b) => a.pr - b.pr); const placed = [];
  for (const {s, txt, col, mood} of cand) {
    const lift = vans.some(v => Math.abs(v.x - s.x) < 40 && Math.abs(v.y - s.y) < 40) ? (ISO ? 26 : 20) : 0, ty = s.y - 11 - lift, fw = mood == null ? 0 : 7, tw = ctx.measureText(txt).width + 8 - (fw ? 0 : 6);   // a van at the lamp stays visible under the badge
    const p = proj(s.x, s.y), r = {x0:p.x - tw / 2 - 2 - fw, x1:p.x + tw / 2 + 6 + fw, y0:p.y - 23 - lift, y1:p.y - 6 - lift};
    if (placed.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue; placed.push(r);
    uprightAt(ctx, s.x, s.y, () => { ctx.fillStyle = "rgba(8,10,20,.78)"; ctx.beginPath(); ctx.roundRect(s.x - tw / 2 - fw, ty - 10, tw + 2 * fw, 13, 6.5); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(txt, s.x - fw, ty);
      if (mood != null) face(s.x + tw / 2, ty - 3.5, mood); });
  }
  for (const k in ZONES2) { const z = ZONES2[k], r = z.r, own = S[z.key];   // zone names, above the houses and the badges, readable when zoomed out
    ctx.font = "700 12px Barlow Condensed, sans-serif"; ctx.textAlign = "center"; const t = k === "ind" ? (own ? Tx("INDUSTRIJA") : Tx`Industrija ${z.cost} $`) : own ? z.name.toUpperCase() : `${z.name} · ${z.cost} $`, tw = ctx.measureText(t).width + 8, [lx, ly] = zoneLabelAt(k, r, tw);
    uprightAt(ctx, lx, ly, () => { const zf = Math.max(1, 1.1 / pxPerU()); ctx.translate(lx, ly); ctx.scale(zf, zf); ctx.translate(-lx, -ly); ctx.fillStyle = "rgba(8,10,20,.78)"; ctx.beginPath(); ctx.roundRect(lx - tw / 2 - 2, ly - 11, tw + 4, 15, 7.5); ctx.fill(); ctx.fillStyle = own ? "#e7dcc4" : "#f1c453"; ctx.fillText(t, lx, ly); }); }
  // radar preview
  const hov = S.hover && slotAt(S.hover, hitR());
  const target = S.tool ? S.pending || hov : hov || S.sel;
  const lampTool = toolModel();
  if (lampTool) for (const s of slots) if (isOn(s)) { ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, lr(s) * LIGHT_K, 0, 6.28); ctx.stroke(); }
  if (target && avail(target) && S.tool !== "ref") {
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(target.x, target.y, 11, 0, 6.28); ctx.stroke();
    if (lampTool && !target.job && (!target.lamp || target.lamp.m.f !== lampTool.f)) drawRadar(target, lampTool);
  }
  if (S.tool === "ref" && S.hover && S.phase === "night") { ctx.strokeStyle = "rgba(214,240,255,.7)"; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(S.hover.x, S.hover.y, REF.r * LIGHT_K, 0, 6.28); ctx.stroke(); ctx.setLineDash([]); }
  // locked old quarter
  if (!S.unlocked) {
    ctx.fillStyle = "rgba(6,8,16,.78)"; ctx.fillRect(0, LOCK_Y, W, H - LOCK_Y);
    ctx.strokeStyle = "rgba(241,196,83,.14)"; ctx.lineWidth = 6;
    for (let x = -300; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 285, LOCK_Y); ctx.stroke(); }
    ctx.strokeStyle = "#8a7a4a"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(0, LOCK_Y); ctx.lineTo(W, LOCK_Y); ctx.stroke(); ctx.setLineDash([]);
    uprightAt(ctx, W / 2, LOCK_Y + 34, () => {   // both lines stand up together, so they never overlap
      ctx.textAlign = "center"; ctx.fillStyle = "#ece6d6"; ctx.font = "700 32px Barlow Condensed, sans-serif"; ctx.fillText(Tx("STARI KVART"), W / 2, LOCK_Y + 34);
      ctx.fillStyle = "#ffc882"; ctx.font = "500 17px Barlow, sans-serif"; ctx.fillText(Tx`Voli klasično svetlo · ${PLOT_COST} $ u Prodavnici`, W / 2, LOCK_Y + 60); });
  }
  ctx.textAlign = "center";
  for (const f of floats) {
    const money = /\$|^\+\d/.test(f.text), sz = f.big ? 21 : money ? 18 : 14, k = f.t / 1.4, pop = f.t < .12 ? .7 + f.t / .12 * .3 : 1, y = f.y - f.t * 26;
    ctx.font = `800 ${Math.round(sz * pop)}px Barlow Condensed, sans-serif`; ctx.globalAlpha = 1 - k * k;
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(5,8,16,.85)"; ctx.lineJoin = "round"; ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = money && f.col === "#7ed39a" ? "#ffd84a" : f.col; ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
  // badges (faded while choosing a lamp, so the top of the map stays clear)
  ctx = octx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ocv.width, ocv.height);   // flat overlay: not leaned back
  const osc = ocv.width / W, UK = badgeK(), UW = W / UK; ctx.setTransform(osc * UK, 0, 0, osc * UK, 0, 0);
  ctx.globalAlpha = S.tool ? (MAP ? .85 : .12) : 1;
  ctx.font = "600 13px Barlow, sans-serif"; ctx.textAlign = "left";
  const compact = UW < 520;   // phone: one thin row of small chips, so the map stays free
  const toneLine = d => { const t = districtTone(d); return t.tones.size === 0 ? null : t.tone ? [Tx`${d === "novi" ? Tx("Kvart") : Tx("Stari kvart")}: sve ${t.tone} svetlo +25%`, "#7ed39a"] : [Tx`${d === "novi" ? Tx("Kvart") : Tx("Stari kvart")}: mešano svetlo, bez bonusa`, "#f1c453"]; };
  const sp = Math.round(S.sat * 100);
  const gl = MAP && S.goal >= 1 ? (S.auto ? Tx("Kvart radi sam") : Tx("Cilj: automatizuj kvart")) : S.goal === 0 ? Tx`Cilj: osvetli ceo kvart (${Math.floor(S.cover * 100)}%)` : S.goal === 1 ? Tx("Cilj: kupi stari kvart") : S.goal === 2 ? Tx`Cilj: osvetli i stari kvart (${Math.floor(S.cover * 100)}%)` : Tx("Svi ciljevi ispunjeni");
  const wl0 = S.phase === "night" && S.tariff > 1 ? Tx("Skupa struja +40%") : "";
  const wl = S.phase === "night" && S.weather === "fog" ? Tx("Magla: domet −25%") : S.phase === "night" && S.weather === "storm" ? Tx("Oluja: pazi na stare lampe") : "";
  const hl = S.phase === "day" ? Tx("Dan: popravke −50%") : S.patrol ? Tx("Patrola obilazi kvart…") : S.calm > 0 ? Tx`Mirno još ${fmtT(S.calm)}` : S.night < GANG_N ? Tx("Huligani dolaze od 2. noći") : BL && S.night === 1 && S.phase === "night" ? (MAP && MAP.part === "my" ? Tx`Težina ${BL + 1}: banda te već zna` : Tx`Težina Borče ${BL + 1}: banda te već zna`) : "";
  let ly;
  if (compact) {
    ctx.font = "600 12px Barlow, sans-serif"; const chips = [];
    const sc2 = sp > 60 ? "#7ed39a" : sp > 30 ? "#f1c453" : "#ff9d8f";
    chips.push({w:ctx.measureText(sp + "%").width + 30, draw:(x, y) => { face(x + 12, y + 10, sp > 60 ? 1 : sp > 30 ? 0 : -1); ctx.fillStyle = sc2; ctx.fillText(sp + "%", x + 22, y + 15); }});   // satisfaction
    const tones = [MAP ? DIST0 : "novi", S.unlocked && !MAP ? "stari" : null].filter(Boolean).map(d => districtTone(d)).filter(t => t.tones.size);
    for (const t of tones) { const ok = !!t.tone, tx = ok ? "+25%" : "0%"; chips.push({w:ctx.measureText(tx).width + 26, draw:(x, y) => { ctx.fillStyle = ok ? "#7ed39a" : "#f1c453"; ctx.beginPath(); ctx.arc(x + 10, y + 10, 3.5, 0, 6.28); ctx.fill(); ctx.fillText(tx, x + 18, y + 15); }}); }   // same light colour bonus
    if (S.goal !== 0 && S.goal !== 2) { const t = gl; chips.push({w:ctx.measureText(t).width + 14, draw:(x, y) => { ctx.fillStyle = "#f1c453"; ctx.fillText(t, x + 7, y + 15); }}); }
    const alert = [wl, wl0, S.heat ? Tx("Toplotna mapa: crveno = nezadovoljni") : "", hl].find(Boolean);
    if (alert) chips.push({w:ctx.measureText(alert).width + 14, draw:(x, y) => { ctx.fillStyle = "#c9cfdb"; ctx.fillText(alert, x + 7, y + 15); }});
    let x = 6, y = 6;
    for (const c of chips) { if (x + c.w > UW - 6 && x > 6) { x = 6; y += 24; } ctx.fillStyle = "rgba(8,10,20,.78)"; ctx.beginPath(); ctx.roundRect(x, y, c.w, 20, 10); ctx.fill(); c.draw(x, y); x += c.w + 5; }
    ly = y + 22; S.hudB = (y + 24) * UK;
  } else {
  const left = [toneLine(MAP ? DIST0 : "novi"), S.unlocked && !MAP ? toneLine("stari") : null, [Tx`Zadovoljstvo ${sp}% · nesrećni uz ${S.moodSad} lamp${S.moodSad === 1 ? "u" : "i"}`, sp > 60 ? "#7ed39a" : sp > 30 ? "#f1c453" : "#ff9d8f", true]].filter(Boolean);
  left.forEach(([t, c, f], i) => { const w2 = ctx.measureText(t).width + 16 + (f ? 16 : 0); ctx.fillStyle = "rgba(8,10,20,.8)"; ctx.fillRect(8, 8 + i * 26, w2, 22); if (f) face(22, 19 + i * 26, sp > 60 ? 1 : sp > 30 ? 0 : -1); ctx.fillStyle = c; ctx.fillText(t, f ? 32 : 16, 24 + i * 26); });
  ly = 8 + left.length * 26;
  ctx.fillStyle = "rgba(8,10,20,.8)"; ctx.fillRect(8, ly, 160, 8); ctx.fillStyle = S.cover > .95 ? "#7ed39a" : "#f1c453"; ctx.fillRect(9, ly + 1, 158 * S.cover, 6);
  ctx.textAlign = "right";
  const rl = [gl, hl, wl, wl0, S.heat ? Tx("Toplotna mapa: crveno = nezadovoljni") : ""].filter(Boolean);
  const lw = left.map(([t, c, f]) => ctx.measureText(t).width + 16 + (f ? 16 : 0));   // on a narrow screen the right badges go under the left ones instead of over them
  const ro = rl.some((t, i) => ctx.measureText(t).width + 16 + (i < lw.length ? lw[i] : i === lw.length ? 160 : 0) + 24 > UW) ? ly + 14 - 8 : 0;
  S.hudB = Math.max(ly + 14, rl.length ? ro + 8 + rl.length * 26 : 0) * UK;   // where the top badges end (map width units), the banner goes under them
  rl.forEach((t, i) => { const w2 = ctx.measureText(t).width + 16; ctx.fillStyle = "rgba(8,10,20,.8)"; ctx.fillRect(UW - 8 - w2, ro + 8 + i * 26, w2, 22); ctx.fillStyle = i ? "#c9cfdb" : "#f1c453"; ctx.fillText(t, UW - 16, ro + 24 + i * 26); });
  }
  // the gang meter lives under the map (#gang), where it stays readable on any screen
  ctx.textAlign = "left";
  if (S.flashCd > 0) { ctx.fillStyle = "rgba(8,10,20,.8)"; ctx.fillRect(8, ly + 14, 130, 20); ctx.fillStyle = "#8f98ae"; ctx.font = "500 12px Barlow, sans-serif"; ctx.fillText(Tx("Baterija se puni…"), 16, ly + 28); }
  ctx = ctx0; VT(ctx);
  ctx.globalAlpha = 1;
  if (S.mission && S.mission.type === "house" && S.phase === "night") { const h = houses[S.mission.house];
    if (h) { const ok = !S.mission.fail, pu = .6 + .4 * Math.sin(performance.now() / 250);
      ctx.strokeStyle = ok ? `rgba(126,211,154,${pu})` : "rgba(255,107,91,.8)"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); { const o = up(BZ(h)); ctx.strokeRect(h.x - 4 + o.x, h.y - 4 + o.y, h.w + 8, h.h + 8); } ctx.setLineDash([]);
      ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; const tx = ok ? Tx("ČUVAJ") : "OBIJENA"; const w = ctx.measureText(tx).width + 10, o = up(BZ(h)), ax = h.cx + o.x, ay = h.y + o.y;
      uprightAt(ctx, ax, ay, () => { ctx.fillStyle = "rgba(8,10,20,.85)"; ctx.fillRect(ax - w / 2, ay - 22, w, 16); ctx.fillStyle = ok ? "#7ed39a" : "#ff6b5b"; ctx.fillText(tx, ax, ay - 10); }); } }
  for (const t of thieves) if (t.rep > 0) {   // residents reported this thief
    const pu = (performance.now() / 200 | 0) % 2, by = boundY(), tq = proj(t.x, t.y), eq = unproj(clamp(tq.x, VX + 16 / VZ, VX + (pbox().w - 16) / VZ), clamp(tq.y, VY + 16 / VZ, VY + (VSH() - 16) / VZ)), ex = eq.x, ey = eq.y; void by;
    ctx.strokeStyle = pu ? "#ff6b5b" : "#ffd84a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, 13, 0, 6.28); ctx.stroke();
    ctx.fillStyle = "#ffd84a"; ctx.strokeStyle = "#0b1120"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, ey - 11); ctx.lineTo(ex + 11, ey + 8); ctx.lineTo(ex - 11, ey + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0b1120"; ctx.font = "800 13px Barlow, sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", ex, ey + 6);
  }
  for (const t of thieves) if (t.state === "work") {   // break-in alert, drawn above the badges so it is never hidden
    const k = t.work / THIEF.work, pulse = (performance.now() / 250 | 0) % 2;
    ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(t.x, t.y, 15, 0, 6.28); ctx.stroke();
    ctx.strokeStyle = pulse ? "#ff6b5b" : "#f1c453"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, 15, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke();
    const lbl = t.g.kind === "car" ? Tx("KRADE KOLA!") : t.g.kind === "spot" ? Tx("PLJAČKA!") : Tx("OBIJA STAN!"); ctx.font = "700 14px Barlow Condensed, sans-serif"; ctx.textAlign = "center";
    const ly2 = t.y < 40 ? t.y + 32 : t.y - 20, tw = ctx.measureText(lbl).width + 8;
    uprightAt(ctx, t.x, t.y, () => { ctx.fillStyle = "rgba(8,10,20,.85)"; ctx.fillRect(t.x - tw / 2, ly2 - 12, tw, 16); ctx.fillStyle = "#ffd84a"; ctx.fillText(lbl, t.x, ly2); });
  }
  ctx = octx;
  { const k = Math.min(1, 640 / osW), wk = W / k, hk = W * osH / osW / k; ctx.setTransform(osc * k, 0, 0, osc * k, 0, 0);   // attribution stays on the screen, not on the map
  if (MAP) { ctx.font = "600 11px Barlow, sans-serif"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(8,10,20,.7)"; ctx.fillRect(wk - 166, hk - 20, 160, 16); ctx.fillStyle = "#c9cfdb"; ctx.fillText(Tx("© OpenStreetMap saradnici"), wk - 10, hk - 8); ctx.textAlign = "left"; }
  ctx.setTransform(osc * k, 0, 0, osc * k, (ocv.width - W * osc * k) / 2, 0); }   // banners: a box in the middle of the screen, never wider than a phone screen
  if (S.banner) {
    const b = S.banner, k = Math.min(1, 640 / osW), t = (performance.now() - b.t0) / 1000;
    if (b.dur == null) b.dur = clamp(2.2 + (b.title.length + b.sub.length) / 45, 2.5, 4.5);
    const a = Math.min(1, t * 4, (b.dur - t) * 3);
    if (t > b.dur) { S.banner = null; S.bannerR = null; } else {
      const bw = Math.min(W - 32, 520), x0 = (W - bw) / 2, y0 = Math.round((S.hudB || 70) / k + 8);
      ctx.font = "500 14px Barlow, sans-serif"; const lines = wrapLines(b.sub, bw - 28), h = 44 + lines.length * 18;
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = "rgba(8,10,20,.9)"; ctx.beginPath(); ctx.roundRect(x0, y0, bw, h, 12); ctx.fill();
      ctx.strokeStyle = "#f1c453"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = "#f1c453"; ctx.font = "700 24px Barlow Condensed, sans-serif"; ctx.fillText(b.title, W / 2, y0 + 30);
      ctx.fillStyle = "#ece6d6"; ctx.font = "500 14px Barlow, sans-serif"; lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 50 + i * 18));
      ctx.globalAlpha = 1; ctx.textAlign = "left";
      const dpr = ocv.width / osW, m = ctx.getTransform(); S.bannerR = {x:(m.e + x0 * m.a) / dpr, y:(m.f + y0 * m.d) / dpr, w:bw * m.a / dpr, h:h * m.d / dpr};   // css px inside the stage, for tap to close
    }
  }
  ctx = ctx0;
}
function drawGang() {
  const G = S.gang, now = performance.now();
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  // zones the gang avoids
  for (const z of zones) {
    if (z.y > boundY()) continue;
    ctx.fillStyle = z.perm ? "rgba(126,211,154,.10)" : "rgba(126,211,154,.06)"; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.28); ctx.fill();
    ctx.strokeStyle = z.perm ? "rgba(126,211,154,.6)" : "rgba(126,211,154,.5)"; ctx.lineWidth = 1.5; ctx.setLineDash(z.perm ? [] : [5, 6]);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "600 11px Barlow, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(8,10,20,.7)";
    const t = z.perm ? Tx("banda se iselila") : Tx`zatvoreno za bandu · ${Math.max(1, z.until - S.night + (S.phase === "day" ? 0 : 1))} n.`, tw = ctx.measureText(t).width + 8;
    { const fs = ctx.fillStyle; uprightAt(ctx, z.x, z.y + z.r, () => { ctx.fillStyle = fs; ctx.fillRect(z.x - tw / 2, z.y + z.r - 16, tw, 14); ctx.fillStyle = "#9fe0b3"; ctx.fillText(t, z.x, z.y + z.r - 5); }); }
  }
  if (!G.gone) {
    // routes: open ones red and moving, closed ones grey
    const rs = routesNow(), open = rs.map(routeOpen);
    rs.forEach((r, i) => {
      ctx.strokeStyle = open[i] ? "rgba(255,80,70,.24)" : "rgba(150,160,180,.14)"; ctx.lineWidth = open[i] ? 1.6 : 1.2;   // quiet, so the hooligans stand out more than their paths
      ctx.setLineDash(open[i] ? [4, 11] : [3, 10]); ctx.lineDashOffset = open[i] ? -now / 50 : 0;
      ctx.beginPath(); r.pts.forEach(([x, y], k) => { const o = (i - 2) * 2.2; k ? ctx.lineTo(x + o, y + o) : ctx.moveTo(x + o, y + o); }); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  // the gang's quarter past the left edge: a red strip with three street exits
  ctx.fillStyle = G.gone ? "rgba(90,96,110,.6)" : "rgba(170,30,30,.65)"; ctx.fillRect(0, GANG_Y[0], 5, GANG_Y[1] - GANG_Y[0]);
  for (const e of ENTRIES) { ctx.fillStyle = G.gone ? "#6b7280" : "#ff4a3a"; ctx.beginPath(); ctx.moveTo(0, e - 9); ctx.lineTo(9, e); ctx.lineTo(0, e + 9); ctx.closePath(); ctx.fill(); }
  ctx.save(); ctx.translate(14, GANG_Y[2]); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = G.gone ? "rgba(60,66,80,.9)" : "rgba(120,20,20,.92)"; ctx.fillRect(-34, -10, 68, 20);
  ctx.fillStyle = G.gone ? "#aab" : "#ffd0c8"; ctx.font = "700 14px Barlow Condensed, sans-serif"; ctx.textAlign = "center"; ctx.fillText(G.gone ? Tx("ISELILI SE") : Tx("BANDA"), 0, 5);
  ctx.restore();
  ctx.restore(); ctx.textAlign = "left";
}
function wrapLines(t, maxW) { const out = []; let line = ""; for (const w of t.split(" ")) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; } if (line) out.push(line); return out; }
function wrapText(t, x, y, maxW, lh) {
  const words = t.split(" "); let line = "";
  for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = test; }
  if (line) ctx.fillText(line, x, y);
}
function drawVan(v) {
  const home = v.state === "home", now = performance.now();
  if ((v.state === "drive" || v.state === "return") && S.phase === "night") {   // two headlight beams on the road ahead
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.va != null ? v.va : v.ang); const g = ctx.createLinearGradient(14, 0, 56, 0); g.addColorStop(0, "rgba(255,244,210,.45)"); g.addColorStop(1, "rgba(255,244,210,0)"); ctx.fillStyle = g;
    for (const sy of [-4, 4]) { ctx.beginPath(); ctx.moveTo(12, sy - 1.2); ctx.lineTo(52, sy * 2.6 - 7); ctx.lineTo(52, sy * 2.6 + 7); ctx.lineTo(12, sy + 1.2); ctx.closePath(); ctx.fill(); }
    ctx.restore(); }
  const busy = v.state === "drive" || v.state === "return" || v.state === "work";
  drawVehicle(v, v.x + (home && !MAP ? 14 : 0), v.y, home && !MAP ? 0 : v.ang, "van", S.armor ? "#8b939e" : "#f1efe6", S.phase === "night" && busy ? "on" : "off", (P, z, L, Wd, k) => {   // on the roof: ladder, folded crane, beacon
    const line = (a0, b0, a1, b1) => { const p = P(a0, b0, z), q = P(a1, b1, z); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); };
    if (S.armor) { ctx.fillStyle = "#5d6470"; for (const a of [-.7, -.2, .3]) for (const b of [-.7, .7]) { const p = P(L * a, Wd * b, z); ctx.fillRect(p.x - .8, p.y - .8, 1.6, 1.6); } }
    ctx.strokeStyle = "#8d96a6"; ctx.lineWidth = 1.2 * k; ctx.beginPath(); line(-L * .9, -Wd * .4, L * .35, -Wd * .4); line(-L * .9, Wd * .4, L * .35, Wd * .4);
    for (let a = -.85; a <= .3; a += .17) line(L * a, -Wd * .4, L * a, Wd * .4); ctx.stroke();
    if (S.crane) { ctx.strokeStyle = "#facc15"; ctx.lineWidth = 2.6 * k; ctx.beginPath(); line(-L * .8, 0, L * .3, 0); ctx.stroke(); }
    const b = P(L * .55, 0, z + 1.5 * k);
    if (busy) uprightAt(ctx, b.x, b.y, () => { const on = (now / 200 | 0) % 2; ctx.fillStyle = "#3a3f4a"; ctx.fillRect(b.x - 3.2 * k, b.y, 6.4 * k, 1.6 * k);
      ctx.fillStyle = ctx.shadowColor = on ? "#ff8a1f" : "#ffd24a"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(b.x, b.y - .4 * k, 2.4 * k, Math.PI, 0); ctx.fill(); ctx.shadowBlur = 0; });
  });
  if (v.state === "work" && v.job) {   // ladder (or the crane basket) raised to the lamp
    const s = v.job.slot; ctx.strokeStyle = S.crane ? "#facc15" : "#c9cfd8"; ctx.lineWidth = 1.4; const dx = s.x - v.x, dy = s.y - v.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 2.5, ny = dx / l * 2.5;
    ctx.beginPath(); ctx.moveTo(v.x + nx, v.y + ny); ctx.lineTo(s.x + nx, s.y + ny); ctx.moveTo(v.x - nx, v.y - ny); ctx.lineTo(s.x - nx, s.y - ny);
    for (let k = .15; k < 1; k += .15) { ctx.moveTo(v.x + dx * k + nx, v.y + dy * k + ny); ctx.lineTo(v.x + dx * k - nx, v.y + dy * k - ny); } ctx.stroke();
  }
}
let gainCache = {key:"", v:0, at:0};
function drawRadar(s, m) {
  const rr = m.r * LIGHT_K, now = performance.now();
  ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, 6.28); ctx.clip();
  ctx.fillStyle = `rgba(${m.col},.14)`; ctx.fillRect(s.x - rr, s.y - rr, rr * 2, rr * 2);
  ctx.fillStyle = "rgba(255,107,91,.22)";
  for (const o of slots) if (isOn(o) && o !== s) { ctx.beginPath(); ctx.arc(o.x, o.y, lr(o) * LIGHT_K, 0, 6.28); ctx.fill(); }
  const a = now / 700 % 6.283, g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rr);
  g.addColorStop(0, `rgba(${m.col},.45)`); g.addColorStop(1, `rgba(${m.col},.05)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, rr, a - .5, a); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = `rgba(${m.col},.9)`; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = `rgba(${m.col},.25)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, rr * .5, 0, 6.28); ctx.stroke();
  const key = s.id + m.id + Math.round(s.x) + "," + Math.round(s.y);
  if (gainCache.key !== key || now - gainCache.at > 400) gainCache = {key, v:coverGain(s, m), at:now};
  const [mood, why] = moodOf(s, m);
  const before = districtTone(s.district), after = districtTone(s.district, {slot:s, m});
  const toneTxt = after.bonus > before.bonus ? Tx("Ista boja svetla: +25% prihoda") : after.bonus < before.bonus ? Tx("Kvari bonus za istu boju svetla") : null;
  const lines = [[Tx`+${gainCache.v}% svetla`, gainCache.v < 2 ? "#ff9d8f" : "#7ed39a", "700 18px Barlow Condensed, sans-serif"],
    [why, mood > 0 ? "#7ed39a" : mood < 0 ? "#ff9d8f" : "#c9cfdb", "500 12px Barlow, sans-serif"]];
  if (toneTxt) lines.push([toneTxt, after.bonus > before.bonus ? "#7ed39a" : "#f1c453", "500 12px Barlow, sans-serif"]);
  if (!s.lamp && m.power > genCap() * OVER_MAX - S.used) lines.push([Tx("Generator je pun: neće svetleti. Uzmi štedljivu ili jači generator."), "#ff9d8f", "600 12px Barlow, sans-serif"]);
  ctx.textAlign = "center";
  let bw = 0; for (const [t, , f] of lines) { ctx.font = f; bw = Math.max(bw, ctx.measureText(t).width); }
  bw += 34; const bh = 10 + lines.length * 17;
  // the card stands up above the ring (in ISO it lay flat on the ground before), kept inside the screen
  const p0 = proj(0, 0), px1 = proj(1, 0), py1 = proj(0, 1), ry = rr * Math.hypot(px1.y - p0.y, py1.y - p0.y);   // ring's half height on screen
  uprightAt(ctx, s.x, s.y, () => {
    const m = ctx.getTransform(), cw = ctx.canvas.width, ch = ctx.canvas.height, sx = v => m.a * v + m.e, sy = v => m.d * v + m.f, ux = q => (q - m.e) / m.a, uy = q => (q - m.f) / m.d;
    const bx = Math.min(ux(cw) - 6 - bw / 2, Math.max(ux(0) + 6 + bw / 2, s.x)), top = uy(ch * .09);
    let by = s.y - ry - bh - 6; if (by < top) by = s.y + ry + 6; if (sy(by + bh) > ch - 4) by = Math.max(top, s.y - bh / 2);
    ctx.fillStyle = "rgba(8,10,20,.9)"; ctx.beginPath(); ctx.roundRect(bx - bw / 2, by, bw, bh, 6); ctx.fill();
    face(bx - bw / 2 + 12, by + 15, mood);
    lines.forEach(([t, c, f], i) => { ctx.font = f; ctx.fillStyle = c; ctx.fillText(t, bx + 8, by + 20 + i * 17 - (i ? 2 : 0)); });
  });
  ctx.textAlign = "left";
}

// ---------- Phone layout: fit the map, shop sheet ----------
const mq = matchMedia("(max-width:899px)"), wrapEl = $("stageWrap"), stageEl = $("stage");
let lastVH = 0;
// The map takes all the free space: on a phone the full width, on a computer the whole window next to the shop.
// When the screen is smaller than the map you scroll it with a finger or the mouse; zoomed out, the town's outskirts show around it.
function fitStage() {
  let aw = wrapEl.clientWidth, ah;
  if (mq.matches) { wrapEl.style.height = ""; ah = wrapEl.getBoundingClientRect().height; }
  else { wrapEl.style.height = ""; ah = wrapEl.getBoundingClientRect().height; }
  aw = Math.max(120, aw); ah = Math.max(120, ah);
  const w = mq.matches ? Math.floor(Math.min(aw, Math.max(ah * W / VH(), ah * 1.5))) : Math.floor(aw), h = mq.matches && !ISO ? Math.floor(Math.min(ah, w * VH() / W)) : Math.floor(ah);   // isometric: the map always takes all the free height (it zooms and pans)   // computer: the whole free area
  stageEl.style.width = w + "px"; stageEl.style.height = h + "px"; stageEl.style.aspectRatio = ""; layoutTilt();
  lastVH = VH();
}
new ResizeObserver(fitStage).observe(wrapEl); mq.addEventListener("change", fitStage); addEventListener("resize", fitStage); fitStage();
let shopPaused = false;
function setShop(open) {
  document.body.classList.toggle("shop-open", open);
  if (open) { shopPaused = S.started && !S.paused; if (shopPaused) S.paused = true; }
  else if (shopPaused) { S.paused = false; shopPaused = false; }
  setPauseLabel();
}
const setSide = off => { document.body.classList.toggle("side-off", off); try { localStorage.setItem("lightThemUp.sideOff", off ? "1" : ""); } catch (e) {} };
try { if (localStorage.getItem("lightThemUp.sideOff")) document.body.classList.add("side-off"); } catch (e) {}
$("btnShop").onclick = () => setShop(true); $("btnShop2").onclick = () => mq.matches ? setShop(true) : setSide(!document.body.classList.contains("side-off"));
$("btnShopClose").onclick = () => setShop(false);
$("scrim").onclick = () => setShop(false);
for (const id of ["upGen", "upGenFix", "upVan", "upSpeed", "upPlot", "upPatrol"]) $(id).addEventListener("click", () => { if (mq.matches) setTimeout(() => setShop(false), 250); });
setInterval(() => { if (S.started && !S.paused) save(); }, 4000);
window.__game = {freeSpot, yardOk, MSEG, XS, get MAP() { return MAP; }, spawnThief, CARS, get thieves() { return thieves; }, S, slots, houses, FIXTURES, BULBS, ROUTES, combo, computeCover, moodOf, districtTone, step, routeOpen, spawnHood, scare, tapSlot, save, readSave, load,
  view: () => ({VZ, VX, VY, VSH:VSH(), VH:VH(), W, cssW, PW:pbox().w, ISO}), proj, toWorld, cv2scr, scr2cv, setView: (z, x, y) => setView(z, x, y),
  get hoods() { return hoods; }, get zones() { return zones; }, get jobs() { return jobs; }, get traffic() { return traffic; }, get peds() { return peds; }, get vans() { return vans; }};


// ---------- Map zoom (every map): two fingers pinch and move, one finger or the mouse moves the map, mouse wheel, + − and ⤢ ----------
const ZKEY = (MAP ? "lightThemUp.zoom4" : "lightThemUp.zoomQ4") + (ISO ? "i" : "");
function setView(z, x, y) {
  VZ = z; VX = x; VY = y; fixView(); bgLater();
  try { localStorage.setItem(ZKEY, VZ.toFixed(2)); } catch (e) {}
}
let bgT = null, bgLast = 0;
function bgLater() {   // moving: redraw only when the margin runs out; zooming: stretch the old picture, redraw sharp when the fingers stop
  const zoomed = Math.abs(VZ / bgV.z - 1) > .002, dx = (VX - bgV.x) * sc * VZ, dy = (VY - bgV.y) * sc * VZ;
  const out = Math.abs(dx) > cv.width * BGM * .92 || Math.abs(dy) > cv.height * BGM * .92;
  clearTimeout(bgT);
  if (!zoomed && !out) return;
  if (out && !zoomed) { bgLast = performance.now(); drawBg(); return; }
  bgT = setTimeout(() => { bgLast = performance.now(); drawBg(); }, 140);
}
function zoomAt(z, ux, uy) { const wx = ux / VZ + VX, wy = uy / VZ + VY, nz = clamp(z, zMin(), ZMAX); setView(nz, wx - ux / nz, wy - uy / nz); }
{
  $("zoomBox").hidden = false;
  resize();
  let z0 = ISO ? (mq.matches ? 2.2 : 1.2) * (MAP ? 1.3 : 1) : (mq.matches ? 1 : Math.max(zMin(), Math.min(1, 1.6 * W / cssW))) * (MAP ? (mq.matches ? 1.4 : 1.15) : 1); try { const v = parseFloat(localStorage.getItem(ZKEY)); if (v > 0) z0 = v; } catch (e) {}
  { const P = pbox(); VZ = z0; fixView(); VX = P.x0 + (P.w - P.w / VZ) / 2; VY = MAP || ISO ? P.y0 + (P.h - VSH() / VZ) / 2 : P.y0; fixView(); drawBg(); }   // the invented quarter starts at the top, where the gang and the generator are
  const zc = z => { const c = scrCenterU(); zoomAt(z, c.x, c.y); };
  $("zIn").onclick = () => zc(VZ * 1.35);
  $("zOut").onclick = () => zc(VZ / 1.35);
  $("zFit").onclick = () => { const z = zMin(), C = ISO ? contentBox() : pbox(); setView(z, C.x0 + C.w / 2 - pbox().w / z / 2, C.y0 + C.h / 2 - VSH() / z / 2); try { localStorage.setItem(ZKEY, z); } catch (e) {} };   // whole quarter, centred
  $("zIso").classList.toggle("on", ISO);   // try the isometric view: the page reloads in the other view, the game is saved
  $("zIso").onclick = () => { try { save(); localStorage.setItem("lightThemUp.view", ISO ? "flat" : "iso"); } catch (e) {} const u = new URL(location.href); u.searchParams.delete("iso"); location.replace(u.href); };
  const stage = $("stage"), pts = new Map(); let pinch = null, pan = null, defer = null, replay = false;
  // In Borča a touch is held back until the finger lifts: a short tap acts like before, any drag only moves the map.
  // Only a touch right on the lamp you are placing goes through at once, so that lamp can still be dragged.
  const nearPending = e => { const pd = S.pending; if (!pd || pd.lamp || pd.job) return false; const p = toWorld(e); return Math.hypot(pd.x - p.x, pd.y - p.y) < hitR() * 1.6; };
  const fire = (type, d) => { replay = true; try { cv.dispatchEvent(new PointerEvent(type, {clientX:d.x, clientY:d.y, pointerId:d.id, pointerType:d.type, isPrimary:true, bubbles:true, cancelable:true})); } finally { replay = false; } };
  const unit = e => { const c = scr2cv(e.clientX, e.clientY), pw = pbox().w; return {x:c.u / cssW * pw, y:c.v / cssW * pw}; };
  stage.addEventListener("pointerdown", e => {   // a tap on the banner closes it (and does nothing else); any other tap also closes it
    if (!S.banner) return; const r = S.bannerR, q = scr2cv(e.clientX, e.clientY); S.banner = null; S.bannerR = null;
    if (r && q.u >= r.x && q.u <= r.x + r.w && q.v >= r.y && q.v <= r.y + r.h) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  stage.addEventListener("pointerdown", e => {
    if (e.target !== cv || replay) return;
    pts.set(e.pointerId, unit(e));
    if (pts.size === 1 && (e.pointerType !== "mouse" || canPan()) && (MAP || canPan()) && !nearPending(e)) { defer = {x:e.clientX, y:e.clientY, id:e.pointerId, type:e.pointerType}; e.stopPropagation(); e.preventDefault(); }
    if (pts.size === 2) {   // second finger: stop whatever the first one started and zoom instead
      cv.dispatchEvent(new Event("pointercancel")); defer = null;
      const [a, b] = [...pts.values()]; pinch = {d:Math.hypot(a.x - b.x, a.y - b.y) || 1, z:VZ, wx:(a.x + b.x) / 2 / VZ + VX, wy:(a.y + b.y) / 2 / VZ + VY}; pan = null;
      e.stopPropagation(); e.preventDefault(); return;
    }
    if (pts.size === 1) pan = {u:unit(e), x:VX, y:VY, on:false};
  }, true);
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    const u = unit(e); pts.set(e.pointerId, u);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()], z = clamp(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 1, ZMAX), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      setView(z, pinch.wx - mx / z, pinch.wy - my / z); e.stopPropagation(); return;
    }
    if (pan && !drag && canPan()) {   // one finger on the map with no lamp in hand moves the view
      if (!pan.on && Math.hypot(u.x - pan.u.x, u.y - pan.u.y) > 14) pan.on = true;
      if (pan.on) { setView(VZ, pan.x - (u.x - pan.u.x) / VZ, pan.y - (u.y - pan.u.y) / VZ); e.stopPropagation(); }
    }
    if (defer) { if (Math.hypot(e.clientX - defer.x, e.clientY - defer.y) > 10) defer.moved = true; e.stopPropagation(); }
  }, true);
  const up = e => {
    if (replay || !pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (defer && defer.id === e.pointerId) { const d = defer; defer = null; pan = null; e.stopPropagation();
      if (!d.moved && e.type === "pointerup") { fire("pointerdown", d); fire("pointerup", d); }   // a real tap: do what a tap always did
      return; } if (pinch) { e.stopPropagation(); if (pts.size < 2) { pinch = null; pan = null; } } else if (pan && pan.on) { e.stopPropagation(); pan = null; } if (!pts.size) pan = null; };
  stage.addEventListener("pointerup", up, true); stage.addEventListener("pointercancel", up, true);
  stage.addEventListener("wheel", e => { e.preventDefault(); zoomAt(VZ * (e.deltaY < 0 ? 1.15 : 1 / 1.15), unit(e).x, unit(e).y); }, {passive:false});
}
// ---------- Loop ----------

// ---------- First-minute tutorial: only once, only for a new game ----------
const TUT_KEY = "lightThemUp.tutDone3";   // new guided tutorial: shown once more to everyone
const tutCount = () => slots.filter(s => s.lamp).length + jobs.filter(j => j.type === "install").length;
function tutFree(m) {   // the best free spot; on a real map the fixed spots run out, so then look for any dark sidewalk
  const b = bestSpot(m); if (b) return {x:b.x, y:b.y};
  let best = null, bs = -1; const ls = slots.filter(s => s.lamp || s.job);
  for (let x = 20; x < W; x += 24) for (let y = 20; y < boundY(); y += 24) { const c = freeSpot({x, y}); if (!c || litAt(c.x, c.y, LIGHT_K)) continue;
    const d = Math.min(400, ...ls.map(s => Math.hypot(s.x - c.x, s.y - c.y))); if (d > bs) { bs = d; best = {x:c.x, y:c.y}; } }
  return best;
}
const tutLamp = (t, s, fx, fakeOnly) => ({el:"cv", t, s, act:true, enter:() => { if (fakeOnly === !!MAP) return false; tut.n0 = tutCount(); S.money = Math.max(S.money, 60); if (S.tool !== fx) setTool(fx); },
  spot:() => { if (S.pending) return {x:S.pending.x, y:S.pending.y}; if (!tut.spot) { const m = toolModel(); tut.spot = m && tutFree(m); } return tut.spot; }, done:() => tutCount() > tut.n0});
const TUT = [   // one thing at a time; the bulb row and the reflector stay hidden until the end
  {el:"cv", t:Tx("Dobrodošao"), s:Tx("Igra stoji dok ti pokazujem osnove. Vreme kreće kad završiš uputstvo ili ga preskočiš."), intro:true},
  {el:"tool-kl", t:Tx("Izaberi svetiljku"), s:Tx("Dodirni Klasični stub u donjoj traci. Ruka pokazuje gde."), act:true, done:() => !!FIXTURES[S.tool]},
  {el:"cv", t:Tx("Postavi lampu"), s:Tx("Dodirni mesto koje pokazuje ruka."), act:true, spot:() => { const m = toolModel(); if (!m) return null; if (!tut.spot) { const b = bestSpot(m); tut.spot = b ? {x:b.x, y:b.y} : null; } return tut.spot; }, done:() => !!S.pending || jobs.some(j => j.type === "install")},
  {el:"cv", t:Tx("Pogledaj krug"), s:Tx("Krug pokazuje dokle će lampa svetleti. Dodirni isto mesto još jednom ili dugme Postavi."), act:true, spot:() => S.pending ? {x:S.pending.x, y:S.pending.y} : tut.spot, done:() => jobs.some(j => j.type === "install")},
  tutLamp(Tx("Druga lampa"), Tx("Postavi još jednu lampu tamo gde pokazuje ruka. Svaka nova lampa osvetli još jedan deo kvarta, pa stanari plaćaju više."), "kl"),
  tutLamp(Tx("Treća lampa"), Tx("I treću. Krug koji se ne preklapa sa drugima donosi najviše novog svetla."), "kl", false),
  tutLamp(Tx("Fenjer u parku"), Tx("Sad fenjer, u parku. Park voli fenjer, a ulici treba jača lampa. Lice iznad lampe pokazuje da li se stanarima sviđa."), "fe", true),
  {el:"cv", t:Tx("Servis radi"), s:Tx("Servisni kombi vozi do lampi i montira ih. Sačekaj da stigne."), act:true, run:true, spot:() => { const j = jobs.find(j => j.type === "install"); return j && j.slot ? {x:j.slot.x, y:j.slot.y} : null; }, done:() => tut.t > 60 || !jobs.some(j => j.type === "install")},
  {el:"hCover", t:Tx("Prihod raste"), s:Tx("Vidiš? Svetlo je poraslo. Što je veći deo kvarta osvetljen, stanari više plaćaju i prihod raste."), wait:5},
  {el:"cv", t:Tx("Boja svetla"), s:Tx("Gore levo piše kakvo svetlo ima kvart. Kad su sve lampe iste boje, sve tople (žute) ili sve hladne (bele), stanari plaćaju 25% više. Kvart sa zgradama voli belu LED, a stari kvart sa kućama toplu žutu."), enter:() => { if (S.tool) setTool(null); }, scr:() => { const uk = badgeK(); return {x:70 * uk, y:19 * uk}; }},
  {el:"hPow", t:Tx("Struja"), s:Tx("Generator može da napaja ograničen broj lampi. Kad se brojke izjednače, kupi jači generator u Prodavnici.")},
  {el:"cv", t:Tx("Pokvarena lampa"), s:Tx("Huligani su razbili lampu: vidiš crveni X. Dodirni je i servis kreće da je popravi."), act:true,
    enter:() => { const s0 = slots.find(s => s.lamp && s.lamp.state === "ok" && !s.job && avail(s)); if (!s0) return false; s0.lamp.state = "broken"; tut.br = s0; S.money = Math.max(S.money, 60); },
    spot:() => tut.br ? {x:tut.br.x, y:tut.br.y} : null, done:() => !!tut.br.job},
  {el:"cv", t:Tx("Popravka"), s:Tx("Kombi vozi do lampe i popravlja je. Danju su popravke upola jeftinije. Izgorela sijalica se menja sama, bez novog stuba."), act:true, run:true,
    spot:() => tut.br ? {x:tut.br.x, y:tut.br.y} : null, done:() => tut.t > 60 || (!tut.br.job && tut.br.lamp && tut.br.lamp.state === "ok")},
  {el:"cv", t:Tx("Nezadovoljni stanari"), s:Tx("Tužno lice iznad lampe znači da stanarima ta lampa ne odgovara, pa plaćaju manje. Hajde da je zamenimo."), hand:"char",
    enter:() => { for (const s of slots) { if (!s.lamp || s.lamp.state !== "ok" || s.job || !avail(s) || moodOf(s, s.lamp.m)[0] >= 0) continue;
      const f = Object.keys(FIXTURES).find(f => moodOf(s, combo(f, "ob"))[0] > 0); if (f) { tut.rs = s; tut.rf = f; if (S.tool) setTool(null); return; } } return false; },
    spot:() => ({x:tut.rs.x, y:tut.rs.y})},
  {get el() { return "tool-" + (tut && tut.rf || "kl"); }, t:Tx("Izaberi pravu svetiljku"), s:Tx("Ruka pokazuje svetiljku koja se ovim stanarima sviđa. Izaberi je."), act:true, done:() => S.tool === tut.rf},
  {el:"cv", t:Tx("Zameni lampu"), s:Tx("Sad dodirni tu lampu sa tužnim licem. Radar pokaže da li se stanarima sviđa, a drugi dodir naruči zamenu."), act:true,
    enter:() => { S.money = Math.max(S.money, 60); }, spot:() => ({x:tut.rs.x, y:tut.rs.y}), done:() => !!tut.rs.job},
  {el:"cv", t:Tx("Dolazi huligan"), s:Tx("Gledaj levu ivicu: odatle iz bande dolazi huligan (crvene oči). Ide crvenim isprekidanim putevima i traži lampe da ih razbije kamenom."), run:true, hand:"watch",
    enter:() => { const h = spawnHood(); if (!h) return false; tut.h = h; S.flashCd = 0; },
    spot:() => tut.h && tut.h.state !== "flee" && hoods.includes(tut.h) ? {x:Math.max(12, tut.h.x), y:tut.h.y} : null, done:() => tut.t > 6 || tut.h.state === "flee" || !hoods.includes(tut.h)},
  {el:"cv", t:Tx("Oteraj huligana"), s:Tx("Sad ga dodirni: baterijom ga oteraš i dobiješ 5 $. Tuda neko vreme neće prolaziti."), act:true, hand:"char",
    enter:() => { const h = tut.h; if (!h || h.state === "flee" || !hoods.includes(h)) return false; S.flashCd = 0;
      if (h.x < 30 || h.x > W - 30 || h.y < 30 || h.y > boundY() - 30) { const k = h.path.findIndex((q, i) => i >= h.i && q.x > 40 && q.x < W - 40 && q.y > 40 && q.y < boundY() - 40); if (k >= 0) { h.i = k; h.x = h.path[k].x; h.y = h.path[k].y; } } },
    spot:() => tut.h && tut.h.state !== "flee" ? {x:tut.h.x, y:tut.h.y} : null, done:() => tut.h.state === "flee" || !hoods.includes(tut.h)},
  {el:"cv", t:Tx("Dolazi lopov"), s:Tx("Gledaj: sa ivice kvarta ulazi lopov (žute oči). Ide ka mračnom stanu ili kolima da ih opljačka. Svetlo ga hvata."), run:true, hand:"watch",
    enter:() => { S.tips.thief = 1; const n = thieves.length; for (let k = 0; k < 20 && thieves.length === n; k++) spawnThief(); if (thieves.length === n) return false; tut.th = thieves[thieves.length - 1]; },
    spot:() => tut.th && !tut.th.gone ? {x:clamp(tut.th.x, 12, W - 12), y:clamp(tut.th.y, 12, boundY() - 12)} : null, done:() => tut.t > 6 || tut.th.gone || tut.th.state !== "go"},
  {el:"cv", t:Tx("Uhvati lopova"), s:Tx("Dodirni ga da ga uhvatiš. Nagrada je 20 $."), act:true, hand:"char",
    enter:() => { const t = tut.th; if (!t || t.gone || !thieves.includes(t)) return false; t.x = clamp(t.x, 24, W - 24); t.y = clamp(t.y, 24, boundY() - 24); },
    spot:() => tut.th && !tut.th.gone ? {x:tut.th.x, y:tut.th.y} : null, done:() => tut.th.gone || !thieves.includes(tut.th)},
  {el:"cv", t:Tx("Šetalište"), s:Tx("Šetalište kupuješ u Prodavnici. Donosi 40% više novca ako je uvek osvetljeno toplim svetlom: fenjeri i klasični stubovi."), enter:() => { if (MAP) return false; }, spot:() => ({x:ZONES2.cen.r[0] + ZONES2.cen.r[2] / 2, y:ZONES2.cen.r[1] + ZONES2.cen.r[3] / 2})},
  {el:"cv", t:Tx("Industrija"), s:Tx("Industrijska zona plaća 60% više, ali samo uz belu LED svetlost (Ulična LED). Tamo ne stavljaj žute lampe."), enter:() => { if (MAP) return false; }, spot:() => ({x:ZONES2.ind.r[0] + ZONES2.ind.r[2] / 2, y:ZONES2.ind.r[1] + ZONES2.ind.r[3] / 2})},
  {el:"gang", t:Tx("Banda"), s:Tx("Od 2. noći dolaze huligani i lome lampe. Dodirni huligana da ga oteraš baterijom. Svetle ulice ih teraju.")},
  {el:"btnShop2", t:Tx("Prodavnica"), s:Tx("Ovde kupuješ jači generator, još kombija i nove zone. To je sve, srećno!"), last:true},
];
let tut = null;
function tutStart(force) { try { if (!force && localStorage.getItem(TUT_KEY)) return; } catch (e) { return; } tut = {i:0, t:0}; document.body.classList.add("tut-on"); tutShow(); }
function tutEnd() { tut = null; $("tut").hidden = true; $("tutHand").hidden = true; $("tutNext").hidden = false; document.body.classList.remove("tut-on"); document.querySelectorAll(".tut-hi").forEach(e => e.classList.remove("tut-hi")); try { localStorage.setItem(TUT_KEY, "1"); } catch (e) {} }
function tutShow() {
  let st = TUT[tut.i]; while (st.enter && st.enter() === false && !st.last) { tut.i++; st = TUT[tut.i]; } document.querySelectorAll(".tut-hi").forEach(e => e.classList.remove("tut-hi"));
  const el0 = $(st.el), el = el0 && (el0.closest(".chip") || el0); if (el && st.el !== "cv") el.classList.add("tut-hi");
  $("tut").hidden = false; $("tutT").textContent = st.intro ? `⏸ ${st.t}` : `${tut.i}/${TUT.length - 1} · ${st.t}` + (st.wait || st.run ? "" : " · ⏸"); $("tutS").textContent = st.s; $("tutNext").textContent = st.last ? Tx("Kreni") : st.intro ? Tx("Pokaži mi") : Tx("Dalje"); $("tutSkip").textContent = st.intro ? Tx("Igram sam") : Tx("Preskoči"); tut.t = 0; tut.spot = null; tutPos();
}
function tutHand() {   // the pointing hand: on the target button, or on the map spot to tap
  const st = TUT[tut.i], h = $("tutHand"); let x = null, y = null; h.className = "tut-hand" + (st.hand ? " " + st.hand : "");
  const sp = st.spot && st.spot(), sc0 = st.scr && st.scr();
  const spScr = sp => { const q = proj(sp.x, sp.y), f = VZ * cssW / pbox().w; return cv2scr((q.x - VX) * f, (q.y - VY) * f); };
  if (sc0) { const r = stRect(); x = r.left + sc0.x * osW / W; y = r.top + sc0.y * osW / W; } else
  if (sp && !inStage(spScr(sp), 40)) { const c = scrCenterU(); setView(VZ, sp.x - c.x / VZ, sp.y - c.y / VZ); }   // bring the spot into view
  if (sp) { const q = spScr(sp); x = q.x; y = q.y; if (!inStage(q)) x = null; }
  else if (st.el !== "cv") { const e0 = $(st.el), e = e0 && (e0.closest(".chip") || e0); if (e && e.offsetParent) { const r = e.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; } }
  h.hidden = x === null; if (x !== null) { h.style.left = x + "px"; h.style.top = y + "px"; }
  const needs = st.act || (st.actIf && sp); $("tutNext").hidden = !!needs && !st.last;
}
function tutPos() {
  if (!tut) return; tutHand(); const id = TUT[tut.i].el, el0 = $(id), el = el0 && (el0.closest(".chip") || el0), box = $("tut"); if (!el) return;
  const r = el.getBoundingClientRect(), bh = box.offsetHeight, bw = box.offsetWidth;
  let top = id === "cv" ? (TUT[tut.i].spot && !$("tutHand").hidden && parseFloat($("tutHand").style.top) > r.top + r.height / 2 ? r.top + 12 : r.bottom - bh - 12) : r.top - bh - 12; if (top < 8) top = r.bottom + 12;
  box.style.top = Math.max(8, Math.min(innerHeight - bh - 8, top)) + "px"; box.style.left = Math.max(8, Math.min(innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)) + "px";
}
function tutTick(dt) { if (!tut) return; const vis = ov.hidden ? "" : "hidden"; $("tut").style.visibility = vis; $("tutHand").style.visibility = vis; if (S.paused || !ov.hidden) return; const st = TUT[tut.i]; tut.t += dt; if ((st.done && st.done()) || (st.wait && tut.t > st.wait)) tutNext(); else tutPos(); }
function tutNext() { if (!tut) return; if (TUT[tut.i].last) { tutEnd(); return; } tut.i++; tutShow(); }
$("tutNext").onclick = tutNext; $("tutSkip").onclick = tutEnd;
$("btnTut").onclick = () => { $("btnTut").hidden = true; $("btnStart").click(); setTimeout(() => tutStart(true), 300); };
const CHIP_HELP = {hMoney:Tx("Novac: od njega kupuješ lampe, popravke i stvari u Prodavnici."), hInc:Tx("Prihod: koliko zarađuješ u sekundi. Stanari plaćaju noću, dok im lampe svetle."), hCover:Tx("Svetlo: koliki deo kvarta je osvetljen. Cilj je da sve svetli."), hPow:Tx("Struja: koliko lampi troši i koliko generator može da da. Kad se napuni, kupi jači generator."), hPhase:Tx("Vreme do zore ili do noći. Noću se zarađuje, a danju su popravke jeftinije.")};
for (const id in CHIP_HELP) { const b = $(id), c = b && b.closest(".chip"); if (c) { c.style.cursor = "help"; c.addEventListener("click", () => msg(CHIP_HELP[id])); } }
let last = performance.now(), uiT = 0;
function frame(now) {
  const dt = Math.min(.15, (now - last) / 1000); last = now;   // a slow frame no longer slows the game down: it runs in steps of at most 50 ms
  const hold = S.paused || (tut && !TUT[tut.i].wait && !TUT[tut.i].run);   // the game stands still while the tutorial explains
  if (hold) step(0); else for (let r = dt; r > 1e-6; r -= .05) step(Math.min(.05, r));
  tutTick(dt);
  render();
  uiT -= dt; if (uiT <= 0) { uiT = .12; updateUI(); }
  requestAnimationFrame(frame);
}
resize(); step(0); updateUI(); requestAnimationFrame(frame);
})();
