# Color Palette

The single source of truth is [`src/app/globals.css`](../src/app/globals.css). This file documents it.
If you change a color, change it there first, then update this table.

Theme switching is done by `next-themes`, which sets `class="dark"` on `<html>`.

## Brand

| Role | Light | Dark | Use it for |
|---|---|---|---|
| Primary | `#2547D0` | `#7C93FF` | Main buttons, links, focus, active nav |
| Primary hover | `#1C39AE` | `#98AAFF` | Hover state of primary |
| Primary text | `#2547D0` | `#A3B3FF` | Text in primary color on plain backgrounds |
| Primary soft | `#E9EEFD` | `rgba(124,147,255,.14)` | Selected rows, chips, light highlights |
| Text on primary | `#FFFFFF` | `#0B0D12` | Label inside a primary button |
| Mark | `#F7DD5B` | `rgba(230,202,76,.30)` | Text highlighter effect |
| Mark solid | `#F2D53C` | `#E6CA4C` | Small solid accents (badges, dots) |

## Neutrals

| Token | Light | Dark | Use it for |
|---|---|---|---|
| `--bg` | `#F6F6F3` | `#0D0F13` | Page background |
| `--surface` | `#FFFFFF` | `#14171D` | Cards, panels, inputs |
| `--surface-2` | `#F0F0EC` | `#1B1F27` | Muted blocks, secondary buttons |
| `--surface-3` | `#E6E6E0` | `#232833` | Pressed states, skeletons |
| `--border` | `#E3E3DE` | `#252A33` | Default borders and dividers |
| `--border-strong` | `#CCCCC4` | `#363C48` | Input borders, emphasis |
| `--fg` | `#15171C` | `#ECEDEF` | Headings and body text |
| `--fg-2` | `#3D424B` | `#C4C8CF` | Secondary text |
| `--muted` | `#646A73` | `#979DA8` | Captions, placeholders, meta |

## Status

| Token | Light | Light soft | Dark | Dark soft |
|---|---|---|---|---|
| Success | `#1D7A4A` | `#E2F2E9` | `#5FCB8F` | `rgba(95,203,143,.13)` |
| Warning | `#9A5600` | `#FBEFD9` | `#EEAC4E` | `rgba(238,172,78,.13)` |
| Danger | `#BE3A30` | `#FBE8E6` | `#F27D73` | `rgba(242,125,115,.13)` |

Pattern: solid color for text and icons, soft color for the background behind it.

## Effects

| Token | Light | Dark |
|---|---|---|
| `--ring` (focus) | `rgba(37,71,208,.28)` | `rgba(124,147,255,.38)` |
| `--glow` | `rgba(37,71,208,.18)` | `rgba(124,147,255,.22)` |
| `--glass` | `rgba(255,255,255,.82)` | `rgba(20,23,29,.78)` |
| `--shadow` | `0 1px 2px rgba(20,22,28,.05), 0 6px 20px -10px rgba(20,22,28,.14)` | `0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.7)` |
| `--shadow-lg` | `0 30px 70px -30px rgba(20,22,28,.32), 0 2px 6px rgba(20,22,28,.05)` | `0 30px 70px -24px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.03)` |

## Contrast (WCAG 2.1)

Measured on `--bg` / `--surface`. AA needs 4.5 for body text, 3 for large text and UI.

| Text color | Light | Dark |
|---|---|---|
| `--fg` | 16.6 / 17.9 | 16.4 / 15.3 |
| `--fg-2` | 9.3 / 10.1 | 11.4 / 10.7 |
| `--muted` | 5.0 / 5.5 | 7.0 / 6.6 |
| Primary | 6.7 / 7.3 | 6.8 / 6.4 |
| Success | 4.9 / 5.3 | 9.5 / 8.9 |
| Warning | 5.2 / 5.7 | 9.7 / 9.1 |
| Danger | 5.1 / 5.5 | 7.3 / 6.8 |
| Text on primary button | 7.3 | 6.9 |

On their soft backgrounds (light theme): success 4.6, warning 5.0, danger 4.6, primary 6.3. All pairs pass AA.

## Typography

| Token | Font | Use |
|---|---|---|
| `--font-sans` | Geist | Body and UI |
| `--font-display` | Schibsted Grotesk | Headings |
| `--font-mono` | Geist Mono | Code, numbers in tables |

## Tailwind mapping

`@theme` in `globals.css` exposes these as Tailwind colors, for example `bg-background`, `text-foreground`,
`bg-card`, `text-muted-foreground`, `border-border`. Use the tokens. Do not hard-code hex values in components.

## Rules

- Never use a raw hex in a component. Add or reuse a token.
- Every new color needs a light and a dark value, and must pass AA against `--bg` and `--surface`.
- Do not use color alone to show status. Pair it with an icon or text.
