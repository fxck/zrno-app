import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import appCss from '../styles.css?url'
import { EASE_OUT, EASE_SOFT } from '../components/motion-primitives'

// useLayoutEffect warns on the server; pick the right one per environment so
// the scroll reset lands before paint on the client without the SSR noise.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'ZRNO — Specialty Coffee Roasters · Prague',
      },
      {
        name: 'description',
        content:
          'ZRNO is a specialty coffee roastery in Žižkov, Prague. Slow-roasted in small batches. Bold, dark, unmistakably ours.',
      },
      {
        name: 'theme-color',
        content: '#0b0908',
      },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Anton&family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootLayout,
  shellComponent: RootDocument,
})

/* ------------------------------------------------------------------ *
 * RootLayout — animates every route change with a smooth opacity
 * crossfade (mode="wait": the old page fades out, then the new fades
 * in) on the shared béchamel easing.
 *
 * Opacity ONLY — deliberately no transform/filter on the wrapper, so
 * it never becomes a containing block that would break the page's
 * position:fixed / sticky chrome (sticky header, floating cart,
 * scroll-progress bar). The per-page entrance motion (masked headlines,
 * reveals) still carries the sense of movement.
 * ------------------------------------------------------------------ */
function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const reduce = useReducedMotion()
  // Skip the scroll reset on the very first mount so browser scroll
  // restoration (refresh / back-forward) and deep links are preserved;
  // only SPA navigations reset.
  const firstRef = useRef(true)

  if (reduce) return <Outlet />

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.42, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: 0.22, ease: EASE_SOFT } }}
      >
        <ScrollManager trigger={pathname} firstRef={firstRef} />
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}

/* Mounts fresh with each navigated page (its parent is keyed by path),
 * so its layout-effect runs once the NEW page's DOM is present — after
 * the previous page's exit has completed under mode="wait". */
function ScrollManager({
  trigger,
  firstRef,
}: {
  trigger: string
  firstRef: React.MutableRefObject<boolean>
}) {
  useIsoLayoutEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    // Honor a cross-page hash link (e.g. /#menu from a sub-page nav).
    const hash = window.location.hash
    if (hash.length > 1) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
    // trigger in deps documents intent; the keyed remount is what re-runs it.
  }, [trigger])
  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
