import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT, usePointerFine } from './motion-primitives'

/* ------------------------------------------------------------------ *
 * BeanRain — coffee beans literally rain down INSIDE a headline.
 *
 * The visible headline is real DOM text (accessible, selectable, SSR'd).
 * Over it sits a canvas running a small physics sim: bean-shaped
 * particles (the ZRNO "O" — a capsule with a punched hole) fall under
 * gravity, drift, and tumble. The canvas is then clipped two ways:
 *   1) to the glyph shapes (a mask redrawn from the same text), so beans
 *      only ever appear *inside* the letters, and
 *   2) to a soft radial cloud around the cursor, so they only rain where
 *      you're looking — a cloud over an area, as asked.
 * It only animates while hovered (rAF stops when idle) and is disabled
 * for reduced-motion / coarse pointers (the text renders untouched).
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
}

export function BeanRain({
  lines,
  className,
}: {
  lines: Line[]
  className?: string
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
    let width = 0
    let height = 0
    let beans: Bean[] = []
    let mask: HTMLCanvasElement | null = null
    const pointer = { x: -9999, y: -9999 }
    let hovering = false
    let hoverAlpha = 0
    let raf = 0
    let last = 0

    const fontPx = () => parseFloat(getComputedStyle(host).fontSize) || 48

    function rand(min: number, max: number) {
      return min + Math.random() * (max - min)
    }

    function makeBean(fs: number, atTop: boolean, i: number): Bean {
      const len = fs * rand(0.16, 0.32)
      return {
        x: Math.random() * width,
        y: atTop ? -len - Math.random() * height : Math.random() * height,
        vx: rand(-0.5, 0.5) * fs * 0.7,
        vy: fs * rand(2.5, 6),
        rot: Math.random() * Math.PI * 2,
        vrot: rand(-3, 3),
        len,
        deep: i % 3 === 0,
      }
    }

    function seed() {
      const fs = fontPx()
      const count = Math.max(16, Math.min(140, Math.round(width / 18)))
      beans = Array.from({ length: count }, (_, i) => makeBean(fs, false, i))
    }

    function capsule(len: number, hole: boolean) {
      const w = hole ? len * 0.6 * 0.34 : len * 0.6
      const h = hole ? len * 0.52 : len
      const r = w / 2
      ctx!.beginPath()
      if (typeof (ctx as any).roundRect === 'function') {
        ;(ctx as any).roundRect(-w / 2, -h / 2, w, h, r)
      } else {
        ctx!.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
      }
    }

    function buildMask() {
      if (width <= 0 || height <= 0) return
      const hostRect = host.getBoundingClientRect()
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
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        mc.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        try {
          ;(mc as any).letterSpacing = cs.letterSpacing
        } catch {
          /* older browsers: ignore */
        }
        const text = el.textContent || ''
        const fs = parseFloat(cs.fontSize) || 48
        const mt = mc.measureText(text)
        const ascent = mt.fontBoundingBoxAscent ?? fs * 0.8
        const descent = mt.fontBoundingBoxDescent ?? fs * 0.2
        const baseline = (r.height - (ascent + descent)) / 2 + ascent
        mc.fillText(text, r.left - hostRect.left, r.top - hostRect.top + baseline)
      })
      mask = m
    }

    function resize() {
      width = host.clientWidth
      height = host.clientHeight
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      seed()
      buildMask()
    }

    function frame(t: number) {
      const dt = Math.min(0.05, (t - last) / 1000 || 0)
      last = t
      hoverAlpha += ((hovering ? 1 : 0) - hoverAlpha) * Math.min(1, dt * 6)

      const fs = fontPx()
      const g = Math.max(1400, fs * 7)
      for (const b of beans) {
        b.vy += g * dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.rot += b.vrot * dt
        if (b.y - b.len > height) {
          Object.assign(b, makeBean(fs, true, Math.round(b.x)))
        }
      }

      // 1) beans
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, width, height)
      for (const b of beans) {
        ctx!.save()
        ctx!.translate(b.x, b.y)
        ctx!.rotate(b.rot)
        ctx!.fillStyle = b.deep ? AMBERDEEP : AMBER
        capsule(b.len, false)
        ctx!.fill()
        ctx!.restore()
      }
      // 2) punch the bean holes (the "O")
      ctx!.globalCompositeOperation = 'destination-out'
      for (const b of beans) {
        ctx!.save()
        ctx!.translate(b.x, b.y)
        ctx!.rotate(b.rot)
        capsule(b.len, true)
        ctx!.fill()
        ctx!.restore()
      }
      // 3) clip to the glyphs
      ctx!.globalCompositeOperation = 'destination-in'
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
      if (mask) ctx!.drawImage(mask, 0, 0)
      // 4) clip to the cursor cloud
      const cr = Math.max(90, fs * 1.7) * dpr
      const grad = ctx!.createRadialGradient(
        pointer.x * dpr,
        pointer.y * dpr,
        0,
        pointer.x * dpr,
        pointer.y * dpr,
        cr,
      )
      grad.addColorStop(0, `rgba(0,0,0,${hoverAlpha})`)
      grad.addColorStop(0.5, `rgba(0,0,0,${hoverAlpha})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.fillStyle = grad
      ctx!.fillRect(0, 0, canvas.width, canvas.height)
      ctx!.globalCompositeOperation = 'source-over'

      if (hovering || hoverAlpha > 0.01) {
        raf = requestAnimationFrame(frame)
      } else {
        raf = 0
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx!.clearRect(0, 0, width, height)
      }
    }

    function onMove(e: MouseEvent) {
      const r = host.getBoundingClientRect()
      pointer.x = e.clientX - r.left
      pointer.y = e.clientY - r.top
    }
    function onEnter(e: MouseEvent) {
      hovering = true
      onMove(e)
      buildMask()
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
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
  }, [enabled, linesKey])

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
