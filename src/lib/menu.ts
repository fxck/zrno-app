// Single source of truth for the menu — used by the landing page (display),
// the order flow (cart), and the order API (server-side price validation).
export type MenuItem = {
  id: string
  name: string
  desc: string
  price: number // Kč
}

export const MENU: MenuItem[] = [
  { id: 'espresso', name: 'Espresso', desc: 'Double shot of our house Prague blend', price: 75 },
  { id: 'flat-white', name: 'Flat White', desc: 'Velvety microfoam, served at six ounces', price: 95 },
  { id: 'cortado', name: 'Cortado', desc: 'Equal parts espresso and steamed milk', price: 85 },
  { id: 'pour-over', name: 'Pour Over', desc: 'Single origin, rotating seasonal selection', price: 110 },
  { id: 'cold-brew', name: 'Cold Brew', desc: 'Eighteen-hour slow steep, deep and smooth', price: 105 },
  { id: 'beans-250', name: 'Beans 250g', desc: 'Take the house roast home, whole bean', price: 320 },
]

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(
  MENU.map((i) => [i.id, i]),
)

export function formatCZK(amount: number): string {
  return `${amount} Kč`
}
