import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  RefreshCw, Sparkles, ShoppingCart, Wrench,
  TrendingUp, X, ChevronRight, Zap, DollarSign,
} from 'lucide-react'

const TABS = ['Dashboard', 'AI Insights', 'AI Predictions', 'Add Asset'] as const
type Tab = (typeof TABS)[number]

const TAB_DURATION: Record<Tab, number> = {
  Dashboard: 6000,
  'AI Insights': 9000,
  'AI Predictions': 6000,
  'Add Asset': 6000,
}

// ── Animated counter (mounts, counts up once) ─────────────────────────────────
function AnimCounter({ to }: { to: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let v = 0
    const step = to / 38
    const t = setInterval(() => {
      v += step
      if (v >= to) { setVal(to); clearInterval(t) }
      else setVal(Math.round(v))
    }, 28)
    return () => clearInterval(t)
  }, [to])
  return <>{val.toLocaleString()}</>
}

// ── Blinking cursor ───────────────────────────────────────────────────────────
function Caret() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ repeat: Infinity, duration: 0.65, ease: 'linear' }}
      className="inline-block w-[2px] h-[1em] bg-vault-amber align-middle ml-0.5"
    />
  )
}

// ── SVG Donut chart ───────────────────────────────────────────────────────────
const DONUT_SEGS = [
  { label: 'Assigned',    count: 341, pct: 58.4, color: '#22C55E' },
  { label: 'Registered',  count: 87,  pct: 14.9, color: '#374151' },
  { label: 'In Repair',   count: 74,  pct: 12.7, color: '#F97316' },
  { label: 'Lost',        count: 52,  pct: 8.9,  color: '#EF4444' },
  { label: 'Written Off', count: 30,  pct: 5.1,  color: '#1F2937' },
]

function DonutChart() {
  const cx = 62, cy = 62, r = 50
  return (
    <div className="flex items-center gap-5">
      <svg width="124" height="124" viewBox="0 0 124 124" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A1A28" strokeWidth="14" />
        {DONUT_SEGS.map((seg, i) => {
          const cumPct = DONUT_SEGS.slice(0, i).reduce((s, x) => s + x.pct, 0)
          const rot = cumPct * 3.6 - 90
          return (
            <motion.circle
              key={seg.label}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="13"
              pathLength="100"
              initial={{ strokeDasharray: '0 100' }}
              animate={{ strokeDasharray: `${seg.pct} ${100 - seg.pct}` }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.14, ease: 'easeOut' }}
              style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy}px` }}
            />
          )
        })}
        <text x={cx} y={cx - 6} textAnchor="middle" fill="#8E8EA8" fontSize="9.5"
          fontFamily="monospace" fontWeight="600" letterSpacing="1">ACTIVE</text>
        <text x={cx} y={cx + 10} textAnchor="middle" fill="#F5A623" fontSize="14"
          fontFamily="monospace" fontWeight="700">61%</text>
      </svg>

      <div className="space-y-1.5 min-w-[110px]">
        {DONUT_SEGS.map((seg) => (
          <motion.div
            key={seg.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-between gap-3 text-[10px]"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-vault-muted-text">{seg.label}</span>
            </div>
            <span className="font-[family-name:var(--font-mono)] font-semibold text-vault-text">{seg.count}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Squarified treemap ────────────────────────────────────────────────────────
const CATS = [
  { name: 'IT',         count: 98,  color: '#A0291E' },
  { name: 'FURNITURE',  count: 91,  color: '#1E7A3C' },
  { name: 'NETWORKING', count: 84,  color: '#1A6FA3' },
  { name: 'SERVER',     count: 79,  color: '#B87A10' },
  { name: 'SECURITY',   count: 71,  color: '#6D2893' },
  { name: 'PRINTING',   count: 56,  color: '#C0621A' },
  { name: 'MOBILE',     count: 58,  color: '#B01455' },
  { name: 'OFFICE',     count: 47,  color: '#007068' },
]

interface TRect { x: number; y: number; w: number; h: number; idx: number; count: number; name: string }

function squarifyLayout(items: typeof CATS, W: number, H: number): TRect[] {
  if (!items.length) return []
  const total = items.reduce((s, d) => s + d.count, 0)
  const area = W * H
  const data = items.map((d, i) => ({ ...d, area: (d.count / total) * area, idx: i }))
  const rects: TRect[] = []
  let x = 0, y = 0, w = W, h = H

  function layoutRow(row: typeof data, rowArea: number, horiz: boolean) {
    if (horiz) {
      const rw = rowArea / h; let cy = y
      for (const d of row) { const dh = d.area / rw; rects.push({ x, y: cy, w: rw, h: dh, idx: d.idx, count: d.count, name: d.name }); cy += dh }
      x += rw; w -= rw
    } else {
      const rh = rowArea / w; let cx = x
      for (const d of row) { const dw = d.area / rh; rects.push({ x: cx, y, w: dw, h: rh, idx: d.idx, count: d.count, name: d.name }); cx += dw }
      y += rh; h -= rh
    }
  }

  function worst(row: typeof data, side: number): number {
    const ra = row.reduce((s, d) => s + d.area, 0)
    return row.reduce((mx, d) => { const rl = ra / side; const il = d.area / rl; return Math.max(mx, Math.max(rl / il, il / rl)) }, 0)
  }

  let rem = [...data]
  while (rem.length > 0) {
    const horiz = w < h; const side = horiz ? h : w
    const row = [rem[0]]; rem = rem.slice(1)
    while (rem.length > 0) {
      const cand = [...row, rem[0]]
      if (worst(cand, side) <= worst(row, side)) { row.push(rem[0]); rem = rem.slice(1) } else break
    }
    layoutRow(row, row.reduce((s, d) => s + d.area, 0), horiz)
  }
  return rects
}

function Treemap() {
  const W = 560, H = 196, GAP = 3
  const total = CATS.reduce((s, c) => s + c.count, 0)
  const rects = squarifyLayout(CATS, W, H)

  return (
    <div className="relative w-full" style={{ paddingBottom: `${(H / W) * 100}%` }}>
      <div className="absolute inset-0">
        {rects.map((r, i) => {
          const pct = ((r.count / total) * 100).toFixed(0)
          const isLarge = (r.w / W) * 100 > 14 && (r.h / H) * 100 > 28
          return (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.055, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="absolute overflow-hidden flex flex-col justify-between"
              style={{
                left: `calc(${(r.x / W) * 100}% + ${GAP / 2}px)`,
                top: `calc(${(r.y / H) * 100}% + ${GAP / 2}px)`,
                width: `calc(${(r.w / W) * 100}% - ${GAP}px)`,
                height: `calc(${(r.h / H) * 100}% - ${GAP}px)`,
                backgroundColor: CATS[r.idx].color,
                borderRadius: 6,
              }}
            >
              <div className="absolute inset-0 opacity-[0.10]"
                style={{ background: 'linear-gradient(135deg,#fff,transparent)' }} />
              <div className="relative flex flex-col justify-between h-full p-1.5 pb-0">
                <p className="text-[7.5px] font-bold text-white/80 uppercase tracking-wider leading-none">{r.name}</p>
                <div className="pb-1">
                  {isLarge ? (
                    <>
                      <p className="text-[22px] font-bold text-white leading-none" style={{ fontFamily: "'DM Mono', monospace" }}>{r.count}</p>
                      <p className="text-[9px] text-white/55" style={{ fontFamily: "'DM Mono', monospace" }}>{pct}%</p>
                    </>
                  ) : (
                    <p className="text-[14px] font-bold text-white leading-none" style={{ fontFamily: "'DM Mono', monospace" }}>{r.count}</p>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="relative h-[3px] w-full bg-black/20">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.4 + i * 0.04, duration: 0.5, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 bg-white/40 origin-left"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── KPI cards ─────────────────────────────────────────────────────────────────
const KPIS = [
  { label: 'TOTAL ASSETS', val: 584, sub: '$4,837,210',         color: 'text-vault-amber',    badge: null },
  { label: 'ASSIGNED',     val: 341, sub: '58% utilization',   color: 'text-vault-green',    badge: '↑ 58%' },
  { label: 'IN REPAIR',    val: 74,  sub: 'Pending service',   color: 'text-vault-orange',   badge: null },
  { label: 'LOST',         val: 52,  sub: 'Under investigation',color: 'text-vault-red',     badge: null },
  { label: 'WRITTEN OFF',  val: 30,  sub: 'Decommissioned',    color: 'text-vault-disabled', badge: null },
]

function DashboardMockup() {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {KPIS.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="bg-vault-elevated rounded-xl p-3 border border-vault-border/50"
          >
            <p className="text-[8.5px] text-vault-muted-text uppercase tracking-wider mb-1.5">{k.label}</p>
            <div className={`text-[22px] font-bold font-[family-name:var(--font-mono)] leading-none ${k.color} flex items-end gap-1`}>
              <AnimCounter to={k.val} />
              {k.badge && <span className="text-[10px] text-vault-green mb-0.5">{k.badge}</span>}
            </div>
            <p className="text-[9px] text-vault-muted-text mt-1">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.32, duration: 0.5 }}
          className="bg-vault-elevated rounded-xl p-4 border border-vault-border/50"
        >
          <p className="text-[8.5px] text-vault-muted-text uppercase tracking-[2px] mb-3">Status Distribution</p>
          <DonutChart />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.38, duration: 0.5 }}
          className="bg-vault-elevated rounded-xl p-4 border border-vault-border/50"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[8.5px] text-vault-muted-text uppercase tracking-[2px]">Asset Categories</p>
            <p className="text-[9px] text-vault-muted-text">8 categories · 297 assets</p>
          </div>
          <Treemap />
        </motion.div>
      </div>
    </div>
  )
}

// ── AI Insights ───────────────────────────────────────────────────────────────
const SUMMARY = 'The asset portfolio consists of 584 assets with a total value of $4,837,210.00, with 58% of assets assigned and 14% written off or lost, indicating a need for optimization and risk management. The portfolio is diverse, with assets allocated across 8 categories and 5 branch offices.'

function TypeWriter({ text }: { text: string }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    let i = 0
    const t = setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(t)
    }, 14)
    return () => clearInterval(t)
  }, [text])

  return (
    <p className="text-[12px] text-vault-text leading-relaxed">
      {shown}
      {shown.length < text.length && <Caret />}
    </p>
  )
}

const HIGHLIGHTS = [
  '58% of assets (341) are assigned, with the highest concentration in IT and Networking',
  '14% of assets (82) are written off or lost, resulting in a potential loss of value',
  'The IT category leads with 98 assets, followed by Furniture (91) and Networking (84)',
]
const RISKS = [
  '7 assets have warranties expiring within 90 days, posing a risk of repair costs',
  'The high number of status changes (294) may indicate inefficient asset management',
]
const ACTIONS = [
  'Conduct a thorough review of assigned assets to identify reallocation opportunities',
  'Develop a plan to mitigate warranty expirations with proactive maintenance scheduling',
]

function AIInsightsMockup() {
  const tw = SUMMARY.length * 14 + 300 // ms after which sub-sections appear
  const d = (extra: number) => ({ delay: tw / 1000 + extra })

  return (
    <div className="p-5 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-vault-amber" />
          <span className="text-[10px] font-bold text-vault-amber uppercase tracking-[2px]">AI Insights</span>
        </div>
        <button className="flex items-center gap-1.5 text-[10px] text-vault-muted-text border border-vault-border rounded-md px-2.5 py-1 hover:border-vault-border-focus transition-colors">
          <RefreshCw className="h-3 w-3" /> Generate
        </button>
      </div>

      <TypeWriter text={SUMMARY} />

      {/* Highlights */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={d(0.1)}>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="h-3 w-3 text-vault-green" />
          <span className="text-[9.5px] font-bold text-vault-green uppercase tracking-[1.5px]">Highlights</span>
        </div>
        {HIGHLIGHTS.map((h, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: tw / 1000 + 0.18 + i * 0.11 }}
            className="flex gap-2 text-[11.5px] text-vault-muted-text mt-1.5"
          >
            <ChevronRight className="h-3 w-3 text-vault-green flex-shrink-0 mt-0.5" />
            {h}
          </motion.div>
        ))}
      </motion.div>

      {/* Risks */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={d(0.55)}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-vault-red text-xs leading-none">⊗</span>
          <span className="text-[9.5px] font-bold text-vault-red uppercase tracking-[1.5px]">Risks</span>
        </div>
        {RISKS.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: tw / 1000 + 0.6 + i * 0.1 }}
            className="flex gap-2 text-[11.5px] text-vault-muted-text mt-1.5"
          >
            <ChevronRight className="h-3 w-3 text-vault-red flex-shrink-0 mt-0.5" />
            {r}
          </motion.div>
        ))}
      </motion.div>

      {/* Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={d(0.95)}>
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3 w-3 text-vault-yellow" />
          <span className="text-[9.5px] font-bold text-vault-yellow uppercase tracking-[1.5px]">Actions</span>
        </div>
        {ACTIONS.map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: tw / 1000 + 1.0 + i * 0.1 }}
            className="flex gap-2 text-[11.5px] text-vault-muted-text mt-1.5"
          >
            <ChevronRight className="h-3 w-3 text-vault-yellow flex-shrink-0 mt-0.5" />
            {a}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

// ── AI Predictions ────────────────────────────────────────────────────────────
const PURCHASES = [
  { cat: 'IT',       priority: 'HIGH',   pc: 'bg-red-900/40 text-red-400',    reason: 'High status changes and average age of 3.8 years', qty: 'x5', cost: '$25,000' },
  { cat: 'SECURITY', priority: 'MEDIUM', pc: 'bg-yellow-900/40 text-yellow-400', reason: 'Warranties expiring in the next 180 days',       qty: 'x7', cost: '$35,000' },
  { cat: 'SERVER',   priority: 'LOW',    pc: 'bg-green-900/40 text-green-400',  reason: 'Warranties expiring and average age of 4.0 years',  qty: 'x3', cost: '$20,000' },
]
const MAINT = [
  { text: 'Increased maintenance for SECURITY and IT assets due to warranty expirations', period: 'next 3 months', count: '10 assets' },
  { text: 'Regular maintenance for NETWORKING assets',                                    period: 'next 6 months', count: '5 assets' },
]

function AIPredictionsMockup() {
  return (
    <div className="p-5 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-vault-amber" />
          <span className="text-[10px] font-bold text-vault-amber uppercase tracking-[2px]">AI Predictions</span>
        </div>
        <button className="flex items-center gap-1.5 text-[10px] text-vault-muted-text border border-vault-border rounded-md px-2.5 py-1 hover:border-vault-border-focus transition-colors">
          <RefreshCw className="h-3 w-3" /> Generate
        </button>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <ShoppingCart className="h-3.5 w-3.5 text-vault-yellow" />
          <span className="text-[9.5px] font-bold text-vault-yellow uppercase tracking-[1.5px]">Predicted Purchases</span>
        </div>
        <div className="space-y-2">
          {PURCHASES.map((p, i) => (
            <motion.div key={p.cat}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.13, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-vault-elevated border border-vault-border/50"
            >
              <span className="text-[12px] font-bold font-[family-name:var(--font-mono)] text-vault-text w-20">{p.cat}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.pc}`}>{p.priority}</span>
              <span className="flex-1 text-[11px] text-vault-muted-text">{p.reason}</span>
              <div className="text-right flex-shrink-0">
                <div className="text-[13px] font-bold text-vault-text font-[family-name:var(--font-mono)]">{p.qty}</div>
                <div className="text-[10px] text-vault-muted-text">{p.cost}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Wrench className="h-3.5 w-3.5 text-vault-blue" />
          <span className="text-[9.5px] font-bold text-vault-blue uppercase tracking-[1.5px]">Maintenance Forecast</span>
        </div>
        <div className="space-y-2">
          {MAINT.map((m, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52 + i * 0.13, duration: 0.4 }}
              className="flex gap-3 px-4 py-3 rounded-xl bg-vault-elevated border border-vault-border/50"
            >
              <Wrench className="h-3.5 w-3.5 text-vault-blue flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11.5px] font-medium text-vault-text">{m.text}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-vault-muted-text">{m.period}</span>
                  <span className="text-[10px] text-vault-blue font-medium">{m.count}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="flex items-center justify-between px-4 py-3 rounded-xl bg-vault-elevated border border-vault-amber/20"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-vault-amber" />
          <span className="text-[10px] font-bold text-vault-amber uppercase tracking-[1.5px]">Budget Outlook</span>
          <span className="text-[11px] text-vault-muted-text ml-2">Estimated next quarter spend</span>
        </div>
        <span className="text-[15px] font-bold text-vault-amber font-[family-name:var(--font-mono)]">$80,000</span>
      </motion.div>
    </div>
  )
}

// ── Add Asset Form ────────────────────────────────────────────────────────────
function AssetFormMockup() {
  const [nameVal, setNameVal] = useState('')
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    const txt = 'Dell mon'
    let i = 0
    const t = setInterval(() => {
      i++
      setNameVal(txt.slice(0, i))
      if (i >= txt.length) { clearInterval(t); setTimeout(() => setShowAI(true), 500) }
    }, 90)
    return () => clearInterval(t)
  }, [])

  const fields = [
    { label: 'Asset Type',     placeholder: 'e.g., Monitor, Laptop, Desk' },
    { label: 'Serial Number',  placeholder: 'e.g., SN-2024-001' },
  ]

  return (
    <div className="flex items-center justify-center min-h-full py-6 px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.04) 0%, transparent 60%)' }}
    >
      <div className="w-full max-w-md">
        {/* Modal-style card */}
        <div className="bg-vault-surface rounded-2xl border border-vault-border/60 shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-vault-border/50">
            <div>
              <h3 className="text-[15px] font-semibold text-vault-text">Add New Asset</h3>
              <p className="text-[11px] text-vault-muted-text mt-0.5">Fill in the details below</p>
            </div>
            <X className="h-4 w-4 text-vault-muted-text" />
          </div>

          <div className="px-6 pt-4 pb-5">
            {/* Steps */}
            <div className="flex items-center gap-2 mb-5">
              {[{ n: 1, l: 'Basic Info' }, { n: 2, l: 'Details' }, { n: 3, l: 'Location' }].map((s, i) => (
                <div key={s.n}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                    i === 0
                      ? 'bg-vault-amber text-vault-black'
                      : 'bg-vault-elevated text-vault-muted-text border border-vault-border'
                  }`}
                >
                  {s.n} {s.l}
                </div>
              ))}
            </div>

            <div className="space-y-3.5">
              {/* Asset Name — typing animation */}
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <label className="block text-[12px] font-medium text-vault-text mb-1.5">Asset Name</label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-vault-amber/50 bg-vault-black text-[12px] text-vault-text min-h-[38px]">
                  {nameVal}
                  <Caret />
                </div>
              </motion.div>

              {fields.map((f, i) => (
                <motion.div key={f.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + i * 0.1 }}
                >
                  <label className="block text-[12px] font-medium text-vault-text mb-1.5">{f.label}</label>
                  <div className="w-full px-3 py-2.5 rounded-lg border border-vault-border bg-vault-black text-[12px] text-vault-muted-text/50">
                    {f.placeholder}
                  </div>
                </motion.div>
              ))}

              {/* Category + AI suggestion — always reserves height */}
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <label className="block text-[12px] font-medium text-vault-text mb-1.5">Category</label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-vault-border bg-vault-black text-[12px] text-vault-text flex items-center justify-between">
                  IT
                  <ChevronRight className="h-3.5 w-3.5 rotate-90 text-vault-muted-text" />
                </div>

                {/* Fixed-height slot so layout never shifts */}
                <div className="mt-1.5 min-h-[40px]">
                  <AnimatePresence>
                    {showAI && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="px-3 py-2 rounded-lg border border-vault-amber/35 bg-vault-amber/6 cursor-pointer hover:bg-vault-amber/10 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                          <Sparkles className="h-3 w-3 text-vault-amber flex-shrink-0" />
                          <span className="text-vault-amber font-semibold">AI suggests:</span>
                          <span className="font-bold text-vault-amber">SERVER</span>
                          <span className="text-vault-muted-text">(80% confidence) — Click to apply</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 }} className="grid grid-cols-2 gap-3"
              >
                {['Brand', 'Model'].map((l, i) => (
                  <div key={l}>
                    <label className="block text-[12px] font-medium text-vault-text mb-1.5">{l}</label>
                    <div className="px-3 py-2.5 rounded-lg border border-vault-border bg-vault-black text-[12px] text-vault-muted-text/50">
                      {i === 0 ? 'e.g., Dell' : 'e.g., U2723QE'}
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Purchase value */}
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
                <label className="block text-[12px] font-medium text-vault-text mb-1.5">Purchase Value</label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-vault-border bg-vault-black text-[12px] text-vault-muted-text/50 flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 text-vault-muted-text/40" />
                  e.g., 1200.00
                </div>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}
              className="mt-5 flex items-center justify-between"
            >
              <p className="text-[10.5px] text-vault-muted-text/60 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-vault-amber/40" />
                AI will auto-tag and categorize
              </p>
              <button className="flex items-center gap-1.5 px-5 py-2.5 bg-vault-amber text-vault-black text-[13px] font-semibold rounded-lg hover:bg-amber-400 transition-colors">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ duration, running }: { duration: number; running: boolean }) {
  return (
    <div className="h-[2px] w-full bg-vault-border/40 overflow-hidden">
      <motion.div
        key={running ? 'run' : 'idle'}
        className="h-full bg-vault-amber/60"
        initial={{ scaleX: 0, originX: 0 }}
        animate={running ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
      />
    </div>
  )
}

// ── Showcase wrapper ──────────────────────────────────────────────────────────
export default function ProductShowcase() {
  const [active, setActive] = useState<Tab>('Dashboard')
  const [key, setKey] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const switchTo = (tab: Tab) => { setActive(tab); setKey((k) => k + 1) }

  useEffect(() => {
    const t = setTimeout(() => {
      const i = TABS.indexOf(active)
      switchTo(TABS[(i + 1) % TABS.length])
    }, TAB_DURATION[active])
    return () => clearTimeout(t)
  }, [active, key])

  return (
    <section ref={ref} className="py-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-[11px] font-semibold text-vault-amber uppercase tracking-[3px] mb-3">Product</p>
          <h2 className="text-3xl font-bold text-vault-text" style={{ fontFamily: "'DM Mono', monospace" }}>
            See it in action.
          </h2>
        </motion.div>

        {/* Tab pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="flex justify-center mb-6"
        >
          <div className="flex gap-1 p-1 bg-vault-surface border border-vault-border rounded-xl">
            {TABS.map((tab) => {
              const isAI = tab === 'AI Insights' || tab === 'AI Predictions'
              const isActive = active === tab
              return (
                <button
                  key={tab}
                  onClick={() => switchTo(tab)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                    isActive && isAI
                      ? 'bg-vault-amber/15 text-vault-amber shadow-[0_0_14px_rgba(245,158,11,0.3),inset_0_0_0_1px_rgba(245,158,11,0.25)]'
                      : isActive
                      ? 'bg-vault-amber/10 text-vault-amber'
                      : isAI
                      ? 'text-vault-amber/55 hover:text-vault-amber/85 hover:bg-vault-amber/6'
                      : 'text-vault-muted-text hover:text-vault-text'
                  }`}
                >
                  {isAI && (
                    <Sparkles className={`h-3 w-3 flex-shrink-0 ${isActive ? 'text-vault-amber' : 'text-vault-amber/55'}`} />
                  )}
                  {tab}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Browser chrome */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-vault-border bg-vault-surface overflow-hidden
            shadow-[0_40px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(245,166,35,0.07)]"
        >
          {/* Title bar */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-vault-border bg-vault-muted/20">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-4 py-1 bg-vault-black rounded-md border border-vault-border/60 text-[11px] text-vault-muted-text font-[family-name:var(--font-mono)]">
                <span className="w-1.5 h-1.5 rounded-full bg-vault-green animate-pulse" />
                asset.datamou.uz/{active.toLowerCase().replace(' ', '-')}
              </div>
            </div>
            <div className="w-14" />
          </div>

          {/* Auto-advance progress */}
          <ProgressBar duration={TAB_DURATION[active]} running={inView} key={`pb-${active}-${key}`} />

          {/* Content area — fixed height so no layout shift between tabs */}
          <div className="h-[520px] overflow-y-auto overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${active}-${key}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                {active === 'Dashboard'       && <DashboardMockup />}
                {active === 'AI Insights'     && <AIInsightsMockup />}
                {active === 'AI Predictions'  && <AIPredictionsMockup />}
                {active === 'Add Asset'       && <AssetFormMockup />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 py-3 border-t border-vault-border/30">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => switchTo(tab)}
                className={`rounded-full transition-all duration-300 ${
                  active === tab ? 'w-5 h-1.5 bg-vault-amber' : 'w-1.5 h-1.5 bg-vault-border hover:bg-vault-border-focus'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
