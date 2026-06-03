# Cross-cutting band — UI prototype

**Question:** how should cross-cutting capabilities render as a stacked band of full-width chevrons at the bottom of the map (bounded first cap → last cap)?

**Artifact:** `2026-06-03-cross-cutting-band.html` — open in browser, switch via `?variant=A|B|C` or floating bar / arrow keys.

## Variants

- **A** — Stacked full-width chevrons, centred labels, charcoal fill (closest to existing top-row chevron style).
- **B** — Stacked full-width, gradient fill, uppercase left-aligned label, point on right edge.
- **C** — Overlapping layered chevrons (each row tucked under the next) for depth feel.
- **D** — Overlapping layered + left-aligned uppercase labels (C × B hybrid).

## Verdict

**D won** — overlap from C, left-aligned uppercase bottom-baseline labels. Folded into `bcm_CapabilityMap.js` / `.html` on 2026-06-03 (plan: `docs/plans/2026-06-03-17:30-cc-band-layered-fullwidth.md`). Prototype kept for reference; safe to delete once user has visually confirmed in deployed org.
