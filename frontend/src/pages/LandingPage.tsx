import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion'
import {
  Hexagon, ArrowRight, ScanLine, BarChart3, ScrollText,
  Shield, Zap, GitBranch, ChevronRight, Package,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import ProductShowcase from '../components/landing/ProductShowcase'

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18 })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (inView) motionVal.set(to)
  }, [inView, motionVal, to])

  useEffect(() => {
    return spring.on('change', (v) => setDisplay(Math.round(v).toLocaleString()))
  }, [spring])

  return <span ref={ref}>{display}{suffix}</span>
}

// ── Tiny blinking cursor ──────────────────────────────────────────────────────
function Cursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      className="inline-block w-[2px] h-[1em] bg-vault-amber align-middle ml-0.5"
    />
  )
}

// ── Background grid ───────────────────────────────────────────────────────────
function Grid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Amber glow blobs */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-vault-amber/[0.04] blur-[120px]" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-vault-blue/[0.03] blur-[100px]" />
    </div>
  )
}

// ── Terminal preview card ─────────────────────────────────────────────────────
const terminalLines = [
  { prefix: '›', text: 'asset.status', value: '"ASSIGNED"', color: 'text-vault-green' },
  { prefix: '›', text: 'asset.branch', value: '"Tashkent HQ"', color: 'text-vault-blue' },
  { prefix: '›', text: 'asset.value', value: '4_200_000 UZS', color: 'text-vault-amber' },
  { prefix: '›', text: 'audit.lastEvent', value: '"2026-03-24T09:41Z"', color: 'text-vault-muted-text' },
]

function TerminalCard() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, rotateX: 8 }}
      animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 800 }}
      className="w-full max-w-md rounded-xl border border-vault-border bg-vault-surface/80 backdrop-blur shadow-[0_32px_64px_rgba(0,0,0,0.5),0_0_0_1px_rgba(245,166,35,0.06)] overflow-hidden"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-vault-border bg-vault-muted/20">
        <span className="w-2.5 h-2.5 rounded-full bg-vault-red/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-vault-yellow/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-vault-green/60" />
        <span className="ml-2 text-[11px] font-[family-name:var(--font-mono)] text-vault-muted-text">
          assetvault — asset detail
        </span>
      </div>

      {/* Lines */}
      <div className="p-5 space-y-3 font-[family-name:var(--font-mono)] text-[13px]">
        {terminalLines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
            className="flex items-center gap-3"
          >
            <span className="text-vault-amber">{line.prefix}</span>
            <span className="text-vault-muted-text">{line.text}</span>
            <span className="text-vault-disabled ml-auto mr-2">=</span>
            <span className={line.color}>{line.value}</span>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.9 }}
          className="flex items-center gap-2 pt-1"
        >
          <span className="text-vault-amber">›</span>
          <span className="text-vault-text">_</span>
          <Cursor />
        </motion.div>
      </div>

      {/* Status bar */}
      <div className="px-5 py-2 border-t border-vault-border bg-vault-muted/10 flex items-center gap-4">
        <span className="w-1.5 h-1.5 rounded-full bg-vault-green animate-pulse" />
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-vault-muted-text">
          CONNECTED · asset.datamou.uz
        </span>
        <span className="ml-auto text-[10px] font-[family-name:var(--font-mono)] text-vault-amber">
          v2.0.0
        </span>
      </div>
    </motion.div>
  )
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  title,
  desc,
  delay,
  accent,
}: {
  icon: React.ElementType
  title: string
  desc: string
  delay: number
  accent: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="group relative p-6 rounded-2xl border border-vault-border bg-vault-surface hover:border-vault-border-focus transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${accent} blur-[60px] scale-75`} />
      <div className="relative">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${accent.replace('bg-', 'bg-').replace('/[0.04]', '/10')}`}>
          <Icon className="h-5 w-5 text-vault-amber" />
        </div>
        <h3 className="text-[15px] font-semibold text-vault-text mb-2">{title}</h3>
        <p className="text-[13px] text-vault-muted-text leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  )
}

// ── Step ─────────────────────────────────────────────────────────────────────
function Step({ n, title, desc, delay }: { n: number; title: string; desc: string; delay: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5 }}
      className="flex gap-5 items-start"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-vault-amber/10 border border-vault-amber/20 flex items-center justify-center">
        <span className="text-[12px] font-bold text-vault-amber font-[family-name:var(--font-mono)]">
          {String(n).padStart(2, '0')}
        </span>
      </div>
      <div>
        <h4 className="text-[14px] font-semibold text-vault-text mb-1">{title}</h4>
        <p className="text-[13px] text-vault-muted-text leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [navScrolled, setNavScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const ctaTarget = isAuthenticated ? '/dashboard' : '/register'

  return (
    <div className="min-h-screen bg-vault-black text-vault-text">

      {/* ── Nav ── */}
      <motion.nav
        initial={false}
        animate={navScrolled ? 'scrolled' : 'top'}
        variants={{
          top: { backgroundColor: 'transparent', borderColor: 'transparent' },
          scrolled: { backgroundColor: 'rgba(14,14,19,0.85)', borderColor: 'rgba(36,36,52,0.6)' },
        }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 inset-x-0 z-50 border-b backdrop-blur-xl"
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hexagon className="h-5 w-5 text-vault-amber" strokeWidth={2.5} />
            <span className="text-[15px] font-bold tracking-tight">
              Asset<span className="text-vault-amber">Vault</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-1.5 text-[13px] text-vault-muted-text hover:text-vault-text transition-colors"
            >
              Sign in
            </Link>
            <Link
              to={ctaTarget}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold bg-vault-amber text-vault-black rounded-lg hover:bg-amber-400 transition-colors"
            >
              {isAuthenticated ? 'Dashboard' : 'Get started'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <Grid />

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Left copy */}
            <div className="flex-1 max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-vault-amber/20 bg-vault-amber/5 mb-6"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-vault-amber animate-pulse" />
                <span className="text-[11px] font-semibold text-vault-amber uppercase tracking-wider">
                  Bank-grade asset control
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl lg:text-5xl font-bold text-vault-text leading-[1.15] tracking-tight mb-5"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Every asset.
                <br />
                <span className="text-vault-amber">Every branch.</span>
                <br />
                Zero guesswork.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-[15px] text-vault-muted-text leading-relaxed mb-8"
              >
                AssetVault tracks the full lifecycle of bank office equipment —
                from purchase to write-off — with QR scanning, role-based access,
                and a tamper-proof audit trail.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-wrap items-center gap-3"
              >
                <button
                  onClick={() => navigate(ctaTarget)}
                  className="flex items-center gap-2 px-6 py-3 text-[14px] font-semibold bg-vault-amber text-vault-black rounded-xl hover:bg-amber-400 transition-all shadow-[0_0_24px_rgba(245,166,35,0.25)] hover:shadow-[0_0_32px_rgba(245,166,35,0.4)]"
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Start free'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-6 py-3 text-[14px] text-vault-muted-text hover:text-vault-text border border-vault-border hover:border-vault-border-focus rounded-xl transition-all"
                >
                  Sign in <ChevronRight className="h-4 w-4" />
                </Link>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-5 text-[12px] text-vault-disabled"
              >
                Default admin: <span className="font-[family-name:var(--font-mono)] text-vault-muted-text">admin@assetvault.uz</span>
                &nbsp;/&nbsp;
                <span className="font-[family-name:var(--font-mono)] text-vault-muted-text">Vault@2024</span>
              </motion.p>
            </div>

            {/* Right: terminal */}
            <div className="flex-1 w-full flex justify-center lg:justify-end">
              <TerminalCard />
            </div>
          </div>
        </div>
      </section>

      <ProductShowcase />

      {/* ── Stats ── */}
      <section className="py-14 border-y border-vault-border/50 bg-vault-surface/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Assets tracked', value: 300, suffix: '+' },
              { label: 'Branch offices', value: 5, suffix: '' },
              { label: 'Audit events', value: 1200, suffix: '+' },
              { label: 'Uptime', value: 99, suffix: '%' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <div className="text-3xl font-bold text-vault-text mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                  <Counter to={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[12px] text-vault-muted-text uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14"
          >
            <p className="text-[11px] font-semibold text-vault-amber uppercase tracking-[3px] mb-3">Platform</p>
            <h2 className="text-3xl font-bold text-vault-text leading-tight" style={{ fontFamily: "'DM Mono', monospace" }}>
              Built for how banks<br />actually operate.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Package,
                title: 'Asset Lifecycle',
                desc: 'Register → Assign → Repair → Write-off. Every state transition is enforced and logged. No manual spreadsheets.',
                accent: 'bg-vault-amber/[0.04]',
              },
              {
                icon: ScanLine,
                title: 'QR Code Tracking',
                desc: 'Generate QR codes for every asset. Scan to pull up full details, assignment status, and history — instantly.',
                accent: 'bg-vault-blue/[0.04]',
              },
              {
                icon: ScrollText,
                title: 'Tamper-proof Audit',
                desc: 'Append-only audit log captures every change: who did it, when, and why. Export to CSV for compliance.',
                accent: 'bg-vault-green/[0.04]',
              },
              {
                icon: BarChart3,
                title: 'Analytics Dashboard',
                desc: 'Department allocation, age distribution, repair frequency — visualised in real-time across all branches.',
                accent: 'bg-vault-orange/[0.04]',
              },
              {
                icon: GitBranch,
                title: 'Multi-branch Support',
                desc: 'Filter and manage assets across all branch offices from one place. No per-branch logins needed.',
                accent: 'bg-vault-blue/[0.04]',
              },
              {
                icon: Shield,
                title: 'Role-based Access',
                desc: 'ADMIN · MANAGER · VIEWER · AUDITOR. Each role sees exactly what it needs. JWT auth with refresh tokens.',
                accent: 'bg-vault-amber/[0.04]',
              },
            ].map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6 bg-vault-surface/30 border-y border-vault-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-[11px] font-semibold text-vault-amber uppercase tracking-[3px] mb-3">Workflow</p>
              <h2 className="text-3xl font-bold text-vault-text mb-4 leading-tight" style={{ fontFamily: "'DM Mono', monospace" }}>
                Up and running<br />in minutes.
              </h2>
              <p className="text-[14px] text-vault-muted-text leading-relaxed">
                No complex setup. Seed your branches and departments once,
                then start adding assets immediately.
              </p>
            </motion.div>

            <div className="space-y-6">
              {[
                {
                  title: 'Add your assets',
                  desc: 'Fill in name, serial number, category, branch. The system generates a QR code automatically.',
                },
                {
                  title: 'Assign to employees',
                  desc: 'Select employee and department. The asset status flips to ASSIGNED and the audit log records the event.',
                },
                {
                  title: 'Track everything',
                  desc: 'Monitor status changes, repairs, returns. Analytics update in real-time. Export audit logs any time.',
                },
              ].map((step, i) => (
                <Step key={step.title} n={i + 1} {...step} delay={i * 0.1} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Role chips ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-[11px] font-semibold text-vault-amber uppercase tracking-[3px] mb-3">Access control</p>
            <h2 className="text-3xl font-bold text-vault-text mb-4" style={{ fontFamily: "'DM Mono', monospace" }}>
              Right role, right access.
            </h2>
            <p className="text-[14px] text-vault-muted-text mb-10 max-w-lg mx-auto">
              Four distinct roles covering every use case from day-to-day operations to compliance audits.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { role: 'ADMIN', desc: 'Full access. Manage users, branches, assets.', color: 'text-vault-amber border-vault-amber/20 bg-vault-amber/5' },
              { role: 'MANAGER', desc: 'Assign assets, edit records, view analytics.', color: 'text-vault-blue border-vault-blue/20 bg-vault-blue/5' },
              { role: 'VIEWER', desc: 'Read-only access to assets and dashboard.', color: 'text-vault-green border-vault-green/20 bg-vault-green/5' },
              { role: 'AUDITOR', desc: 'Access audit logs and export CSV reports.', color: 'text-vault-orange border-vault-orange/20 bg-vault-orange/5' },
            ].map((r, i) => (
              <motion.div
                key={r.role}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`p-4 rounded-xl border ${r.color} text-left`}
              >
                <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold mb-2">{r.role}</div>
                <p className="text-[12px] text-vault-muted-text leading-relaxed">{r.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 mb-6">
              <Hexagon className="h-6 w-6 text-vault-amber" strokeWidth={2.5} />
              <span className="text-[15px] font-bold">Asset<span className="text-vault-amber">Vault</span></span>
            </div>
            <h2 className="text-4xl font-bold text-vault-text mb-4 leading-tight" style={{ fontFamily: "'DM Mono', monospace" }}>
              Start managing assets<br />the right way.
            </h2>
            <p className="text-[14px] text-vault-muted-text mb-10">
              No spreadsheets. No blind spots. Full traceability from day one.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate(ctaTarget)}
                className="flex items-center gap-2 px-8 py-3.5 text-[14px] font-semibold bg-vault-amber text-vault-black rounded-xl hover:bg-amber-400 transition-all shadow-[0_0_32px_rgba(245,166,35,0.3)] hover:shadow-[0_0_40px_rgba(245,166,35,0.45)]"
              >
                <Zap className="h-4 w-4" />
                {isAuthenticated ? 'Open Dashboard' : 'Create account'}
              </button>
              <Link
                to="/login"
                className="px-8 py-3.5 text-[14px] text-vault-muted-text hover:text-vault-text border border-vault-border hover:border-vault-border-focus rounded-xl transition-all"
              >
                Sign in instead
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-vault-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-vault-amber" strokeWidth={2.5} />
            <span className="text-[13px] font-bold">Asset<span className="text-vault-amber">Vault</span></span>
          </div>
          <p className="text-[12px] text-vault-disabled">
            Bank Office Asset Management Platform
          </p>
          <div className="flex items-center gap-4 text-[12px] text-vault-muted-text">
            <Link to="/login" className="hover:text-vault-text transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-vault-text transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
