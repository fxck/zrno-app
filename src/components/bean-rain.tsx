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
}: {
  lines: Line[]
  className?: string
  /** emit across the whole glyph instead of at the cursor x (single glyphs
      like the tilted hero O) */
  whole?: boolean
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
    let fs = 48 // cached font size — refreshed on resize/enter, never per-frame
    const beans: Bean[] = Array.from({ length: POOL }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, len: 10, deep: false, active: false,
    }))
    let mask: HTMLCanvasElement | null = null
    const pointer = { x: -9999 }
    let hovering = false
    let emitAcc = 0
    let emitCount = 0
    let raf = 0
    let lastT = 0

    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const beanLen = () => Math.max(11, Math.min(42, fs * 0.11)) * rand(0.8, 1.2)
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
      b.vx = rand(-2, 2)
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
      m.width = Math.round(width * dpr)
      m.height = Math.round(height * dpr)
      const mc = m.getContext('2d')
      if (!mc) return
      mc.scale(dpr, dpr)
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
        mc.fillText(text, el.offsetLeft, el.offsetTop + baseline)
      })
      mask = m
    }

    function resize() {
      width = host.clientWidth
      height = host.clientHeight
      fs = parseFloat(getComputedStyle(host).fontSize) || 48
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      buildMask()
    }

    function frame(t: number) {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0)
      lastT = t

      // Emit from the cursor x (or across the glyph) while hovering.
      if (hovering) {
        emitAcc += emitRate() * dt
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
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
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
      pointer.x = e.clientX - host.getBoundingClientRect().left
    }
    function onEnter(e: MouseEvent) {
      hovering = true
      fs = parseFloat(getComputedStyle(host).fontSize) || 48
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
  }, [enabled, linesKey, whole])

  return (
    <span ref={hostRef} className={'relative inline-block ' + (className ?? '')}>
      {lines.map((l, i) => {
        const text = typeof l === 'string' ? l : l.text
        const accent = typeof l === 'object' && l.accent
        return (
          <motion.span
            key={i}
            data-bean-line
            className={'block ' + (accent ? 'text-amber' : '')}
            initial={reduce ? false : { opacity: 0, y: '0.18em' }}
            whileInView={reduce ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: 0.9,
              ease: EASE_OUT,
              delay: reduce ? 0 : i * 0.12,
            }}
          >
            {text}
          </motion.span>
        )
      })}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </span>
  )
}
