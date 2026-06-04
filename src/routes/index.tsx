import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import { MENU } from '../lib/menu'
import { useCart } from '../lib/cart'
import { SiteHeader } from '../components/site-header'
import { Wordmark, BeanO } from '../components/bean-mark'
import { MenuAddControl } from '../components/menu-add-control'
import {
  EASE_OUT,
  Marquee,
  Reveal,
  SOFT_SPRING,
  UnderlineLink,
  useParallaxY,
  usePointerFine,
} from '../components/motion-primitives'
import { BeanRain } from '../components/bean-rain'

export const Route = createFileRoute('/')({ component: Home })

// Shared "béchamel" easing (slow, smooth) for the menu hover microinteractions.
const EASE_BECHAMEL = 'ease-[cubic-bezier(0.33,0,0.2,1)]'

const DETAILS = [
  { h: 'Address', lines: ['Kubelíkova 22', '130 00 Praha 3', 'Žižkov'] },
  { h: 'Hours', lines: ['Mon–Fri  7:00–19:00', 'Sat–Sun  8:00–18:00'] },
  { h: 'Contact', lines: ['+420 212 345 678', 'ahoj@zrno.cz', '@zrnocoffee'] },
]

const MARQUEE = [
  'SLOW-ROASTED IN SMALL BATCHES',
  'SINGLE-ESTATE GREEN BEANS',
  'ROASTED WEEKLY IN ŽIŽKOV',
  'BOLD · DARK · UNMISTAKABLY OURS',
  'SPECIALTY COFFEE · PRAGUE',
]

const ROASTERY_IMAGES = ['/roastery.jpg', '/roastery-2.jpg', '/roastery-3.jpg']

function Home() {
  const [subEmail, setSubEmail] = useState('')
  const [subState, setSubState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [subMsg, setSubMsg] = useState('')

  // Roastery photo carousel.
  const [roastIdx, setRoastIdx] = useState(0)
  const roastCount = ROASTERY_IMAGES.length
  const goRoast = (dir: number) =>
    setRoastIdx((i) => (i + dir + roastCount) % roastCount)

  const reduce = useReducedMotion()
  const fine = usePointerFine()
  const cart = useCart()

  // Hero parallax: photo drifts up + slowly scales as the hero scrolls away.
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  // Gentle single-axis drift only — no scroll-driven zoom (translate + scale
  // at once reads heavy). A fixed slight scale just hides the drift's edge gap.
  const heroBgY = useTransform(heroProgress, [0, 1], ['0%', '15%'])
  const heroContentY = useTransform(heroProgress, [0, 1], ['0%', '9%'])
  const heroFade = useTransform(heroProgress, [0, 0.9], [1, 0])

  // Photo-panel parallax (story + visit).
  const roastRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const roastY = useParallaxY(roastRef, 48)
  const barY = useParallaxY(barRef, 56)

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
      <SiteHeader variant="home" />

      {/* HERO */}
      <section
        id="top"
        ref={heroRef}
        className="relative overflow-hidden bg-espresso"
      >
        {/* Parallax photo layer (transform/opacity only) */}
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/hero.jpg)',
            y: reduce ? 0 : heroBgY,
            scale: 1.08,
            willChange: 'transform',
          }}
        />
        {/* Scrim: a light wash up top (so the header reads over the beans),
            CLEAR through the middle (beans full-strength), then a fade that
            resolves to full background at the foot — the headline's contrast
            and a seamless hand-off to the next section, with no flat black
            band. The photo still parallaxes under this layer. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(11,9,8,0.55) 0%, rgba(11,9,8,0.08) 22%, rgba(11,9,8,0) 48%, rgba(11,9,8,0.8) 86%, rgba(11,9,8,1) 100%)',
          }}
        />
        <motion.div
          className="relative z-10 flex min-h-[86vh] flex-col justify-between pt-16"
          style={{ y: reduce ? 0 : heroContentY, opacity: reduce ? 1 : heroFade }}
        >
          <motion.div
            className="flex justify-between px-6 md:px-14 font-mono text-[11px] md:text-xs tracking-[0.2em] text-taupe"
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={reduce ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
          >
            <span>SPECIALTY COFFEE ROASTERS</span>
            <span>PRAGUE · EST. 2014</span>
          </motion.div>
          <div>
            <motion.p
              className="px-6 md:px-14 max-w-xl text-lg md:text-xl leading-relaxed text-cream/90 mb-4"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={reduce ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.35 }}
            >
              Slow-roasted in small batches in the heart of Prague. Bold, dark,
              unmistakably ours.
            </motion.p>
            <h1 className="font-display t-hero px-6 md:px-14 mt-4 md:mt-6 pb-[2vh] select-none">
              {/* ZRN carries the bean-rain on hover; the O is the angled
                  bean mark itself, tipping in and gently wiggling forever. */}
              {/* ZRN rains per-letter under the cursor cloud; the O is its
                  own rain field, tipped to the bean angle (glyph + canvas
                  rotate together so the clip stays aligned) and it rains too. */}
              <span className="inline-flex items-baseline">
                {/* Z, R, N pop in one by one with a springy overshoot; beans
                    scaled down so they don't read chunky at hero size. */}
                <BeanRain
                  lines={['ZRN']}
                  pop
                  popDelay={0.4}
                  popStagger={0.13}
                  beanScale={0.6}
                />
                {reduce ? (
                  <BeanRain
                    lines={['O']}
                    whole
                    rotate={18}
                    beanScale={0.6}
                    className="ml-[0.02em]"
                  />
                ) : (
                  // The O pops in upright (last in the sequence), then — a beat
                  // later — wobbles into its bean lean on a springy rotate with
                  // real overshoot/settle (low damping = a couple of wobbles).
                  // Pop (scale) and wobble (rotate) are separate layers so they
                  // don't fight; bottom-centre pivot keeps the rain upright.
                  <motion.span
                    className="ml-[0.02em] inline-block"
                    initial={{ y: '0.5em', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 22,
                      mass: 0.9,
                      delay: 0.79,
                    }}
                  >
                    <motion.span
                      className="inline-block"
                      style={{ transformOrigin: '50% 100%' }}
                      initial={{ rotate: -18 }}
                      animate={{ rotate: 0 }}
                      transition={{
                        // gentle settle — one soft wobble, then rests at the lean
                        type: 'spring',
                        stiffness: 150,
                        damping: 13,
                        mass: 0.9,
                        delay: 1.2,
                      }}
                    >
                      <BeanRain lines={['O']} whole rotate={18} beanScale={0.6} />
                    </motion.span>
                  </motion.span>
                )}
              </span>
            </h1>
          </div>
        </motion.div>
      </section>

      {/* STATEMENT */}
      <section className="px-6 md:px-14 py-40 md:py-60">
        <Reveal as="div" className="flex items-center gap-3 font-mono text-xs tracking-[0.2em] text-taupe">
          <motion.span
            className="text-amber text-base leading-none"
            animate={reduce ? {} : { opacity: [0.55, 1, 0.55] }}
            transition={
              reduce ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            ●
          </motion.span>{' '}
          OUR PHILOSOPHY
        </Reveal>
        <h2 className="font-display t-xl mt-10">
          <BeanRain lines={['BREWED FOR', { text: 'THE BOLD.', accent: true }]} />
        </h2>
      </section>

      {/* Slow marquee strip between philosophy and menu */}
      <Marquee items={MARQUEE} speed={42} />

      {/* MENU */}
      <section id="menu" className="scroll-mt-24 bg-surface px-6 md:px-14 py-32 md:py-48">
        <Reveal as="div" className="flex items-end justify-between flex-wrap gap-6" stagger>
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-amber">
              WHAT WE POUR
            </div>
            <h2 className="font-display t-lg mt-4">
              <BeanRain lines={['THE MENU']} />
            </h2>
          </div>
          <div className="font-mono text-xs tracking-wide text-taupe">
            PRICES IN Kč · ADD TO YOUR ORDER
          </div>
        </Reveal>

        {/* Rigid grid rows: a fixed min-height + items-center means the row can
            NEVER change height when ADD ⇄ stepper morphs, and the control slot
            is a fixed-width box so the centre never shifts horizontally either.
            Everything else is hover microinteraction. */}
        <div className="mt-16 md:mt-24 border-t hairline">
          {MENU.map((it, i) => {
            const ec = EASE_BECHAMEL
            return (
              <motion.div
                key={it.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={reduce ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, ease: EASE_OUT, delay: Math.min(i * 0.06, 0.3) }}
              >
                <div className="group/row relative grid grid-cols-[1fr_auto] items-center gap-x-4 md:gap-x-10 min-h-[100px] md:min-h-[128px] border-b hairline overflow-hidden">
                  {/* amber wash bleeding in from the right on hover */}
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-amber/[0.06] to-transparent opacity-0 transition-opacity duration-700 ${ec} group-hover/row:opacity-100`}
                  />
                  {/* left accent bar that grows from the centre on hover */}
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute left-0 top-1/2 w-[2px] h-0 -translate-y-1/2 bg-amber transition-[height] duration-500 ${ec} group-hover/row:h-1/2`}
                  />

                  {/* name + description */}
                  <div
                    className={`relative min-w-0 transition-transform duration-[650ms] ${ec} group-hover/row:translate-x-3 md:group-hover/row:translate-x-5`}
                  >
                    <BeanRain
                      lines={[it.name.toUpperCase()]}
                      className="font-display text-3xl md:text-5xl leading-none text-cream"
                    />
                    <span
                      className={`mt-2 block max-w-sm text-sm text-taupe transition-colors duration-[650ms] ${ec} group-hover/row:text-cream/90`}
                    >
                      {it.desc}
                    </span>
                  </div>

                  {/* price + add control */}
                  <div className="relative flex items-center gap-4 md:gap-8">
                    <span
                      className={`font-display text-2xl md:text-4xl leading-none tabular-nums text-amber whitespace-nowrap transition-transform duration-[650ms] ${ec} group-hover/row:-translate-x-1`}
                    >
                      {it.price}
                    </span>
                    <MenuAddControl id={it.id} name={it.name} qty={cart[it.id] || 0} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* STORY / ROASTERY — full-bleed split. Image sits on the RIGHT on
          desktop so it alternates with VISIT (image-left) for a zigzag
          rhythm; on mobile both stack image-first. */}
      <section id="story" className="scroll-mt-24 grid md:grid-cols-2">
        {/* Image — full-bleed, parallax, overlaid index numeral + captions */}
        <div
          id="roastery"
          ref={roastRef}
          className="scroll-mt-24 md:order-2 relative min-h-[420px] md:min-h-[620px] overflow-hidden flex flex-col justify-between p-8"
        >
          {/* Parallax wrapper holding the crossfading carousel images */}
          <motion.div
            aria-hidden
            className="absolute inset-[-12%]"
            style={{ y: reduce ? 0 : roastY, willChange: 'transform' }}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={roastIdx}
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${ROASTERY_IMAGES[roastIdx]})` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
              />
            </AnimatePresence>
          </motion.div>

          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(11,9,8,0.55) 0%, rgba(11,9,8,0.04) 42%, rgba(11,9,8,0.88) 100%)',
            }}
          />

          {/* Top: big slide number (doubles as the carousel index) */}
          <div className="relative z-10 flex items-start justify-between">
            <AnimatePresence mode="wait">
              <motion.span
                key={roastIdx}
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="font-display text-7xl md:text-8xl leading-none text-cream/25 select-none"
              >
                {String(roastIdx + 1).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
            <span className="mt-3 font-mono text-[11px] tracking-[0.2em] text-cream/45 tabular-nums">
              / {String(roastCount).padStart(2, '0')}
            </span>
          </div>

          {/* Bottom: caption + prev/next arrows */}
          <div className="relative z-10 flex items-end justify-between gap-4">
            <span className="font-mono text-[11px] tracking-[0.2em] text-cream/85">
              ROASTERY · ŽIŽKOV
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goRoast(-1)}
                aria-label="Previous photo"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/30 text-cream/80 transition-colors hover:border-amber hover:text-amber"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => goRoast(1)}
                aria-label="Next photo"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/30 text-cream/80 transition-colors hover:border-amber hover:text-amber"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Text — quote, attribution, fact strip, journal link.
            min-w-0 lets the column shrink below its content's intrinsic width
            so the quote wraps instead of overflowing the viewport. */}
        <div className="md:order-1 flex min-w-0 flex-col justify-center gap-10 p-10 md:p-16 lg:p-24">
          <Reveal
            as="div"
            className="font-mono text-xs tracking-[0.2em] text-amber"
          >
            THE ROASTERY
          </Reveal>

          <Reveal
            as="p"
            className="max-w-xl font-body text-2xl md:text-[26px] lg:text-3xl font-medium leading-snug text-cream text-balance"
          >
            We source green beans from single estates, then roast them dark and
            slow in a converted workshop. No shortcuts, no compromise — only the
            deep, caramelised character Prague has come to know us for.
          </Reveal>

          <Reveal
            as="div"
            className="font-mono text-[11px] tracking-[0.2em] text-taupe"
            delay={0.1}
          >
            — TOMÁŠ &amp; LENKA, FOUNDERS
          </Reveal>

          <div className="border-t hairline" />

          <Reveal
            as="div"
            stagger
            staggerAmount={0.1}
            className="grid grid-cols-3 gap-4"
          >
            {[
              ['Roasted', 'Weekly'],
              ['Beans', 'Single-estate'],
              ['Where', 'Žižkov'],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
                  {k}
                </div>
                <div className="mt-2 font-display text-lg md:text-xl leading-none text-cream break-words">
                  {v}
                </div>
              </div>
            ))}
          </Reveal>

          <Reveal as="div" delay={0.1}>
            <Link
              to="/journal"
              className="zrno-underline relative font-mono text-xs tracking-[0.18em] text-cream"
            >
              READ THE JOURNAL →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* VISIT — full-bleed image with the details overlaid at the foot. A
          deliberate break from the roastery's split-screen rhythm: here the
          photograph fills the frame and the type sits on top of it. */}
      <section
        id="visit"
        ref={barRef}
        className="scroll-mt-24 relative flex min-h-[90vh] items-end overflow-hidden"
      >
        {/* Looping boomerang video of the bar (forward+reverse, so it never
            jumps), parallaxed. Muted/inline/autoplay → treated as decoration
            by browsers. Poster + image-less fallback keep it graceful. */}
        <motion.div
          aria-hidden
          className="absolute inset-[-10%]"
          style={{ y: reduce ? 0 : barY, willChange: 'transform' }}
        >
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/bar-poster.jpg"
          >
            <source src="/bar.mp4" type="video/mp4" />
          </video>
        </motion.div>
        {/* Film grain — a resolution-independent SVG noise (renders sharp at
            device pixels), so the upscaled video's softness reads as filmic
            texture even on retina / full-HD rather than as low-res blur. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='120'%3E%3Cfilter%20id='n'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='0.92'%20numOctaves='3'%20stitchTiles='stitch'/%3E%3C/filter%3E%3Crect%20width='100%25'%20height='100%25'%20filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: '120px 120px',
          }}
        />
        {/* legibility gradient — resolves to FULL background colour at the very
            foot so the video dissolves seamlessly into the footer (no hard
            cut). */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(0deg, rgba(11,9,8,1) 0%, rgba(11,9,8,0.92) 10%, rgba(11,9,8,0.5) 44%, rgba(11,9,8,0.12) 100%)',
          }}
        />

        <span className="absolute left-6 top-8 z-10 font-mono text-[11px] tracking-[0.2em] text-cream/55 md:left-14">
          THE BAR · KUBELÍKOVA
        </span>

        <div className="relative z-10 w-full px-6 pb-14 md:px-14 md:pb-24">
          <Reveal as="div" className="font-mono text-xs tracking-[0.2em] text-amber">
            FIND US
          </Reveal>
          <h2 className="font-display t-lg mt-4">
            <BeanRain lines={['VISIT THE BAR']} />
          </h2>
          <Reveal
            as="div"
            className="mt-10 grid max-w-3xl grid-cols-2 gap-8 border-t hairline pt-8 md:mt-14 md:grid-cols-3"
            stagger
            staggerAmount={0.12}
          >
            {DETAILS.map((c) => (
              <div key={c.h}>
                <div className="font-mono text-[11px] tracking-[0.2em] text-muted">
                  {c.h.toUpperCase()}
                </div>
                <div className="mt-3 space-y-1.5">
                  {c.lines.map((ln) => (
                    <div key={ln} className="text-base text-cream/90">
                      {ln}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-14 pt-40 md:pt-56 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
          <h2 className="font-display t-xl">
            <BeanRain lines={['STAY', 'CAFFEINATED.']} />
          </h2>
          <Reveal as="div" className="max-w-md w-full" delay={0.1}>
            <p className="text-taupe leading-relaxed">
              Join the list for new single-origin drops, brewing notes and events
              at the bar.
            </p>
            {/* Reserved-height swap zone: the form and the success card are
                both absolutely placed and crossfade in place, so subscribing
                never shifts the footer's height. */}
            <div className="relative mt-5 min-h-[78px]">
              <AnimatePresence initial={false}>
                {subState === 'done' ? (
                  <motion.div
                    key="sub-done"
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.55, ease: EASE_OUT }}
                    className="absolute inset-x-0 top-0 flex items-center gap-4 bg-elevated p-4 pl-5 border-l-2 border-amber"
                  >
                    <motion.span
                      initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.1 }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-espresso"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <motion.path
                          d="M20 6 9 17l-5-5"
                          initial={reduce ? false : { pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5, delay: 0.26, ease: EASE_OUT }}
                        />
                      </svg>
                    </motion.span>
                    <div>
                      <div className="font-mono text-[11px] tracking-[0.18em] text-amber">
                        YOU’RE ON THE LIST
                      </div>
                      <div className="text-sm text-taupe mt-0.5">
                        Welcome email sent — check your inbox.
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="sub-form"
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                    className="absolute inset-x-0 top-0 flex items-center bg-elevated p-2 pl-5"
                    onSubmit={subscribe}
                  >
                    <input
                      type="email"
                      required
                      value={subEmail}
                      onChange={(e) => setSubEmail(e.target.value)}
                      placeholder="your@email.cz"
                      className="bg-transparent flex-1 outline-none text-sm placeholder:text-muted text-cream"
                    />
                    <motion.button
                      type="submit"
                      disabled={subState === 'busy'}
                      className="zrno-cta bg-amber text-espresso font-mono text-[11px] tracking-[0.15em] px-5 py-3 hover:bg-amberdeep transition-colors duration-300 disabled:opacity-60"
                      whileHover={fine && !reduce ? { scale: 1.02 } : undefined}
                      whileTap={fine && !reduce ? { scale: 0.985 } : undefined}
                      transition={{ type: 'spring', ...SOFT_SPRING }}
                    >
                      {subState === 'busy' ? 'SENDING…' : 'SUBSCRIBE'}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
            {subState === 'error' && subMsg && (
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="mt-3 text-sm text-red-400"
              >
                {subMsg}
              </motion.p>
            )}
          </Reveal>
        </div>

        <div className="border-t hairline mt-16 pt-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[11px] tracking-wide text-muted">
          <Wordmark className="text-xl text-cream" />
          <span>© 2026 ZRNO COFFEE — PRAGUE</span>
          <div className="flex items-center gap-6">
            <Link
              to="/admin"
              className="zrno-underline relative text-muted hover:text-taupe transition-colors"
            >
              ADMIN
            </Link>
            <UnderlineLink href="#top" className="text-taupe">
              BACK TO TOP ↑
            </UnderlineLink>
          </div>
        </div>
      </footer>
    </div>
  )
}
