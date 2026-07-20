import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

type Tier = {
  name: string
  priceM: string
  priceY: string
  blurb: string
  cta: string
  to: string
  external?: boolean
  popular?: boolean
  custom?: boolean
  free?: boolean
  features: string[]
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    priceM: '0', priceY: '0', free: true,
    blurb: 'For trying it out or a single small office.',
    cta: 'Start free', to: '/register',
    features: ['Up to 50 assets', '2 team members', '1 location', 'QR codes & scanning', 'Basic dashboard'],
  },
  {
    name: 'Starter',
    priceM: '99 000', priceY: '990 000',
    blurb: 'For growing teams that need the full workflow.',
    cta: 'Choose Starter', to: '/register',
    features: ['Up to 500 assets', '10 team members', 'Up to 5 locations', 'Full audit log + CSV export', 'Analytics dashboards', 'Email support'],
  },
  {
    name: 'Business',
    priceM: '299 000', priceY: '2 990 000', popular: true,
    blurb: 'For organizations running assets across many sites.',
    cta: 'Choose Business', to: '/register',
    features: ['Up to 5,000 assets', 'Unlimited team members', 'Unlimited locations', 'AI insights & predictions', 'Warranty alerts', 'Priority support', 'API access'],
  },
  {
    name: 'Enterprise',
    priceM: 'Custom', priceY: 'Custom', custom: true,
    blurb: 'For large deployments with security & SLA needs.',
    cta: 'Contact sales', to: 'https://t.me/jasurbeksharofiddinov', external: true,
    features: ['Unlimited assets', 'SSO & advanced roles', 'On-premise option', 'Dedicated manager + SLA', 'Custom integrations'],
  },
]

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="px-6 py-24">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-10">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-gold mb-4">Pricing</p>
          <h2 className="font-serif text-[32px] leading-[1.12] tracking-[-0.02em] text-ink">
            Simple pricing, built for local teams.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-body">
            Prices in Uzbek so‘m. Start free, upgrade when you grow. No setup fees, cancel anytime.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-line bg-white mb-10">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${!annual ? 'bg-brand text-white' : 'text-body hover:text-ink'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors inline-flex items-center gap-2 ${annual ? 'bg-brand text-white' : 'text-body hover:text-ink'}`}
          >
            Annual
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${annual ? 'bg-white/20 text-white' : 'bg-ok-soft text-ok'}`}>Save 17%</span>
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {TIERS.map((t) => {
            const price = t.custom ? 'Custom' : t.free ? 'Free' : annual ? t.priceY : t.priceM
            const unit = t.custom || t.free ? '' : annual ? '/year' : '/month'
            return (
              <div
                key={t.name}
                className={`relative rounded-2xl bg-white p-6 flex flex-col border ${t.popular ? 'border-brand ring-1 ring-brand/20 shadow-[0_20px_40px_-24px_rgba(23,35,61,0.35)]' : 'border-line'}`}
              >
                {t.popular && (
                  <span className="absolute -top-2.5 left-6 text-[10px] font-semibold uppercase tracking-wider text-white bg-brand px-2 py-0.5 rounded-full">
                    Most popular
                  </span>
                )}
                <h3 className="text-[15px] font-semibold text-ink">{t.name}</h3>

                <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[26px] font-semibold text-ink font-mono tracking-tight">{price}</span>
                  {!t.custom && !t.free && <span className="text-[13px] text-muted">so‘m</span>}
                  {unit && <span className="text-[12px] text-muted">{unit}</span>}
                </div>
                {annual && !t.custom && !t.free && (
                  <p className="mt-1 text-[11px] text-ok">2 months free</p>
                )}

                <p className="mt-3 text-[12.5px] leading-relaxed text-body min-h-[38px]">{t.blurb}</p>

                {t.external ? (
                  <a
                    href={t.to}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-5 inline-flex items-center justify-center px-4 py-2.5 text-[13px] font-medium rounded-lg transition-colors ${t.popular ? 'bg-brand text-white hover:bg-brand-hover' : 'border border-line text-ink hover:border-brand/40'}`}
                  >
                    {t.cta}
                  </a>
                ) : (
                  <Link
                    to={t.to}
                    className={`mt-5 inline-flex items-center justify-center px-4 py-2.5 text-[13px] font-medium rounded-lg transition-colors ${t.popular ? 'bg-brand text-white hover:bg-brand-hover' : 'border border-line text-ink hover:border-brand/40'}`}
                  >
                    {t.cta}
                  </Link>
                )}

                <ul className="mt-6 space-y-2.5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-body">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-ok-soft text-ok flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-[12px] text-muted">
          All plans include QR tracking, the append-only audit trail, and role-based access.
          Prices exclude VAT. Questions? Message{' '}
          <a href="https://t.me/jasurbeksharofiddinov" target="_blank" rel="noreferrer" className="text-brand font-medium hover:text-brand-hover">@jasurbeksharofiddinov</a>{' '}
          on Telegram or call{' '}
          <a href="tel:+998999948959" className="text-brand font-medium hover:text-brand-hover">+998 99 994 89 59</a>.
        </p>
      </div>
    </section>
  )
}
