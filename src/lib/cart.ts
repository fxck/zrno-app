import { useSyncExternalStore } from 'react'
import { MENU, MENU_BY_ID, type MenuItem } from './menu'

/* ------------------------------------------------------------------ *
 * Shared cart store
 *
 * One source of truth for the order, shared by the landing menu (add in
 * place), the floating cart indicator, and the /order page. Persisted to
 * localStorage so the order survives navigation + reloads, and synced
 * across tabs via the `storage` event.
 *
 * SSR-safe: the server snapshot is always the empty cart (a stable frozen
 * reference), and the client only reads localStorage after mount inside
 * subscribe() — so hydration matches the server and there is no flash.
 * ------------------------------------------------------------------ */

export type Cart = Record<string, number> // itemId -> quantity

const KEY = 'zrno-cart-v1'
const MAX_QTY = 99

// Server / pre-hydration snapshot. Frozen + constant reference so
// useSyncExternalStore never loops.
const EMPTY: Cart = Object.freeze({}) as Cart

let state: Cart = EMPTY
let initialized = false
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function clamp(n: unknown): number {
  const v = Math.floor(Number(n) || 0)
  return v < 0 ? 0 : v > MAX_QTY ? MAX_QTY : v
}

// Drop junk, clamp quantities, prune zeros — never trust persisted JSON.
function sanitize(raw: unknown): Cart {
  if (!raw || typeof raw !== 'object') return {}
  const out: Cart = {}
  for (const [id, qty] of Object.entries(raw as Record<string, unknown>)) {
    if (!MENU_BY_ID[id]) continue // ignore ids no longer on the menu
    const n = clamp(qty)
    if (n > 0) out[id] = n
  }
  return out
}

function persist() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(state))
    }
  } catch {
    /* private mode / quota — cart still works in-memory for the session */
  }
}

// Runs once, on the client, the first time anything subscribes.
function ensureInit() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) state = sanitize(JSON.parse(raw))
  } catch {
    state = {}
  }
  // Cross-tab sync: mirror writes made in other tabs.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    try {
      state = e.newValue ? sanitize(JSON.parse(e.newValue)) : {}
    } catch {
      state = {}
    }
    emit()
  })
  emit() // notify anything that subscribed before init completed
}

function subscribe(cb: () => void): () => void {
  ensureInit()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// --- mutations -------------------------------------------------------------

function commit(next: Cart) {
  state = next
  persist()
  emit()
}

export function addItem(id: string, delta = 1) {
  if (!MENU_BY_ID[id]) return
  ensureInit()
  const next = { ...state }
  const q = clamp((next[id] || 0) + delta)
  if (q > 0) next[id] = q
  else delete next[id]
  commit(next)
}

export function setQty(id: string, qty: number) {
  if (!MENU_BY_ID[id]) return
  ensureInit()
  const next = { ...state }
  const q = clamp(qty)
  if (q > 0) next[id] = q
  else delete next[id]
  commit(next)
}

export function removeItem(id: string) {
  ensureInit()
  if (!(id in state)) return
  const next = { ...state }
  delete next[id]
  commit(next)
}

export function clearCart() {
  ensureInit()
  if (Object.keys(state).length === 0) return
  commit({})
}

// --- selectors / hooks -----------------------------------------------------

export function useCart(): Cart {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  )
}

export type CartLine = { item: MenuItem; qty: number; lineTotal: number }

// Cart lines in menu order, plus the running count + total. Derived from a
// Cart so callers can pass either the live hook value or a snapshot.
export function cartSummary(cart: Cart): {
  lines: CartLine[]
  count: number
  total: number
} {
  const lines: CartLine[] = []
  let count = 0
  let total = 0
  for (const item of MENU) {
    const qty = cart[item.id] || 0
    if (qty <= 0) continue
    const lineTotal = item.price * qty
    lines.push({ item, qty, lineTotal })
    count += qty
    total += lineTotal
  }
  return { lines, count, total }
}
