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
// Run: node scripts/optimize-assets.mjs

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

const results = []
for (const p of photos) results.push(await optimizePhoto(p))
results.push(await optimizeMap())
results.push(await buildPreview())

const before = results.reduce((s, r) => s + r.before, 0)
const after = results.reduce((s, r) => s + r.after, 0)
console.log(`\nTOTAL  ${(before / 1024 / 1024).toFixed(1)} MB  ->  ${(after / 1024 / 1024).toFixed(2)} MB`)
console.log(`Originals preserved in img-originals/ (gitignored).`)
