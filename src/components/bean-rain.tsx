import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT, usePointerFine } from './motion-primitives'

/* ------------------------------------------------------------------ *
 * BeanRain — coffee beans rain down INSIDE a headline, only in a soft
 * cloud around the cursor.
 *
 * The visible headline is real DOM text (accessible, SSR'd). Over it a
 * canvas runs a small physics sim: bean-shaped particles (an "O" — a
 * capsule with a punched hole, drawn in a single even-odd fill) fall
 * under gravity and tumble. The canvas is clipped to the glyph shapes
 * (a mask redrawn from the same text) and to a radial cloud at the
 * cursor.
 *
 * Performance: the sim only animates while hovered (rAF stops when
 * idle), the font size is cached (no per-frame getComputedStyle), and —
 * the big one — every per-frame composite (bean draws, glyph mask,
 * cursor gradient) is confined to a small box around the pointer instead
 * of the whole (possibly huge) headline canvas. Disabled for
 * reduced-motion / coarse pointers.
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
    let fs = 48 // cached font size (px) — refreshed on resize/enter, never per-frame
    let beans: Bean[] = []
    let mask: HTMLCanvasElement | null = null
    const pointer = { x: -9999, y: -9999 }
    let hovering = false
    let hoverAlpha = 0
    let raf = 0
    let lastT = 0

    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    // Bean dimensions/speeds are clamped in absolute px so a 480px hero glyph
    // doesn't get 80px beans screaming down the screen — they stay bean-sized
    // and gently paced at every headline scale.
    const beanLen = () =>
      Math.max(6, Math.min(26, fs * 0.07)) * rand(0.72, 1.25)
    const gravity = () => Math.min(1000, Math.max(420, fs * 1.3))
    const TERMINAL = 380

    function resetBean(b: Bean, atTop: boolean, i: number) {
      b.len = beanLen()
      b.x = Math.random() * width
      b.y = atTop ? -b.len - Math.random() * height * 0.6 : Math.random() * height
      b.vx = rand(-16, 16)
      b.vy = rand(40, 130)
      b.rot = Math.random() * Math.PI * 2
      b.vrot = rand(-1.3, 1.3)
      b.deep = i % 3 === 0
    }

    function seed() {
      const count = Math.max(14, Math.min(90, Math.round(width / 24)))
      beans = Array.from({ length: count }, (_, i) => {
        const b: Bean = {
          x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, len: 10, deep: false,
        }
        resetBean(b, false, i)
        return b
      })
    }

    // One even-odd path: outer capsule minus inner capsule = an "O" bean.
    function beanPath(len: number) {
      const ow = len * 0.62
      const oh = len
      const iw = ow * 0.4
      const ih = oh * 0.46
      ctx!.beginPath()
      ;(ctx as any).roundRect(-ow / 2, -oh / 2, ow, oh, ow / 2)
      ;(ctx as any).roundRect(-iw / 2, -ih / 2, iw, ih, iw / 2)
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
        const size = parseFloat(cs.fontSize) || 48
        const mt = mc.measureText(text)
        const ascent = mt.fontBoundingBoxAscent ?? size * 0.8
        const descent = mt.fontBoundingBoxDescent ?? size * 0.2
        const baseline = (r.height - (ascent + descent)) / 2 + ascent
        mc.fillText(text, r.left - hostRect.left, r.top - hostRect.top + baseline)
      })
      mask = m
    }

    function resize() {
      width = host.clientWidth
      height = host.clientHeight
      fs = parseFloat(getComputedStyle(host).fontSize) || 48
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      seed()
      buildMask()
    }

    function frame(t: number) {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0)
      lastT = t
      hoverAlpha += ((hovering ? 1 : 0) - hoverAlpha) * Math.min(1, dt * 6)

      const g = gravity()
      for (let i = 0; i < beans.length; i++) {
        const b = beans[i]
        b.vy = Math.min(TERMINAL, b.vy + g * dt)
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.rot += b.vrot * dt
        if (b.y - b.len > height) resetBean(b, true, i)
      }

      // Clear is cheap (memset); the costly compositing is bounded to the cloud.
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
      ctx!.clearRect(0, 0, canvas.width, canvas.height)

      const crCss = Math.max(44, Math.min(150, fs * 0.62))
      if (hoverAlpha > 0.01 && mask) {
        // device-pixel box around the pointer
        const bx = Math.max(0, Math.floor((pointer.x - crCss) * dpr))
        const by = Math.max(0, Math.floor((pointer.y - crCss) * dpr))
        const bw = Math.min(canvas.width - bx, Math.ceil(crCss * 2 * dpr))
        const bh = Math.min(canvas.height - by, Math.ceil(crCss * 2 * dpr))

        if (bw > 0 && bh > 0) {
          // 1) draw only the beans near the cursor (css-space transform)
          ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
          for (let i = 0; i < beans.length; i++) {
            const b = beans[i]
            if (
              Math.abs(b.x - pointer.x) > crCss + b.len ||
              Math.abs(b.y - pointer.y) > crCss + b.len
            )
              continue
            ctx!.save()
            ctx!.translate(b.x, b.y)
            ctx!.rotate(b.rot)
            ctx!.fillStyle = b.deep ? AMBERDEEP : AMBER
            beanPath(b.len)
            ctx!.fill('evenodd')
            ctx!.restore()
          }
          // 2) clip to glyphs — only the cloud box of the mask
          ctx!.setTransform(1, 0, 0, 1, 0, 0)
          ctx!.globalCompositeOperation = 'destination-in'
          ctx!.drawImage(mask, bx, by, bw, bh, bx, by, bw, bh)
          // 3) clip to the cursor cloud
          const cx = pointer.x * dpr
          const cy = pointer.y * dpr
          const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, crCss * dpr)
          grad.addColorStop(0, `rgba(0,0,0,${hoverAlpha})`)
          grad.addColorStop(0.55, `rgba(0,0,0,${hoverAlpha})`)
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx!.fillStyle = grad
          ctx!.fillRect(bx, by, bw, bh)
          ctx!.globalCompositeOperation = 'source-over'
        }
      }

      if (hovering || hoverAlpha > 0.01) {
        raf = requestAnimationFrame(frame)
      } else {
        raf = 0
      }
    }

    function onMove(e: MouseEvent) {
      const r = host.getBoundingClientRect()
      pointer.x = e.clientX - r.left
      pointer.y = e.clientY - r.top
    }
    function onEnter(e: MouseEvent) {
      hovering = true
      fs = parseFloat(getComputedStyle(host).fontSize) || 48
      onMove(e)
      buildMask()
      if (!raf) {
        lastT = performance.now()
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
