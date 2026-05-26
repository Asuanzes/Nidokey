---
name: buysell-asturias-design
description: Use this skill to generate well-branded interfaces and assets for BuySell Asturias (a Spanish real-estate tracking webapp), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Key reminders specific to BuySell Asturias:

- **All copy is Spanish (Castellano).** No English. Use `lang="es"`.
- **Voice is sober and factual.** No marketing tone, no exclamation marks, no emoji.
- **The whole UI runs on 13px body.** It is dense product UI for an operator, not a marketing site.
- **One accent colour: steel blue `#3A5F8A`.** Aged brass `#C49A4D` only on the key brand-mark.
- **Two icon systems:** Lucide React for general UI, plus a custom BuySell icon family (the key is canonical).
- **No gradients, no textures, no blur** (one exception: gallery nav buttons over photos).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Reference `colors_and_type.css` at the top of every HTML file, copy the brand SVGs from `assets/` rather than recreating them, and lean on the UI kit components in `ui_kits/web/` for layouts that match the product.

If working on production code, copy assets and read the rules here to become an expert in designing with this brand. Cross-reference back to the source repository at <https://github.com/Asuanzes/BuySell> for the canonical implementations of UI components.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions about which screens and components they need, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
