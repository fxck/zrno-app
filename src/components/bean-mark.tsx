import { useId } from 'react'

/* ------------------------------------------------------------------ *
 * BeanMark — the ZRNO "O", angled, used as the logo glyph.
 *
 * Anton's "O" is a tall capsule with a capsule cut-out — which, tipped
 * to the right, reads as a roasted coffee bean. We rebuild it as an SVG
 * (capsule minus capsule, punched with a mask so the hole is genuinely
 * transparent over any background) so it can sit inline in the wordmark,
 * scale to any size, and tint via currentColor.
 *
 * The viewBox (120×160) is sized so the rotated capsule fills it almost
 * edge-to-edge — no dead padding — so a caller can size the box to the
 * cap height and the bean lands at the right visual weight.
 * ------------------------------------------------------------------ */
export function BeanMark({
  className,
  angle = 18,
  title,
}: {
  className?: string
  angle?: number
  title?: string
}) {
  // useId → unique mask id so multiple marks on a page don't collide.
  const maskId = 'beanmask-' + useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 120 160"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <mask id={maskId}>
          <rect width="120" height="160" fill="black" />
          <g transform={`rotate(${angle} 60 80)`}>
            <rect x="25" y="11" width="70" height="138" rx="35" fill="white" />
            <rect x="51" y="46" width="18" height="68" rx="9" fill="black" />
          </g>
        </mask>
      </defs>
      <rect width="120" height="160" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Wordmark — "ZRN" + the angled bean as the O, at full cap height.
 *
 * items-baseline + a box sized to the cap height makes the bean sit in
 * the same band as the caps (baseline → cap height), so it reads as a
 * real letter, not a shrunken icon.
 * ------------------------------------------------------------------ */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={
        'inline-flex items-baseline font-display tracking-wider ' +
        (className ?? '')
      }
      aria-label="ZRNO"
    >
      <span aria-hidden>ZRN</span>
      <BeanMark className="ml-[0.04em] h-[0.82em] w-[0.62em]" />
    </span>
  )
}
