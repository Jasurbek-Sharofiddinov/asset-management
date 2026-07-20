import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight, ArrowUpRight, ShieldCheck, ScanLine,
  ScrollText, BarChart3, Boxes, Check,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore } from '../stores/authStore'
import { AISuggestDemo, AuditDiffDemo, AnalyticsDemo } from '../components/landing/Demos'

// ── Small helpers ─────────────────────────────────────────────────────────────

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: easeOut, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Brand mark — a simple, ownable vault/ledger glyph (no generic hexagon)
function Mark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="14.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 12.1v-.01M14.4 14.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ── Status vocabulary (matches the real app) ──────────────────────────────────
const STATUS: Record<string, { label: string; dot: string; pill: string }> = {
  ASSIGNED:    { label: 'Assigned',    dot: '#197A4B', pill: 'bg-ok-soft text-ok' },
  REGISTERED:  { label: 'Registered',  dot: '#5B6472', pill: 'bg-line-soft text-body' },
  IN_REPAIR:   { label: 'In repair',   dot: '#9A6B1F', pill: 'bg-warn-soft text-warn' },
  LOST:        { label: 'Lost',        dot: '#B42318', pill: 'bg-danger-soft text-danger' },
  WRITTEN_OFF: { label: 'Written off', dot: '#98A2B3', pill: 'bg-line-soft text-muted' },
}

// ── Donut (hand-built, no chart lib) ──────────────────────────────────────────
function Donut({ segments, size = 128, stroke = 15 }: {
  segments: { value: number; color: string }[]; size?: number; stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c
        const el = (
          <circle
            key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={seg.color} strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
          />
        )
        offset += len
        return el
      })}
    </svg>
  )
}

// ── The product preview: a real, light dashboard panel ────────────────────────
const previewBreakdown = [
  { key: 'ASSIGNED', value: 178 },
  { key: 'REGISTERED', value: 46 },
  { key: 'IN_REPAIR', value: 29 },
  { key: 'LOST', value: 24 },
  { key: 'WRITTEN_OFF', value: 23 },
]

const previewRows = [
  { name: 'Dell Latitude 5540', serial: 'SN-482013-77', status: 'ASSIGNED' },
  { name: 'HP LaserJet M404dn', serial: 'AST-761204-12', status: 'IN_REPAIR' },
  { name: 'Cisco Catalyst 9300', serial: 'EQ-330771-45', status: 'ASSIGNED' },
  { name: 'iPhone 15 Pro', serial: 'INV-905513-31', status: 'REGISTERED' },
]

function ProductPreview() {
  return (
    <div className="rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-24px_rgba(16,24,40,0.18)] overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-line-soft bg-paper/60">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
        </div>
        <div className="flex items-center gap-1.5 ml-2 text-[11px] text-muted font-mono">
          <span className="text-ink font-medium">AssetVault</span>
          <span>/</span><span>Dashboard</span>
        </div>
        <span className="ml-auto text-[11px] text-muted">Tashkent HQ</span>
      </div>

      <div className="p-4 sm:p-5">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Total assets', value: '300' },
            { label: 'Assigned', value: '178' },
            { label: 'In repair', value: '29' },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-line-soft p-3">
              <div className="text-[11px] text-muted mb-1">{k.label}</div>
              <div className="text-xl font-semibold text-ink font-mono tracking-tight">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* donut */}
          <div className="rounded-lg border border-line-soft p-4">
            <div className="text-[11px] text-muted mb-3">Status breakdown</div>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Donut segments={previewBreakdown.map((b) => ({ value: b.value, color: STATUS[b.key].dot }))} size={86} stroke={11} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-semibold text-ink font-mono leading-none">300</span>
                  <span className="text-[9px] text-muted mt-0.5">assets</span>
                </div>
              </div>
              <ul className="flex-1 min-w-0 space-y-1.5 text-[11px]">
                {previewBreakdown.map((b) => (
                  <li key={b.key} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS[b.key].dot }} />
                    <span className="text-body truncate">{STATUS[b.key].label}</span>
                    <span className="ml-auto shrink-0 pl-2 text-muted font-mono tabular-nums">{b.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* mini table */}
          <div className="rounded-lg border border-line-soft overflow-hidden">
            <div className="px-3 py-2 border-b border-line-soft text-[11px] text-muted">Recent assets</div>
            <table className="w-full">
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={row.serial} className={i > 0 ? 'border-t border-line-soft' : ''}>
                    <td className="px-3 py-2">
                      <div className="text-[12px] text-ink font-medium leading-tight">{row.name}</div>
                      <div className="text-[10px] text-muted font-mono">{row.serial}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS[row.status].pill}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[row.status].dot }} />
                        {STATUS[row.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Second product view: the audit log (distinct from the dashboard) ──────────
const AUDIT_TONE: Record<string, string> = {
  STATUS: 'bg-warn-soft text-warn',
  ASSIGN: 'bg-ok-soft text-ok',
  CREATE: 'bg-[#EDF0F6] text-brand',
  RETURN: 'bg-line-soft text-muted',
}
const auditEvents = [
  { action: 'STATUS', title: 'Dell Latitude 5540', meta: 'SN-482013-77', detail: 'ASSIGNED → IN_REPAIR', who: 'Manager User', when: '2m' },
  { action: 'ASSIGN', title: 'Cisco Catalyst 9300', meta: 'EQ-330771-45', detail: 'to IT department', who: 'Admin User', when: '14m' },
  { action: 'CREATE', title: 'iPhone 15 Pro', meta: 'INV-905513-31', detail: 'added to registry', who: 'Admin User', when: '1h' },
  { action: 'RETURN', title: 'HP LaserJet M404dn', meta: 'AST-761204-12', detail: 'reason: Device malfunction', who: 'Manager User', when: '3h' },
]

function AuditPreview() {
  return (
    <div className="rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-24px_rgba(16,24,40,0.18)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 h-10 border-b border-line-soft bg-paper/60">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
        </div>
        <div className="flex items-center gap-1.5 ml-2 text-[11px] text-muted font-mono">
          <span className="text-ink font-medium">AssetVault</span><span>/</span><span>Audit log</span>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-ok" /> Append-only
        </span>
      </div>
      <ul>
        {auditEvents.map((e) => (
          <li key={e.meta} className="flex items-start gap-3 px-4 py-3 border-b border-line-soft last:border-0">
            <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold font-mono tracking-wide ${AUDIT_TONE[e.action]}`}>
              {e.action}
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] text-ink font-medium leading-tight truncate">
                {e.title} <span className="text-muted font-mono text-[10px]">{e.meta}</span>
              </div>
              <div className="text-[11.5px] text-body font-mono mt-0.5">{e.detail}</div>
            </div>
            <div className="ml-auto text-right shrink-0">
              <div className="text-[11px] text-body leading-tight">{e.who}</div>
              <div className="text-[10px] text-muted font-mono">{e.when} ago</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Boxes, title: 'Enforced asset lifecycle', desc: 'Register → assign → repair → write-off. Every transition is validated server-side and can never skip a step.' },
  { icon: ScanLine, title: 'QR tracking', desc: 'A scannable code on every asset resolves to its live record, current holder, and full history.' },
  { icon: ScrollText, title: 'Append-only audit', desc: 'An immutable ledger of who changed what, when, and why — exportable to CSV for any compliance review.' },
  { icon: BarChart3, title: 'Operational analytics', desc: 'Department allocation, asset age, and repair frequency across every location, updated in real time.' },
  { icon: ShieldCheck, title: 'Role-based access', desc: 'Four roles — Admin, Manager, Viewer, Auditor — each scoped to exactly what they should see and do.' },
  { icon: Check, title: 'Single source of truth', desc: 'One record per asset, one active assignment, zero spreadsheets drifting out of sync across offices.' },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12)
    fn()
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const ctaTarget = isAuthenticated ? '/dashboard' : '/register'

  const DEMOS = [
    {
      demo: <AISuggestDemo />,
      kicker: 'AI-assisted',
      title: 'AI files assets for you',
      desc: 'Start typing an asset name and AI suggests the right category with a confidence score — one click to apply. No more inventory scattered across the wrong buckets.',
    },
    {
      demo: <AuditDiffDemo />,
      kicker: 'Compliance',
      title: 'Every change, on the record',
      desc: 'Expand any audit entry to see exactly what changed — old values versus new, who did it and when. The log is append-only and exports to CSV for any review.',
    },
    {
      demo: <AnalyticsDemo />,
      kicker: 'Analytics',
      title: 'Answers, not just numbers',
      desc: 'Allocation by department, asset age, repair frequency and warranty exposure — visualized live across every location.',
    },
  ]

  return (
    <div className="min-h-screen bg-paper text-body font-sans antialiased">
      {/* ── Nav ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-white/85 backdrop-blur-md border-b border-line' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink">
            <Mark className="h-5 w-5 text-brand" />
            <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
          </div>
          <nav className="hidden sm:flex items-center gap-7 text-[13px] text-body">
            <a href="#product" className="hover:text-ink transition-colors">Product</a>
            <a href="#features" className="hover:text-ink transition-colors">Features</a>
            <a href="#security" className="hover:text-ink transition-colors">Security</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link to="/login" className="px-3.5 py-2 text-[13px] font-medium text-body hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link to={ctaTarget} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors">
              {isAuthenticated ? 'Dashboard' : 'Get started'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}
              className="inline-flex items-center gap-2 text-[12px] font-medium text-body mb-6"
            >
              <span className="h-px w-6 bg-gold" />
              <span className="uppercase tracking-[0.14em] text-gold">Asset lifecycle management</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut, delay: 0.05 }}
              className="font-serif text-[42px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] text-ink"
            >
              A single system of record for every asset in every location.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.14 }}
              className="mt-6 text-[16px] leading-relaxed text-body max-w-lg"
            >
              AssetVault tracks your equipment across its whole lifecycle — from purchase to write-off —
              with QR scanning, role-based access, and a tamper-proof audit trail auditors actually trust.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.22 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button
                onClick={() => navigate(ctaTarget)}
                className="inline-flex items-center gap-2 px-5 py-3 text-[14px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors"
              >
                {isAuthenticated ? 'Open dashboard' : 'Get started'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-5 py-3 text-[14px] font-medium text-ink bg-white border border-line rounded-lg hover:border-brand/40 transition-colors"
              >
                Sign in
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.34 }}
              className="mt-8 flex items-center gap-3 text-[13px] text-muted"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                Live
              </span>
              <span className="text-line">·</span>
              <span>Tracking <span className="text-body font-medium">300 assets</span> across <span className="text-body font-medium">5 locations</span></span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: easeOut, delay: 0.15 }}
          >
            <ProductPreview />
          </motion.div>
        </div>
      </section>

      {/* ── Metrics band (real numbers) ── */}
      <section className="border-y border-line bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-line-soft">
          {[
            { value: '300', label: 'Assets under management' },
            { value: '5', label: 'Locations' },
            { value: '30', label: 'Employees mapped' },
            { value: '4', label: 'Access roles' },
          ].map((m, i) => (
            <div key={m.label} className={`px-5 ${i === 0 ? 'pl-0' : ''}`}>
              <div className="text-[30px] font-semibold text-ink font-mono tracking-tight">{m.value}</div>
              <div className="text-[12px] text-muted mt-1 leading-snug">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product / narrative split ── */}
      <section id="product" className="px-6 py-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-gold mb-4">The problem</p>
            <h2 className="font-serif text-[32px] leading-[1.12] tracking-[-0.02em] text-ink mb-5">
              Spreadsheets don’t know who has the laptop.
            </h2>
            <p className="text-[15px] leading-relaxed text-body mb-6">
              Across dozens of locations, assets move constantly — assigned, repaired, retired. On spreadsheets that
              history evaporates and accountability with it. AssetVault replaces the guesswork with one enforced
              workflow and a record that can’t be quietly edited.
            </p>
            <ul className="space-y-3">
              {[
                'Every status change is validated and logged automatically',
                'One active owner per asset — no double-booked equipment',
                'Full provenance from purchase order to write-off',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[14px] text-body">
                  <span className="mt-0.5 shrink-0 w-[18px] h-[18px] rounded-full bg-ok-soft text-ok flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <AuditPreview />
          </Reveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 py-24 border-y border-line bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal className="max-w-2xl mb-14">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-gold mb-4">Platform</p>
            <h2 className="font-serif text-[32px] leading-[1.12] tracking-[-0.02em] text-ink">
              Everything an operations team needs, nothing it doesn’t.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-line-soft">
            {FEATURES.map((f) => (
              <div key={f.title} className="group p-7 border-b border-r border-line-soft hover:bg-paper/70 transition-colors">
                <f.icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it in action (animated product demos) ── */}
      <section id="demos" className="px-6 py-24 border-y border-line bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal className="max-w-2xl mb-16">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-gold mb-4">See it in action</p>
            <h2 className="font-serif text-[32px] leading-[1.12] tracking-[-0.02em] text-ink">
              The product, not a promise.
            </h2>
          </Reveal>
          <div className="space-y-16 lg:space-y-24">
            {DEMOS.map((d, i) => (
              <div key={d.title} className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
                <div className={`flex justify-center ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                  {d.demo}
                </div>
                <Reveal className={i % 2 === 1 ? 'lg:order-1' : ''}>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-gold mb-3">{d.kicker}</p>
                  <h3 className="font-serif text-[26px] leading-[1.15] tracking-[-0.01em] text-ink mb-3">{d.title}</h3>
                  <p className="text-[15px] leading-relaxed text-body">{d.desc}</p>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security / trust (investors care) ── */}
      <section id="security" className="px-6 py-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-14">
          <Reveal>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-gold mb-4">Security & compliance</p>
            <h2 className="font-serif text-[32px] leading-[1.12] tracking-[-0.02em] text-ink mb-5">
              Built to survive an audit.
            </h2>
            <p className="text-[15px] leading-relaxed text-body">
              Sensitive asset data demands more than a login screen. Access is scoped by role, the audit log is
              physically append-only, and nothing is ever hard-deleted — so the trail is always complete.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { role: 'ADMIN', desc: 'Full control — users, locations, and every asset.' },
              { role: 'MANAGER', desc: 'Assign, edit, and review analytics for their scope.' },
              { role: 'VIEWER', desc: 'Read-only visibility into assets and dashboards.' },
              { role: 'AUDITOR', desc: 'Immutable audit log access and CSV export.' },
            ].map((r) => (
              <Reveal key={r.role} className="rounded-xl border border-line bg-white p-5">
                <div className="font-mono text-[11px] font-semibold tracking-wide text-brand">{r.role}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-body">{r.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA — signature: a real, scannable QR to the live demo ── */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto rounded-2xl bg-brand overflow-hidden grid md:grid-cols-[1.35fr_1fr]">
          <div className="px-8 py-14 sm:px-12">
            <h2 className="font-serif text-[32px] sm:text-[38px] leading-[1.08] tracking-[-0.02em] text-white">
              See where every<br />asset stands.
            </h2>
            <p className="mt-4 text-[15px] text-white/70 max-w-sm">
              Open the demo with the admin account below — or scan the code to explore the live product on your phone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate(ctaTarget)}
                className="inline-flex items-center gap-2 px-6 py-3 text-[14px] font-medium text-brand bg-white rounded-lg hover:bg-paper transition-colors"
              >
                {isAuthenticated ? 'Open dashboard' : 'Get started'}
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-6 py-3 text-[14px] font-medium text-white border border-white/25 rounded-lg hover:bg-white/10 transition-colors"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-[12px] text-white/50 font-mono">
              admin@assetvault.uz &nbsp;·&nbsp; Vault@2024
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 p-8 border-t md:border-t-0 md:border-l border-white/10 bg-white/[0.03]">
            <div className="bg-white p-3 rounded-xl shadow-lg">
              <QRCodeSVG value="https://asset.datamou.uz" size={132} bgColor="#ffffff" fgColor="#17233D" level="M" />
            </div>
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white">
                <ScanLine className="h-3.5 w-3.5 text-white/70" />
                Scan to open the live demo
              </div>
              <div className="text-[11px] text-white/45 font-mono mt-1">asset.datamou.uz</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-ink">
            <Mark className="h-4 w-4 text-brand" />
            <span className="text-[13px] font-semibold">AssetVault</span>
          </div>
          <p className="text-[12px] text-muted">Asset management platform</p>
          <div className="flex items-center gap-5 text-[12px] text-body">
            <Link to="/login" className="hover:text-ink transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-ink transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
