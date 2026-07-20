import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Lightbulb, Check, ChevronDown, ChevronRight } from 'lucide-react'

const CARD =
  'rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-24px_rgba(16,24,40,0.18)]'
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/* ── 1. AI category suggestion (types a name, AI suggests + applies) ── */
const AI_NAME = 'Dell UltraSharp Monitor'

export function AISuggestDemo() {
  const reduce = useReducedMotion()
  const [typed, setTyped] = useState(reduce ? AI_NAME : '')
  const [phase, setPhase] = useState<'typing' | 'suggest' | 'applied'>(reduce ? 'applied' : 'typing')

  useEffect(() => {
    if (reduce) return
    let alive = true
    let timers: ReturnType<typeof setTimeout>[] = []
    const clear = () => { timers.forEach(clearTimeout); timers = [] }
    const cycle = () => {
      clear(); setTyped(''); setPhase('typing')
      let i = 0
      const type = () => {
        if (!alive) return
        i++; setTyped(AI_NAME.slice(0, i))
        if (i < AI_NAME.length) timers.push(setTimeout(type, 78))
        else {
          timers.push(setTimeout(() => alive && setPhase('suggest'), 500))
          timers.push(setTimeout(() => alive && setPhase('applied'), 2100))
          timers.push(setTimeout(cycle, 5000))
        }
      }
      timers.push(setTimeout(type, 450))
    }
    cycle()
    return () => { alive = false; clear() }
  }, [reduce])

  const applied = phase === 'applied'
  return (
    <div className={`${CARD} p-5 w-full max-w-sm`}>
      <div className="text-[13px] font-semibold text-ink mb-4">Add asset</div>

      <label className="block text-[11px] font-medium text-body mb-1.5">Asset name</label>
      <div className="h-9 px-3 flex items-center rounded-lg border border-line bg-paper/60 text-[13px] text-ink">
        {typed}
        {!reduce && phase === 'typing' && <span className="inline-block w-[1.5px] h-4 bg-brand ml-0.5 animate-pulse" />}
      </div>

      <label className="block text-[11px] font-medium text-body mt-4 mb-1.5">Category</label>
      <div className="h-9 px-3 flex items-center justify-between rounded-lg border border-line bg-white text-[13px]">
        <motion.span key={applied ? 'it' : 'none'} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          className={applied ? 'text-ink font-medium' : 'text-muted'}>
          {applied ? 'IT' : 'Select…'}
        </motion.span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </div>

      <div className="h-10 mt-2">
        <AnimatePresence mode="wait">
          {phase === 'suggest' && (
            <motion.div key="suggest"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full flex items-center gap-2 px-3 h-9 rounded-lg border border-gold/30 bg-gold-soft/60 text-[12px]">
              <Lightbulb className="h-3.5 w-3.5 text-gold shrink-0" />
              <span className="text-body truncate">
                Suggested: <span className="font-semibold text-ink">IT</span>{' '}
                <span className="font-mono text-muted">(90%)</span>
              </span>
              <span className="ml-auto text-gold font-medium shrink-0">Apply</span>
            </motion.div>
          )}
          {applied && (
            <motion.div key="applied" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 px-1 h-9 text-[12px] text-ok">
              <Check className="h-3.5 w-3.5" /> Category applied from AI suggestion
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── 2. Audit-log diff (a row expands to reveal old vs new) ── */
const AUDIT_ROWS = [
  { date: 'Apr 17', action: 'STATUS', tone: 'bg-warn-soft text-warn', actor: 'Admin User' },
  { date: 'Mar 26', action: 'ASSIGN', tone: 'bg-ok-soft text-ok', actor: 'Admin User' },
  { date: 'Feb 06', action: 'UPDATE', tone: 'bg-[#EDF0F6] text-brand', actor: 'Manager User', expandable: true },
  { date: 'Jan 31', action: 'RETURN', tone: 'bg-line-soft text-muted', actor: 'Manager User' },
]

export function AuditDiffDemo() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(reduce ? true : false)
  useEffect(() => {
    if (reduce) return
    let alive = true
    let t: ReturnType<typeof setTimeout>[] = []
    const loop = () => {
      t.forEach(clearTimeout); t = []
      setOpen(false)
      t.push(setTimeout(() => alive && setOpen(true), 1500))
      t.push(setTimeout(loop, 5200))
    }
    loop()
    return () => { alive = false; t.forEach(clearTimeout) }
  }, [reduce])

  return (
    <div className={`${CARD} w-full max-w-md overflow-hidden`}>
      <div className="px-4 h-10 flex items-center gap-1 border-b border-line-soft text-[11px] font-mono text-muted">
        <span className="text-ink font-medium">AssetVault</span><span>/</span><span>Audit log</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-ok" />Append-only</span>
      </div>
      {AUDIT_ROWS.map((r) => (
        <div key={r.date} className="border-b border-line-soft last:border-0">
          <div className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
            <ChevronRight className={`h-3.5 w-3.5 text-muted transition-transform duration-300 ${r.expandable && open ? 'rotate-90' : ''}`} />
            <span className="text-body font-mono w-14">{r.date}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold font-mono tracking-wide ${r.tone}`}>{r.action}</span>
            <span className="ml-auto text-muted">{r.actor}</span>
          </div>
          {r.expandable && (
            <AnimatePresence initial={false}>
              {open && (
                <motion.div key="diff" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted mb-1">Old</div>
                      <pre className="text-[10px] font-mono text-danger bg-danger-soft rounded-md p-2 leading-relaxed whitespace-pre-wrap">{`{ "name": "Cisco #192" }`}</pre>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted mb-1">New</div>
                      <pre className="text-[10px] font-mono text-ok bg-ok-soft rounded-md p-2 leading-relaxed whitespace-pre-wrap">{`{\n  "name": "Cisco #192",\n  "description": "Updated"\n}`}</pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── 3. Analytics (bars grow on a loop) ── */
const DEPT_BARS = [
  { label: 'Operations', v: 45 },
  { label: 'IT', v: 34 },
  { label: 'Legal', v: 27 },
  { label: 'Security', v: 19 },
  { label: 'HR', v: 15 },
]

export function AnalyticsDemo() {
  const reduce = useReducedMotion()
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setCycle((c) => c + 1), 4200)
    return () => clearInterval(id)
  }, [reduce])
  const max = 45
  return (
    <div className={`${CARD} w-full max-w-md p-5`}>
      <div className="text-[12px] font-semibold text-ink">Department allocation</div>
      <div className="text-[11px] text-muted mb-4">Assets per department · live</div>
      <div className="space-y-3">
        {DEPT_BARS.map((b, i) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-20 text-[11px] text-body text-right shrink-0">{b.label}</span>
            <div className="flex-1 h-4 rounded bg-paper overflow-hidden">
              <motion.div key={cycle} className="h-full rounded bg-brand"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(b.v / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }} />
            </div>
            <span className="w-7 text-[11px] font-mono text-ink text-right shrink-0">{b.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
