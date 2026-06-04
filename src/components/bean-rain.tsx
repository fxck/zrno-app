import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT, usePointerFine } from './motion-primitives'

/* ------------------------------------------------------------------ *
 * BeanRain — a particle EMITTER, not a highlight.
 *
 * While hovering a headline, bean particles (the actual font "O") are
 * spawned just above the glyphs at the cursor's x (a narrow showerhead
 * that follows the mouse) and fall straight down under gravity. They
 * keep their own x, so moving the mouse leaves trailing streams of
 * falling beans. Everything is clipped to the glyph shapes, so beans
 * only show inside the letters they fall through.
 *
 * On mouse-leave the emitter just stops; the beans already in flight
 * finish falling out the bottom (no fade). `whole` emits across the
 * entire glyph width instead of at the cursor (used for the single
 * tilted hero O — its canvas + mask rotate together so the clip holds).
 *
 * Perf: rAF only runs while emitting or while drops are still on screen;
 * font size is cached; the only per-frame composite is one mask drawImage.
 * Disabled for reduced-motion / coarse pointers.
 * ------------------------------------------------------------------ */

type Line = string | { text: string; accent?: boolean }

const AMBER = '#e0913d'
const AMBERDEEP = '#c2722a'

type Bean = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  len: number
  deep: boolean
  active: boolean
}

export function BeanRain({
  lines,
  className,
  whole = false,
  rotate = 0,
  pop = false,
  popDelay = 0,
  popStagger = 0.14,
  beanScale = 1,
}: {
  lines: Line[]
  className?: string
  /** emit across the whole glyph instead of at the cursor x (single glyphs
      like the tilted hero O) */
  whole?: boolean
  /** tilt the glyph + its clip mask by this many degrees while keeping the
      particle gravity vertical, so beans fall straight DOWN inside a tilted
      letter (the hero O) instead of along its lean */
  rotate?: number
  /** orchestrated intro: pop each glyph in, one by one, with a springy
      overshoot (used for the hero wordmark). Replaces the whileInView fade
      for these lines. */
  pop?: boolean
  /** seconds before the FIRST glyph of this BeanRain pops in */
  popDelay?: number
  /** seconds between consecutive glyph pops */
  popStagger?: number
  /** multiply the bean particle size — turn it DOWN for very large headlines
      (the hero) where default-scaled beans read as too chunky */
  beanScale?: number
}) {
  const reduce = useReducedMotion()
  const fine = usePointerFine()
  const enabled = fine && !reduce

  const hostRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const linesKey = lines
    .map((l) => (typeof l === 'string' ? l : l.text))
    .join('|')

  useEffect(() => {
    if (!enabled) return
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const POOL = 180
    let width = 0
    let height = 0
    let pad = 0 // canvas overscan so a rotated glyph's corners aren't clipped
    let fs = 48 // cached font size — refreshed on resize/enter, never per-frame
    const beans: Bean[] = Array.from({ length: POOL }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, len: 10, deep: false, active: false,
    }))
    let mask: HTMLCanvasElement | null = null
    // pointer.vx = smoothed horizontal cursor speed (px/s) so spawned beans
    // inherit the "throw" of the mouse; it decays each frame so a still cursor
    // drops beans straight down.
    const pointer = { x: -9999, vx: 0 }
    let lastMoveX = 0
    let lastMoveT = 0
    let hovering = false
    let emitAcc = 0
    let emitCount = 0
    let intensity = 1 // wanders over time → the rain ebbs and surges
    let raf = 0
    let lastT = 0

    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const beanLen = () =>
      Math.max(11, Math.min(42, fs * 0.11)) * beanScale * rand(0.8, 1.2)
    // Gentle gravity + low terminal velocity → a calm, steady fall.
    const gravity = () => Math.min(640, Math.max(240, fs * 0.8))
    const TERMINAL = 220
    // Showerhead half-width around the cursor. Thin, but enough to wet a letter.
    const spreadHalf = () => Math.max(10, fs * 0.26)
    const emitRate = () => (whole ? Math.max(12, width / 18) : 15) // beans / sec

    function spawn(b: Bean, atY?: number) {
      b.active = true
      b.len = beanLen()
      b.x = whole
        ? Math.random() * width
        : pointer.x + rand(-spreadHalf(), spreadHalf())
      b.y = atY ?? -b.len - Math.random() * fs * 0.25
      // Inherit the cursor's throw: a fast swipe launches beans sideways and
      // gravity arcs them down. Clamped so a frantic flick can't fire them off
      // the canvas, plus a little jitter so a stream isn't a rigid ribbon.
      b.vx = Math.max(-460, Math.min(460, pointer.vx * 0.22)) + rand(-6, 6)
      b.vy = rand(8, 36)
      b.rot = Math.random() * Math.PI * 2
      b.vrot = rand(-0.4, 0.4)
      b.deep = emitCount++ % 3 === 0
    }

    function firstDead(): Bean | undefined {
      for (let i = 0; i < beans.length; i++) if (!beans[i].active) return beans[i]
      return undefined
    }

    // Each bean is the actual font "O", rotated. Anton cap height ≈ 0.72·size.
    function drawBean(b: Bean) {
      ctx!.save()
      ctx!.translate(b.x, b.y)
      ctx!.rotate(b.rot)
      ctx!.fillStyle = b.deep ? AMBERDEEP : AMBER
      ctx!.font = `${(b.len * 1.4).toFixed(1)}px "Anton", "Arial Narrow", sans-serif`
      ctx!.textAlign = 'center'
      ctx!.textBaseline = 'middle'
      ctx!.fillText('O', 0, 0)
      ctx!.restore()
    }

    function buildMask() {
      if (width <= 0 || height <= 0) return
      const m = document.createElement('canvas')
      m.width = Math.round((width + pad * 2) * dpr)
      m.height = Math.round((height + pad * 2) * dpr)
      const mc = m.getContext('2d')
      if (!mc) return
      mc.scale(dpr, dpr)
      mc.translate(pad, pad) // host-space (0,0) → padded canvas origin
      mc.fillStyle = '#fff'
      mc.textBaseline = 'alphabetic'
      host.querySelectorAll('[data-bean-line]').forEach((node) => {
        const el = node as HTMLElement
        const cs = getComputedStyle(el)
        mc.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        try {
          ;(mc as any).letterSpacing = cs.letterSpacing
        } catch {
          /* older browsers: ignore */
        }
        const text = el.textContent || ''
        const size = parseFloat(cs.fontSize) || 48
        const mt = mc.measureText(text)
        const ascent = mt.fontBoundingBoxAscent ?? size * 0.8
        const descent = mt.fontBoundingBoxDescent ?? size * 0.2
        // offset* = pre-transform LAYOUT box, so the canvas/mask/glyph stay
        // aligned even when the whole field is rotated by a parent (hero O).
        const baseline = (el.offsetHeight - (ascent + descent)) / 2 + ascent
        mc.save()
        if (rotate) {
          // tilt the glyph in the mask around its bottom-centre — matching the
          // CSS transform on the visible text — while the bean canvas stays
          // upright, so the rain still falls straight down inside the tilt.
          const ox = el.offsetLeft + el.offsetWidth / 2
          const oy = el.offsetTop + el.offsetHeight
          mc.translate(ox, oy)
          mc.rotate((rotate * Math.PI) / 180)
          mc.translate(-ox, -oy)
        }
        mc.fillText(text, el.offsetLeft, el.offsetTop + baseline)
        mc.restore()
      })
      mask = m
    }

    function resize() {
      width = host.clientWidth
      height = host.clientHeight
      fs = parseFloat(getComputedStyle(host).fontSize) || 48
      // A rotated glyph overflows its layout box; overscan the canvas so beans
      // in the tilted corners aren't sheared off mid-fall.
      pad = rotate ? Math.ceil(fs * 0.7) : 0
      const cw = width + pad * 2
      const ch = height + pad * 2
      canvas.width = Math.max(1, Math.round(cw * dpr))
      canvas.height = Math.max(1, Math.round(ch * dpr))
      canvas.style.left = -pad + 'px'
      canvas.style.top = -pad + 'px'
      canvas.style.width = cw + 'px'
      canvas.style.height = ch + 'px'
      buildMask()
    }

    function frame(t: number) {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0)
      lastT = t

      // Bleed the inherited cursor speed toward 0 (~half-life 120ms) so beans
      // only fly sideways while the mouse is actually moving; once it rests,
      // fresh beans drop straight down.
      pointer.vx *= Math.exp(-dt * 6)

      // Emit from the cursor x (or across the glyph) while hovering. The
      // intensity random-walks so the stream isn't metronomic — it ebbs to a
      // trickle and surges to heavier bursts, like real rain.
      if (hovering) {
        intensity += (Math.random() - 0.5) * dt * 2.4
        intensity = Math.max(0.15, Math.min(1.7, intensity))
        emitAcc += emitRate() * intensity * dt
        while (emitAcc >= 1) {
          emitAcc -= 1
          const b = firstDead()
          if (!b) break
          spawn(b)
        }
      }

      // Physics — straight down, just gravity.
      const g = gravity()
      let onScreen = false
      for (let i = 0; i < beans.length; i++) {
        const b = beans[i]
        if (!b.active) continue
        b.vy = Math.min(TERMINAL, b.vy + g * dt)
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.rot += b.vrot * dt
        if (b.y - b.len > height) b.active = false
        else onScreen = true
      }

      ctx!.setTransform(1, 0, 0, 1, 0, 0)
      ctx!.clearRect(0, 0, canvas.width, canvas.height)
      if (mask && onScreen) {
        ctx!.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr)
        for (let i = 0; i < beans.length; i++) {
          if (beans[i].active) drawBean(beans[i])
        }
        ctx!.setTransform(1, 0, 0, 1, 0, 0)
        ctx!.globalCompositeOperation = 'destination-in'
        ctx!.drawImage(mask, 0, 0)
        ctx!.globalCompositeOperation = 'source-over'
      }

      if (hovering || onScreen) {
        raf = requestAnimationFrame(frame)
      } else {
        raf = 0
      }
    }

    function ensureRunning() {
      if (!raf) {
        lastT = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    function onMove(e: MouseEvent) {
      const x = e.clientX - host.getBoundingClientRect().left
      const now = performance.now()
      const mdt = (now - lastMoveT) / 1000
      // Real per-event speed (ignoring stale gaps / the first move after enter),
      // low-passed so one jittery sample doesn't spike the whole stream.
      if (mdt > 0 && mdt < 0.1) {
        pointer.vx = pointer.vx * 0.55 + ((x - lastMoveX) / mdt) * 0.45
      }
      pointer.x = x
      lastMoveX = x
      lastMoveT = now
    }
    function onEnter(e: MouseEvent) {
      hovering = true
      fs = parseFloat(getComputedStyle(host).fontSize) || 48
      // Seed move-tracking at the entry point so the first sample doesn't read
      // as a huge jump from a stale position.
      lastMoveX = e.clientX - host.getBoundingClientRect().left
      lastMoveT = performance.now()
      pointer.vx = 0
      onMove(e)
      buildMask()
      ensureRunning()
    }
    function onLeave() {
      hovering = false
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(host)
    resize()
    host.addEventListener('mousemove', onMove)
    host.addEventListener('mouseenter', onEnter)
    host.addEventListener('mouseleave', onLeave)

    return () => {
      ro.disconnect()
      host.removeEventListener('mousemove', onMove)
      host.removeEventListener('mouseenter', onEnter)
      host.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled, linesKey, whole, rotate, beanScale])

  const usePop = pop && !reduce
  let charBase = 0 // running glyph index across lines, for staggered pops

  return (
    <span ref={hostRef} className={'relative inline-block ' + (className ?? '')}>
      {lines.map((l, i) => {
        const text = typeof l === 'string' ? l : l.text
        const accent = typeof l === 'object' && l.accent
        const start = charBase
        charBase += text.length

        // Rise each glyph into place, staggered — a critically-damped spring
        // (ζ≈1: confident entrance that *settles* with no overshoot/bounce, so
        // it reads editorial rather than cartoonish). Otherwise plain text.
        const inner = usePop
          ? text.split('').map((ch, j) => (
              <motion.span
                key={j}
                className="inline-block"
                initial={{ y: '0.42em', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 240,
                  damping: 32,
                  mass: 1,
                  delay: popDelay + (start + j) * popStagger,
                }}
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            ))
          : text

        const content = rotate ? (
          <span
            className="inline-block"
            style={{
              transform: `rotate(${rotate}deg)`,
              transformOrigin: '50% 100%',
            }}
          >
            {inner}
          </span>
        ) : (
          inner
        )

        return (
          <motion.span
            key={i}
            data-bean-line
            className={'block ' + (accent ? 'text-amber' : '')}
            initial={usePop || reduce ? false : { opacity: 0, y: '0.18em' }}
            whileInView={usePop || reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={usePop || reduce ? undefined : { once: true, amount: 0.4 }}
            transition={
              usePop || reduce
                ? undefined
                : { duration: 0.9, ease: EASE_OUT, delay: i * 0.12 }
            }
          >
            {content}
          </motion.span>
        )
      })}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0"
      />
    </span>
  )
}
