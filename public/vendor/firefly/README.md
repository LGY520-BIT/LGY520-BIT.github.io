# Firefly responsive layout subset

Upstream: https://github.com/CuteLeaf/Firefly

Pinned commit: `91cbbefe53716e70b77ca9c41e27af10f5b27cab`.

- `responsive-utils.ts`: exact original source.
- `responsive-layout.mjs`: actual `trackSegments`, `computeGridColumns` and `gridColumnVarsToStyle` implementation extracted from that source. TypeScript types were stripped with Node's `stripTypeScriptTypes`; the unrelated config import and config-dependent helpers were omitted. Sidebar width is adapted by our page CSS. This module is imported and executed during homepage SSR.
- `PostCard.astro.source`, `layout-base.css.source`: exact reference source, not loaded as executable code or a wholesale template installation.
- `LICENSE`: exact upstream MIT license and original author notices.

Our all-route visual design, native shortcut center and content schema are separate local implementations. No Firefly anime model, wallpaper, music, demo posts, remote player API or tracking configuration was copied. Existing local publishing, AI proxy, reader library, timer, player and pet integrations remain in this project.

Source hashes: `verification/ux-firefly-sources.json` in the local project. No network fetch is required by the browser for this module.
