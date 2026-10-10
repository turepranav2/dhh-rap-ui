# Design Guide

## Principles
1. **The bar is the hero.** Scenes support the line; never fight the vocal. The punchline gets the biggest motion.
2. **Literal UI, twisted.** Use UI metaphors people know (call screen, UPI payment, chat, maps, notifications, boarding pass) and subvert them at the punchline.
3. **Beat-tight.** Major motion lands on the bar's downbeat; micro-motion on 1/8ths.
4. **Readable first.** Short on-screen text only; line text shown small in the rail unless the bar needs it big.
5. **Desi texture.** Street signage, auto-rickshaw typography, receipts, SMS, WhatsApp. Avoid generic neon-cyberpunk.

## Canvas
- 9:16 primary, 6% safe padding. Desktop: centred 9:16 stage over blurred album-art backdrop.

## Motion
- Durations: micro 120 ms, standard 240 ms, hero 480 ms. Ease in `cubic-bezier(.2,.8,.2,1)`, out `cubic-bezier(.4,0,1,1)`.
- Line-to-line transitions: hard-cut, whip-pan or match-cut, chosen per pair in the scene doc. Default 140 ms crossfade+scale.
- Respect `prefers-reduced-motion`.

## Type
- Display: heavy grotesk or condensed, with Noto Sans Devanagari fallback. Min body 14 px at 390 px width.

## Colour
- Per-song theme tokens only. AA contrast. Accent switches by `voice`.
