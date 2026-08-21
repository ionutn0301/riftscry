import sharp from "sharp";

/**
 * One-off asset generation (outputs are committed):
 *   public/og-default.png   1200×630 — ink background + RIFTSCRY stacked mark
 *   public/favicon.png      96×96   — R monogram cropped from the same mark
 *   public/apple-touch-icon.png 180×180
 *
 * Run: pnpm exec tsx scripts/generate-og.ts
 */

const INK = { r: 19, g: 17, b: 16, alpha: 1 }; // --ink #131110
const MARK = "src/assets/brand/logo-mobile-light.png";

async function main() {
  const mark = sharp(MARK).trim();
  const meta = await mark.toBuffer({ resolveWithObject: true });

  // OG card.
  const logoH = 430;
  const resized = await sharp(meta.data).resize({ height: logoH }).toBuffer();
  const r = await sharp(resized).metadata();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: INK } })
    .composite([
      { input: resized, left: Math.round((1200 - (r.width ?? 0)) / 2), top: Math.round((630 - logoH) / 2) },
    ])
    .png()
    .toFile("public/og-default.png");

  // Favicon — the R monogram is the top ~55% of the stacked lockup.
  const full = await sharp(MARK).trim().toBuffer({ resolveWithObject: true });
  const cropH = Math.round(full.info.height * 0.55);
  const monogram = await sharp(full.data)
    .extract({ left: 0, top: 0, width: full.info.width, height: cropH })
    .trim()
    .toBuffer();
  for (const [size, file] of [
    [96, "public/favicon.png"],
    [180, "public/apple-touch-icon.png"],
  ] as const) {
    await sharp({ create: { width: size, height: size, channels: 4, background: { ...INK, alpha: 0 } } })
      .composite([
        {
          input: await sharp(monogram).resize({ width: size - 8, height: size - 8, fit: "inside" }).toBuffer(),
          gravity: "centre",
        },
      ])
      .png()
      .toFile(file);
  }
  console.log("✓ og-default.png, favicon.png, apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
