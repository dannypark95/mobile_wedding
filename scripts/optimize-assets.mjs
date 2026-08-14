// One-off asset optimizer.
//
// The photos committed to img/ are straight off the camera (up to 27 megapixels,
// ~14 MB each). They are displayed in a column that is never wider than 480 CSS px,
// and guests open this on phones over cellular data from a KakaoTalk link. Six of
// them decode to ~570 MB of bitmap RAM, which is enough to make iOS Safari drop
// images to grey boxes on an older phone.
//
// Originals are copied to img-originals/ (gitignored) before anything is touched.
// Filenames and extensions are preserved so no import in App.tsx has to change.
//
// Run: node scripts/optimize-assets.mjs            (every step)
//      node scripts/optimize-assets.mjs icons      (one step — see `steps` at the bottom)

import { promises as fs } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backupDir = path.join(root, 'img-originals')

// 480 CSS px column at 3x DPR = 1440 device px. Anything beyond this is invisible.
const MAX_WIDTH = 1440
const JPEG_QUALITY = 82

const photos = [
  'img/main/IMG_0368.jpg',
  'img/main/invitation.jpg',
  'img/main/send_off.JPG',
  'img/gallery/IMG_0079.jpg',
  'img/gallery/IMG_0515.jpg',
  'img/gallery/P20260530_175906740_DSCF3166.JPG',
]

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`

async function backup(relPath) {
  const dest = path.join(backupDir, relPath)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  try {
    await fs.access(dest)
    return // already backed up; never overwrite an original with an optimized file
  } catch {
    await fs.copyFile(path.join(root, relPath), dest)
  }
}

async function optimizePhoto(relPath) {
  const abs = path.join(root, relPath)
  await backup(relPath)

  const before = (await fs.stat(abs)).size
  const source = path.join(backupDir, relPath) // always re-encode from the pristine original
  const meta = await sharp(source).metadata()

  const buf = await sharp(source)
    .rotate() // bake in EXIF orientation before we strip metadata, or portraits come out sideways
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
    .toBuffer()

  await fs.writeFile(abs, buf)
  const after = buf.length
  const out = await sharp(buf).metadata()
  console.log(
    `${relPath}\n  ${meta.width}x${meta.height} ${kb(before)}  ->  ${out.width}x${out.height} ${kb(after)}  (${(before / after).toFixed(1)}x smaller)`,
  )
  return { before, after }
}

async function optimizeMap() {
  const rel = 'img/main/map.png'
  const abs = path.join(root, rel)
  await backup(rel)
  const before = (await fs.stat(abs)).size
  // A map screenshot: keep PNG (text stays crisp, no JPEG ringing) but quantize the palette.
  const buf = await sharp(path.join(backupDir, rel))
    .resize({ width: 1080, withoutEnlargement: true })
    .png({ palette: true, quality: 80, effort: 9 })
    .toBuffer()
  await fs.writeFile(abs, buf)
  console.log(`${rel}\n  ${kb(before)}  ->  ${kb(buf.length)}  (${(before / buf.length).toFixed(1)}x smaller)`)
  return { before, after: buf.length }
}

// Kakao's link-preview card wants >=800x400; Twitter's summary_large_image wants 1200x630.
// The existing card is 540x284, which renders visibly soft on a modern phone. Rebuild it
// at 1200x630 rather than upscaling, reproducing the same typographic layout.
async function buildPreview() {
  const rel = 'public/preview.png'
  const abs = path.join(root, rel)
  await backup(rel)
  const before = (await fs.stat(abs)).size

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <g fill="#111111" font-family="Nanum Myeongjo, Batang, BatangChe, Malgun Gothic, serif" text-anchor="middle">
    <text x="270" y="345" font-size="58" letter-spacing="14">박성현</text>
    <text x="600" y="285" font-size="130">10</text>
    <text x="600" y="435" font-size="130">24</text>
    <text x="930" y="345" font-size="58" letter-spacing="14">배예은</text>
  </g>
  <rect x="505" y="312" width="190" height="5" fill="#111111"/>
</svg>`

  const buf = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer()
  await fs.writeFile(abs, buf)
  console.log(`${rel}\n  540x284 ${kb(before)}  ->  1200x630 ${kb(buf.length)}`)
  return { before, after: buf.length }
}

// The home-screen icon. iOS masks an apple-touch-icon into a rounded square and composites
// any transparency onto black, so it wants an opaque, square source. The artwork shipped as
// 170x156 with uneven whitespace, which every consumer of it — iOS, Android, the browser tab —
// was squashing to fit its own square box. Trim to the artwork itself, then centre it on a
// square canvas: 140 of 180 leaves a 20px margin the rounded-corner mask cannot bite into,
// and the trimmed art is 147x131, so nothing is ever upscaled.
const ICON_SIZE = 180
const ICON_SVG = 'public/icon.svg'
const ICON_INK = '#D9B780'
const ICON_GROUND = '#222220'

// public/icon.svg is the mark, and it carries its glyphs as vector paths rather than a
// <text> element on purpose: the design calls for Cormorant Garamond, almost nobody has it
// installed, and a font-name reference would silently render as Times New Roman on most
// phones and in librsvg here. Paths render identically everywhere with no webfont to load.
// Regenerate it with the `monogram` step below if the letters or spacing ever change.
async function buildIcons() {
  const svgPath = path.join(root, ICON_SVG)
  const svg = await fs.readFile(svgPath)
  const before = svg.length

  // density, not just resize: sharp rasterises the SVG at its 64px intrinsic size first, so
  // without this the 180px output is an upscale of a 64px bitmap with visibly soft edges.
  const render = () => sharp(svg, { density: 1200 }).resize(ICON_SIZE, ICON_SIZE)

  // The tab favicon keeps the rounded corners and the transparency outside them.
  const rounded = await render().png({ compressionLevel: 9 }).toBuffer()
  await fs.writeFile(path.join(root, 'public/icon.png'), rounded)

  // iOS masks an apple-touch-icon into its own rounded square and composites transparency
  // onto black, so handing it a pre-rounded icon gets the corners rounded twice with a dark
  // fringe between the two radii. Flattening onto the mark's own charcoal fills the corners
  // back in, leaving a full-bleed square for iOS to cut its own shape from.
  const fullBleed = await render()
    .flatten({ background: ICON_GROUND })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await fs.writeFile(path.join(root, 'public/apple-touch-icon.png'), fullBleed)

  console.log(
    `public/icon.png\n  ${ICON_SIZE}x${ICON_SIZE} ${kb(rounded.length)} (rounded, alpha)`
    + `\npublic/apple-touch-icon.png\n  ${ICON_SIZE}x${ICON_SIZE} ${kb(fullBleed.length)} (full bleed on ${ICON_GROUND})`,
  )
  return { before, after: rounded.length + fullBleed.length }
}

// ── Monogram ──────────────────────────────────────────────────────────────────────────────
// Rebuilds public/icon.svg from the real font. Needs network the first time (the font is
// cached in .cache/, gitignored); buildIcons above never does, because the SVG it reads has
// the outlines baked in.
const MONOGRAM_TEXT = 'S•Y'
const MONOGRAM_SIZE = 28      // in the 64-unit viewBox
const MONOGRAM_TRACKING = 1.5
const MONOGRAM_BOX = 64
const MONOGRAM_RADIUS = 14

// Google serves Cormorant Garamond as a variable font whose default instance is Light 300,
// and opentype.js 2.0 parses the fvar axes but does not apply gvar deltas — set({wght:600})
// leaves the outlines untouched, which is why this takes the static weight-600 instance from
// the CSS API instead. That one is only offered as WOFF, hence the unwrap below.
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600'
// A UA old enough to be offered WOFF rather than WOFF2, which is a far bigger thing to unwrap.
const FONT_UA = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.36'

/** WOFF is an sfnt with per-table zlib compression; rebuild the plain TTF it wraps. */
function woffToTtf(woff) {
  if (woff.toString('latin1', 0, 4) !== 'wOFF') throw new Error('Not a WOFF file.')
  const numTables = woff.readUInt16BE(12)
  const entries = []
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20
    entries.push({
      tag: woff.toString('latin1', o, o + 4),
      offset: woff.readUInt32BE(o + 4),
      compLength: woff.readUInt32BE(o + 8),
      origLength: woff.readUInt32BE(o + 12),
      checksum: woff.readUInt32BE(o + 16),
    })
  }
  entries.sort((a, b) => (a.tag < b.tag ? -1 : 1)) // sfnt table records must be tag-ordered

  const header = Buffer.alloc(12)
  header.writeUInt32BE(woff.readUInt32BE(4), 0) // flavor, carried over from the WOFF header
  header.writeUInt16BE(numTables, 4)
  const pot = 2 ** Math.floor(Math.log2(numTables))
  header.writeUInt16BE(pot * 16, 6)
  header.writeUInt16BE(Math.log2(pot), 8)
  header.writeUInt16BE((numTables - pot) * 16, 10)

  const records = Buffer.alloc(16 * numTables)
  const bodies = []
  let offset = 12 + 16 * numTables
  entries.forEach((entry, i) => {
    const raw = woff.subarray(entry.offset, entry.offset + entry.compLength)
    const data = entry.compLength < entry.origLength ? zlib.inflateSync(raw) : raw
    records.write(entry.tag, i * 16, 4, 'latin1')
    records.writeUInt32BE(entry.checksum, i * 16 + 4)
    records.writeUInt32BE(offset, i * 16 + 8)
    records.writeUInt32BE(data.length, i * 16 + 12)
    const padded = Buffer.alloc((data.length + 3) & ~3) // tables are 4-byte aligned
    data.copy(padded)
    bodies.push(padded)
    offset += padded.length
  })
  return Buffer.concat([header, records, ...bodies])
}

async function loadMonogramFont() {
  const cached = path.join(root, '.cache', 'CormorantGaramond-SemiBold.ttf')
  try {
    return await fs.readFile(cached)
  } catch {
    // not cached yet
  }
  const css = await (await fetch(FONT_CSS, { headers: { 'User-Agent': FONT_UA } })).text()
  const url = css.match(/url\((https:[^)]+\.woff)\)/)?.[1]
  if (!url) throw new Error('Could not find a WOFF url in the Google Fonts response.')
  const woff = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': FONT_UA } })).arrayBuffer())
  const ttf = woffToTtf(woff)
  await fs.mkdir(path.dirname(cached), { recursive: true })
  await fs.writeFile(cached, ttf)
  console.log(`Cached ${path.relative(root, cached)} (${kb(ttf.length)}).`)
  return ttf
}

async function buildMonogram() {
  const abs = path.join(root, ICON_SVG)
  const before = await fs.stat(abs).then((s) => s.size, () => 0)
  const ttf = await loadMonogramFont()
  const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength))
  if (font.tables.os2.usWeightClass !== 600) {
    throw new Error(`Expected weight 600, got ${font.tables.os2.usWeightClass}.`)
  }

  // Lay the glyphs out by hand so the tracking is explicit rather than a CSS property that
  // librsvg would ignore.
  let pen = 0
  const commands = []
  for (const char of MONOGRAM_TEXT) {
    const glyph = font.charToGlyph(char)
    if (!glyph.index) throw new Error(`Font has no glyph for ${JSON.stringify(char)}.`)
    commands.push(...glyph.getPath(pen, 0, MONOGRAM_SIZE).commands)
    pen += (glyph.advanceWidth / font.unitsPerEm) * MONOGRAM_SIZE + MONOGRAM_TRACKING
  }

  // Centre on the measured ink, not on the text baseline. 'S' and 'Y' are caps with no
  // descender, so the ink box runs cap-height to baseline and centring it is exactly right —
  // and it sidesteps dominant-baseline, which librsvg does not implement at all.
  const measured = new opentype.Path()
  measured.commands = commands
  const ink = measured.getBoundingBox()
  const dx = (MONOGRAM_BOX - (ink.x2 - ink.x1)) / 2 - ink.x1
  const dy = (MONOGRAM_BOX - (ink.y2 - ink.y1)) / 2 - ink.y1

  const centred = new opentype.Path()
  centred.commands = commands.map((command) => {
    const next = { ...command }
    for (const [ax, ay] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
      if (next[ax] !== undefined) next[ax] = Number((next[ax] + dx).toFixed(3))
      if (next[ay] !== undefined) next[ay] = Number((next[ay] + dy).toFixed(3))
    }
    return next
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MONOGRAM_BOX} ${MONOGRAM_BOX}" `
    + `width="${MONOGRAM_BOX}" height="${MONOGRAM_BOX}" role="img" aria-label="S · Y">\n`
    + `  <title>박성현 · 배예은</title>\n`
    + `  <rect width="${MONOGRAM_BOX}" height="${MONOGRAM_BOX}" rx="${MONOGRAM_RADIUS}" fill="${ICON_GROUND}"/>\n`
    + `  <path fill="${ICON_INK}" d="${centred.toPathData(3)}"/>\n`
    + `</svg>\n`
  await fs.writeFile(abs, svg)
  console.log(`${ICON_SVG}\n  ${MONOGRAM_TEXT} in Cormorant Garamond SemiBold, outlined — ${kb(svg.length)}`)
  return { before, after: svg.length }
}

// Named so a single asset can be rebuilt without re-encoding the photos, which is the slow
// part and produces a large diff for no reason when only the icon changed.
const steps = {
  photos: async () => {
    const out = []
    for (const p of photos) out.push(await optimizePhoto(p))
    return out
  },
  map: async () => [await optimizeMap()],
  preview: async () => [await buildPreview()],
  monogram: async () => [await buildMonogram()],
  icons: async () => [await buildIcons()],
}

// `monogram` is not in the default run: it is the only step that needs network, and the SVG
// it produces is committed, so it is worth running only when the mark itself changes.
const DEFAULT_STEPS = ['photos', 'map', 'preview', 'icons']

const requested = process.argv.slice(2)
const unknown = requested.filter((name) => !(name in steps))
if (unknown.length) {
  console.error(`Unknown step(s): ${unknown.join(', ')}. Available: ${Object.keys(steps).join(', ')}`)
  process.exit(1)
}

const results = []
for (const name of requested.length ? requested : DEFAULT_STEPS) {
  results.push(...await steps[name]())
}

const before = results.reduce((s, r) => s + r.before, 0)
const after = results.reduce((s, r) => s + r.after, 0)
console.log(`\nTOTAL  ${(before / 1024 / 1024).toFixed(1)} MB  ->  ${(after / 1024 / 1024).toFixed(2)} MB`)
console.log(`Originals preserved in img-originals/ (gitignored).`)
