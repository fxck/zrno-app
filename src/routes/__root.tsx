import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import appCss from '../styles.css?url'
import { EASE_OUT } from '../components/motion-primitives'
import { SiteHeader } from '../components/site-header'

/* The shared public header is rendered ONCE here, outside the page-fade
 * wrapper, so it persists across navigations — it never remounts or fades, so
 * switching e.g. home ⇄ order no longer flashes the (translucent) bar. Props
 * are derived from the path. Routes that own their chrome (admin → AdminShell,
 * the /o receipt) return null and get no shared header. */
type HeaderCfg = React.ComponentProps<typeof SiteHeader>
function headerConfig(pathname: string): HeaderCfg | null {
  if (pathname === '/') return { variant: 'home' }
  if (pathname === '/order')
    return { variant: 'page', back: true, backTo: '/', backLabel: '← BACK' }
  if (pathname === '/journal')
    return { variant: 'page', back: true, backTo: '/', backLabel: '← BACK TO SITE' }
  if (pathname.startsWith('/journal/'))
    return {
      variant: 'page',
      back: true,
      backTo: '/journal',
      backLabel: '← THE JOURNAL',
    }
  return null
}

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
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
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
 * RootLayout — subtle fade-IN on each navigated page.
 *
 * Deliberately NOT a crossfade: there's no exit animation and no
 * AnimatePresence mode="wait", so the new page mounts in the same commit
 * the old one unmounts — no blank frame, no height collapse, no layout
 * shift. The keyed wrapper just fades the incoming page 0→1.
 *
 * - Opacity only (never transform/filter) → the wrapper never becomes a
 *   containing block, so the fixed/sticky chrome keeps working.
 * - The FIRST load (SSR + hydration) renders at full opacity with NO
 *   animation, so there's no initial flash; only client navigations fade.
 * - Scroll resets to top on navigation (honoring cross-page #anchors).
 * ------------------------------------------------------------------ */
function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const reduce = useReducedMotion()
  // True only for the very first render — skips the fade on initial load and
  // the scroll reset on refresh/back-forward (browser restoration wins there).
  const firstRef = useRef(true)

  useIsoLayoutEffect(() => {
    if (firstRef.current) return
    const hash = window.location.hash
    if (hash.length > 1) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname])

  const animateThisPage = !firstRef.current && !reduce
  useEffect(() => {
    firstRef.current = false
  }, [])

  // Fade only when the top-level SECTION changes (home / order / journal /
  // admin / o), not on every sub-navigation. So moving between admin pages
  // doesn't re-fade — the back-office app bar stays static.
  const section = '/' + (pathname.split('/')[1] ?? '')

  // Persistent shared header sits OUTSIDE the keyed fade, so it never fades
  // in/out across navigations (that translucent fade was the "flash").
  const header = headerConfig(pathname)

  return (
    <>
      {header && <SiteHeader {...header} />}
      <motion.div
        key={section}
        initial={animateThisPage ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <Outlet />
      </motion.div>
    </>
  )
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
