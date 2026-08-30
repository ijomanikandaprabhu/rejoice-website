# Design system

Two design systems, deliberately kept apart. Implemented in [`tailwind.config.ts`](../tailwind.config.ts) and [`src/app/globals.css`](../src/app/globals.css).

## Public website (`site` tokens)

**Font:** Inter Tight

**Colors**

| Token             | Hex       | Use              |
| ----------------- | --------- | ---------------- |
| `site-accent`      | `#FF6D29` | Primary accent   |
| `site-secondary`   | `#453027` | Secondary        |
| `site-bg`          | `#000000` | Background       |
| `site-surface`     | `#1E1B1D` | Surface          |
| `site-muted`       | `#BABABA` | Muted text       |
| `site-fg`          | `#FFFFFF` | Foreground text  |

**Style**

- Dark, editorial layout.
- Cards have a glossy finish: diagonal light sheen overlay, soft inner top highlight, deep drop shadow. See `.card-gloss` in `globals.css`.
- Buttons are full pill shape (`border-radius: 999px`). See `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`.
- Corner radius scale: `8px` inputs, `16px` small elements, `20px` cards, `28px` hero panels (`input` / `sm2` / `card` / `hero` in `tailwind.config.ts`).
- Hero sections use a radial ember gradient (orange to near-black) in the top-right corner (`bg-ember` / `bg-emberSoft`).

**Type scale**

| Level | Size | Weight |
| ----- | ---- | ------ |
| H1    | 52px | 600    |
| H2    | 36px | 600    |
| H3    | 22px | 500    |
| Body  | 16px | 400    |
| Label | 12px | 500, uppercase |

## Admin portal (`panel` tokens, scoped to `.admin-theme`)

**Font:** Manrope

**Colors**

| Token             | Hex       | Use                                                       |
| ----------------- | --------- | ---------------------------------------------------------- |
| `panel-bg`         | `#0B0B0C` | Background                                                  |
| `panel` (DEFAULT)  | `#151515` | Panel                                                       |
| `panel-alt`        | `#1C1C1D` | Panel (secondary)                                           |
| `panel-accent`     | `#D6FF3F` | Accent — sparingly: primary buttons, one highlighted row/item, chart peaks only |
| `panel-muted`      | `#9A9A9A` | Muted text                                                  |
| `panel-fg`         | `#F4F4F2` | Foreground text                                             |
| `panel-negative`   | `#FF6B5E` | Negative/error                                              |

**Style**

- Dark panel-based layout, 20px border radius on panels (`rounded-panel`).
- Top bar: logo mark, nav tabs, icon buttons, avatar.
- Stat panels: label row with small icon, big bold number, trend indicator, small caption.
- List rows (deals/transactions/items): icon + name/subtitle on left, value/status on right; one row can be highlighted with a solid accent fill.
- Bar chart pattern: neutral bars (`chart-2`..`chart-5`) with a single accent-colored peak bar (`chart-1`).
- An "assistant" panel: headline question, suggestion chips, chat input row.

**Component status:** top bar and list rows exist in the admin UI today. Stat panels, the accent bar-chart pattern, and the assistant panel are described here as the target pattern but are not yet built as reusable components — build them against these tokens when needed, don't introduce new colors/radii.

## Notes

- The admin also maps onto shadcn's token set (`--background`, `--card`, `--primary`, etc.) via CSS variables in `globals.css`, scoped to `.admin-theme`, so shadcn components inherit the panel palette automatically.
- Any light-background card (e.g. warning/danger callouts) must set explicit text colors — `text-card-foreground` / `text-muted-foreground` resolve to near-white for the dark theme and will be unreadable on a light surface.
