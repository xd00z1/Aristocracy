#!/usr/bin/env node
/**
 * Resolve and download public-domain images from Wikimedia Commons for every
 * item that declares `media.image.commons`. Run locally (the build sandbox
 * cannot reach Commons):
 *
 *   npm run media            # download what is missing
 *   npm run media -- --dry   # report without downloading
 *   npm run media -- --force # re-download everything
 *
 * Only files whose Commons licence reads as public domain or CC0 are saved.
 * Everything else is reported and skipped; fix the item or pick another file.
 * Credits are written to public/media/credits.json. Re-run `npm run content`
 * afterwards so the media index picks the files up.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ITEMS_DIR = join(ROOT, 'content', 'items')
const OUT_DIR = join(ROOT, 'public', 'media', 'img')
const CREDITS = join(ROOT, 'public', 'media', 'credits.json')
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'Aristocracy-content-fetcher/0.1 (https://github.com/xd00z1/Aristocracy)'
const WIDTH = 1400

const args = new Set(process.argv.slice(2))
const dry = args.has('--dry')
const force = args.has('--force')

function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.ya?ml$/.test(name)) out.push(p)
  }
  return out.sort()
}

const items = walk(ITEMS_DIR).flatMap((f) => parse(readFileSync(f, 'utf8'))?.items ?? [])
const wanted = items.filter((i) => i.media?.image?.commons)
console.log(`${wanted.length} items declare a Commons image`)

const OK_LICENSE = /public domain|cc0|pd-|no restrictions/i
const credits = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, 'utf8')) : {}
mkdirSync(OUT_DIR, { recursive: true })

let saved = 0, skipped = 0, failed = 0
for (const item of wanted) {
  const title = item.media.image.commons.startsWith('File:') ? item.media.image.commons : `File:${item.media.image.commons}`
  const file = item.media.image.file ?? `${item.id}.jpg`
  const dest = join(OUT_DIR, file)
  if (existsSync(dest) && !force) {
    skipped++
    continue
  }
  const url = `${API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=${WIDTH}&format=json&redirects=1`
  let info
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const json = await res.json()
    const page = Object.values(json.query?.pages ?? {})[0]
    info = page?.imageinfo?.[0]
    if (!info) {
      console.log(`MISSING  ${item.id}: ${title} not found on Commons`)
      failed++
      continue
    }
  } catch (err) {
    console.log(`ERROR    ${item.id}: ${err.message}`)
    failed++
    continue
  }
  const meta = info.extmetadata ?? {}
  const license = meta.LicenseShortName?.value ?? meta.License?.value ?? ''
  const artist = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim()
  const credit = (meta.Credit?.value ?? '').replace(/<[^>]+>/g, '').trim()
  if (!OK_LICENSE.test(license)) {
    console.log(`LICENSE  ${item.id}: "${license}" is not public domain / CC0; skipped (${title})`)
    failed++
    continue
  }
  if (dry) {
    console.log(`OK(dry)  ${item.id}: ${license} — ${info.thumburl ?? info.url}`)
    continue
  }
  try {
    const src = info.thumburl ?? info.url
    const res = await fetch(src, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(dest, buf)
    credits[item.id] = { file, commons: title, license, artist, credit, descriptionUrl: info.descriptionurl, width: info.thumbwidth ?? info.width, height: info.thumbheight ?? info.height }
    console.log(`SAVED    ${item.id}: ${file} (${license})`)
    saved++
  } catch (err) {
    console.log(`ERROR    ${item.id}: download failed: ${err.message}`)
    failed++
  }
  await new Promise((r) => setTimeout(r, 250))
}
if (!dry) writeFileSync(CREDITS, JSON.stringify(credits, null, 2))
console.log(`\nsaved ${saved}, already present ${skipped}, failed or skipped ${failed}. Now run: npm run content`)
