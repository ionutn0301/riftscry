# Lighthouse scores

Recorded 2026-08-22 against the production build (`pnpm build`) served with gzip
(as any real static host does), Lighthouse 13 defaults (simulated mobile, 4x CPU
throttle), Chromium headless.

| Page | Performance | Accessibility | Best practices | SEO | FCP | LCP |
|---|---|---|---|---|---|---|
| `/` (cinematic homepage) | **98** | 96 | 96 | 100 | 1.5s | 2.1s |
| `/patch/26.16` | **95** | 92 | 96 | 100 | 1.4s | 2.9s |
| `/champion/camille` | **98** | 94 | 96 | 100 | 0.9s | 2.4s |

Budgets from the spec (§13): product pages ≥ 90 all categories, homepage performance
≥ 85 with motion active — all met. TBT is 0ms and CLS ≤ 0.04 everywhere; the decisive
fixes were preloading the three text faces (the LCP element is display-font text) and
serving compressed responses.

Reproduce:

```bash
pnpm build
node tests/e2e/serve.mjs &
npx lighthouse http://127.0.0.1:4321/ --output=json
```
