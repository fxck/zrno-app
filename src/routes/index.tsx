import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { MENU } from '../lib/menu'

export const Route = createFileRoute('/')({ component: Home })

const NAV: Array<[string, string]> = [
  ['Menu', '#menu'],
  ['Story', '#story'],
  ['Roastery', '#story'],
  ['Visit', '#visit'],
]

const DETAILS = [
  { h: 'Address', lines: ['Kubelíkova 22', '130 00 Praha 3', 'Žižkov'] },
  { h: 'Hours', lines: ['Mon–Fri  7:00–19:00', 'Sat–Sun  8:00–18:00'] },
  { h: 'Contact', lines: ['+420 212 345 678', 'ahoj@zrno.cz', '@zrnocoffee'] },
]

function Home() {
  const [subEmail, setSubEmail] = useState('')
  const [subState, setSubState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [subMsg, setSubMsg] = useState('')

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    setSubState('busy')
    setSubMsg('')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: subEmail }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Subscription failed.')
      setSubState('done')
      setSubMsg('You’re on the list — check your inbox.')
      setSubEmail('')
    } catch (err: any) {
      setSubState('error')
      setSubMsg(err.message || 'Something went wrong.')
    }
  }

  return (
    <div className="font-body bg-espresso text-cream">
      {/* NAV */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-14 py-5 bg-espresso/80 backdrop-blur-md border-b hairline">
        <a href="#top" className="font-display text-2xl tracking-wider">
          ZRNO
        </a>
        <nav className="hidden md:flex gap-9 font-mono text-[11px] tracking-[0.18em] text-taupe">
          {NAV.map(([label, href], i) => (
            <a key={i} href={href} className="hover:text-cream transition-colors">
              {label.toUpperCase()}
            </a>
          ))}
        </nav>
        <Link
          to="/order"
          className="bg-amber text-espresso font-mono text-[11px] tracking-[0.18em] px-5 py-3 hover:bg-amberdeep transition-colors"
        >
          ORDER ONLINE
        </Link>
      </header>

      {/* HERO */}
      <section
        id="top"
        className="relative overflow-hidden bg-espresso bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(11,9,8,0.80) 0%, rgba(11,9,8,0.42) 45%, rgba(11,9,8,0.96) 100%), url(/hero.jpg)',
        }}
      >
        <div className="relative z-10 flex min-h-[86vh] flex-col justify-between pt-16">
          <div className="flex justify-between px-6 md:px-14 font-mono text-[11px] md:text-xs tracking-[0.2em] text-taupe">
            <span>SPECIALTY COFFEE ROASTERS</span>
            <span>PRAGUE · EST. 2014</span>
          </div>
          <div>
            <p className="px-6 md:px-14 max-w-xl text-lg md:text-xl leading-relaxed text-cream/90 mb-4">
              Slow-roasted in small batches in the heart of Prague. Bold, dark,
              unmistakably ours.
            </p>
            <h1 className="font-display t-hero px-4 md:px-10 -mb-[1.5vw] select-none">
              ZRNO
            </h1>
          </div>
        </div>
      </section>

      {/* STATEMENT */}
      <section className="px-6 md:px-14 py-28 md:py-44">
        <div className="flex items-center gap-3 font-mono text-xs tracking-[0.2em] text-taupe">
          <span className="text-amber text-base leading-none">●</span> OUR PHILOSOPHY
        </div>
        <h2 className="font-display t-xl mt-10">
          BREWED FOR
          <br />
          <span className="text-amber">THE BOLD.</span>
        </h2>
      </section>

      {/* MENU */}
      <section id="menu" className="bg-surface px-6 md:px-14 py-24 md:py-32">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-amber">
              WHAT WE POUR
            </div>
            <h2 className="font-display t-lg mt-4">THE MENU</h2>
          </div>
          <div className="font-mono text-xs tracking-wide text-taupe">
            PRICES IN Kč
          </div>
        </div>

        <div className="mt-12 md:mt-16">
          {MENU.map((it) => (
            <div key={it.id} className="border-t hairline">
              <div className="flex items-end justify-between gap-6 py-6 md:py-7">
                <div className="flex items-end gap-5 flex-wrap">
                  <span className="font-display text-3xl md:text-5xl leading-none">
                    {it.name.toUpperCase()}
                  </span>
                  <span className="text-sm text-taupe mb-1 max-w-xs">
                    {it.desc}
                  </span>
                </div>
                <span className="font-display text-2xl md:text-4xl text-amber leading-none">
                  {it.price}
                </span>
              </div>
            </div>
          ))}
          <div className="border-t hairline" />
        </div>
      </section>

      {/* STORY */}
      <section id="story" className="px-6 md:px-14 py-28 md:py-40">
        <div className="grid md:grid-cols-[1fr_2fr_1fr] gap-10 md:gap-12 items-start">
          <div className="font-mono text-xs leading-relaxed">
            <div className="text-amber tracking-[0.15em]">(01) — THE ROASTERY</div>
            <div className="text-muted mt-3">Roasted weekly in Žižkov, Prague 3.</div>
          </div>
          <div className="flex flex-col items-center gap-8">
            <p className="font-body text-2xl md:text-3xl font-medium leading-snug text-center text-cream">
              We source green beans from single estates, then roast them dark and
              slow in a converted workshop. No shortcuts, no compromise — only the
              deep, caramelised character Prague has come to know us for.
            </p>
            <div className="font-mono text-[11px] tracking-[0.2em] text-taupe">
              — TOMÁŠ &amp; LENKA, FOUNDERS
            </div>
          </div>
          <div className="font-mono text-xs tracking-[0.15em] text-cream md:text-right">
            READ THE JOURNAL →
          </div>
        </div>

        <div className="mt-16 md:mt-24 md:pl-[18%]">
          <div
            className="relative h-64 md:h-80 max-w-2xl flex items-end p-6 bg-cover bg-center"
            style={{
              backgroundImage:
                'linear-gradient(0deg, rgba(11,9,8,0.72) 0%, rgba(11,9,8,0.08) 55%), url(/roastery.jpg)',
            }}
          >
            <span className="relative z-10 font-mono text-[11px] tracking-[0.2em] text-cream/70">
              ROASTERY · ŽIŽKOV
            </span>
          </div>
        </div>
      </section>

      {/* VISIT */}
      <section id="visit" className="bg-surface grid md:grid-cols-2">
        <div
          className="relative min-h-[320px] md:min-h-[560px] flex items-end p-8 bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(0deg, rgba(11,9,8,0.78) 0%, rgba(11,9,8,0.12) 60%), url(/bar.jpg)',
          }}
        >
          <span className="relative z-10 font-mono text-[11px] tracking-[0.2em] text-cream/70">
            THE BAR · KUBELÍKOVA
          </span>
        </div>
        <div className="flex flex-col justify-between gap-12 p-8 md:p-16">
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-amber">FIND US</div>
            <h2 className="font-display t-md mt-4">VISIT THE BAR</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {DETAILS.map((c) => (
              <div key={c.h}>
                <div className="font-mono text-[11px] tracking-[0.2em] text-muted">
                  {c.h.toUpperCase()}
                </div>
                <div className="mt-3 space-y-1.5">
                  {c.lines.map((ln) => (
                    <div key={ln} className="text-base">
                      {ln}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-14 pt-28 md:pt-40 pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
          <h2 className="font-display t-xl">
            STAY
            <br />
            CAFFEINATED.
          </h2>
          <div className="max-w-md w-full">
            <p className="text-taupe leading-relaxed">
              Join the list for new single-origin drops, brewing notes and events
              at the bar.
            </p>
            <form className="mt-5 flex items-center bg-elevated p-2 pl-5" onSubmit={subscribe}>
              <input
                type="email"
                required
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                placeholder="your@email.cz"
                className="bg-transparent flex-1 outline-none text-sm placeholder:text-muted text-cream"
              />
              <button
                type="submit"
                disabled={subState === 'busy'}
                className="bg-amber text-espresso font-mono text-[11px] tracking-[0.15em] px-5 py-3 hover:bg-amberdeep transition-colors disabled:opacity-60"
              >
                {subState === 'busy' ? 'SENDING…' : 'SUBSCRIBE'}
              </button>
            </form>
            {subMsg && (
              <p className={`mt-3 text-sm ${subState === 'error' ? 'text-red-400' : 'text-amber'}`}>
                {subMsg}
              </p>
            )}
          </div>
        </div>

        <div className="border-t hairline mt-16 pt-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[11px] tracking-wide text-muted">
          <span className="font-display text-xl tracking-wider text-cream">ZRNO</span>
          <span>© 2026 ZRNO COFFEE — PRAGUE</span>
          <a href="#top" className="text-taupe hover:text-cream transition-colors">
            BACK TO TOP ↑
          </a>
        </div>
      </footer>
    </div>
  )
}
