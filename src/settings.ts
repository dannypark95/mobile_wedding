import mainPhoto from '../img/main/IMG_0368.jpg'
import invitationPhoto from '../img/main/invitation.jpg'
import endingPhoto from '../img/main/send_off.JPG'

import p01 from '../img/gallery/IMG_0079.jpg'
import p02 from '../img/gallery/IMG_0515.jpg'
import p03 from '../img/gallery/P20260530_175906740_DSCF3166.JPG'

export const albumPhotos = [p01, p02, p03]

export const SETTINGS_DOC_PATH = 'wedding/settings'
export const FIREBASE_PROJECT_ID = 'mobile-wedding-web-ad664'

// Guests read the settings document straight off the Firestore REST endpoint (the doc is
// world-readable). Doing it with fetch instead of the Firestore SDK keeps ~180 KB gzipped of
// Firebase out of the bundle every guest downloads; the SDK now ships only in the admin chunk.
export const SETTINGS_REST_URL =
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${SETTINGS_DOC_PATH}`

export type InfoBlock = {
  title: string
  body: string
}

export type AccountEntry = {
  role: string
  name: string
  bank: string
  number: string
}

export type WeddingSettings = {
  mainPhoto: string
  mainNames: string
  mainDateText: string
  mainLocationText: string
  mainNameSize: number
  mainDetailSize: number
  mainTextY: number
  mainCropZoom: number
  mainCropX: number
  mainCropY: number
  invitationPhoto: string
  invitationCropZoom: number
  invitationCropX: number
  invitationCropY: number
  invitationLabel: string
  invitationHeading: string
  invitationBody: string
  invitationGroomLine: string
  invitationBrideLine: string
  galleryPhotos: string[]
  galleryLabel: string
  locationLabel: string
  locationHeading: string
  locationAddress: string
  // Drives the naver/kakao/tmap deep links, so moving the venue moves the buttons with it
  // instead of leaving three links pointing at the old hall.
  locationQuery: string
  infoLabel: string
  infoHeading: string
  infoBlocks: InfoBlock[]
  thanksLabel: string
  thanksHeading: string
  thanksBody: string
  groomAccountLabel: string
  groomAccounts: AccountEntry[]
  brideAccountLabel: string
  brideAccounts: AccountEntry[]
  endingPhoto: string
  endingCropZoom: number
  endingCropX: number
  endingCropY: number
  endingOverlayOpacity: number
  endingText: string
  endingTextSize: number
  endingTextTop: number
  endingTextFont: string
}

export type NumericSettingKey = {
  [K in keyof WeddingSettings]: WeddingSettings[K] extends number ? K : never
}[keyof WeddingSettings]

export type PhotoSettingKey = 'mainPhoto' | 'invitationPhoto' | 'endingPhoto'

export const PHOTO_KEYS: PhotoSettingKey[] = ['mainPhoto', 'invitationPhoto', 'endingPhoto']

export const defaultSettings: WeddingSettings = {
  mainPhoto,
  mainNames: '박성현 · 배예은',
  mainDateText: '2026년 10월 24일 토요일 오후 2시 30분',
  mainLocationText: '부산 센텀호텔 4F 벨라홀',
  mainNameSize: 18,
  mainDetailSize: 13,
  mainTextY: 0,
  mainCropZoom: 100,
  mainCropX: 50,
  mainCropY: 50,
  invitationPhoto,
  invitationCropZoom: 100,
  invitationCropX: 50,
  invitationCropY: 50,
  invitationLabel: 'INVITATION',
  invitationHeading: '초대합니다.',
  invitationBody: '서로가 마주 보며 다져온 사랑을\n이제 함께 한곳을 바라보며 걸어갈 수 있는\n큰 사랑으로 키우고자 합니다.\n저희가 지켜나갈 수 있게\n앞날을 축복해 주시면 감사하겠습니다.',
  invitationGroomLine: '박 영 준 의 아들  박 성 현',
  invitationBrideLine: '김 미 경 의 딸  배 예 은',
  galleryPhotos: albumPhotos,
  galleryLabel: 'GALLERY',
  locationLabel: 'LOCATION',
  locationHeading: '오시는 길',
  locationAddress: '부산광역시 해운대구 센텀5로 26\n부산 센텀호텔 4F 벨라홀',
  locationQuery: '부산 센텀호텔웨딩홀',
  infoLabel: 'INFORMATION',
  infoHeading: '오시는 길 안내',
  infoBlocks: [
    {
      title: '대중교통',
      body: '지하철 2호선 센텀시티역 하차 후 도보 이동 가능합니다.\n버스 이용 시 센텀시티 또는 벡스코 정류장을 이용해 주세요.',
    },
    {
      title: '주차 안내',
      body: '예식장 건물 내 주차장을 이용하실 수 있습니다.\n주차권 또는 무료 주차 시간 안내는 추후 확정 후 업데이트하겠습니다.',
    },
  ],
  thanksLabel: 'THANKS TO',
  thanksHeading: '마음 전하실 곳',
  thanksBody: '참석이 어려운 분들을 위해 계좌번호를 기재했습니다.\n따뜻한 마음으로 양해 부탁드립니다.',
  groomAccountLabel: '신랑측 계좌번호',
  groomAccounts: [
    { role: '신랑', name: '박성현', bank: '국민은행', number: '433401-01-469146' },
    { role: '혼주', name: '박영준', bank: '은행명', number: '0000-00-0000000' },
  ],
  brideAccountLabel: '신부측 계좌번호',
  brideAccounts: [
    { role: '신부', name: '배예은', bank: '토스뱅크', number: '0000-00-0000000' },
    { role: '혼주', name: '김미경', bank: '은행명', number: '0000-00-0000000' },
  ],
  endingPhoto,
  endingCropZoom: 100,
  endingCropX: 50,
  endingCropY: 50,
  endingOverlayOpacity: 35,
  endingText: '감사합니다.',
  endingTextSize: 16,
  endingTextTop: 50,
  endingTextFont: 'serif',
}

// A photo is only safe to persist if it lives somewhere independent of this build. Bundled
// photos are emitted by Vite as content-hashed paths (/assets/IMG_0368-ATcl4nQq.jpg), and the
// hash changes whenever the file is re-encoded — as does the leading path when `base` changes.
// A stored copy of such a path goes stale and 404s, and because the remote doc is spread over
// the defaults, a stale path silently wins and the photo disappears. Storage downloads
// (https://) and pasted URLs are stable, so only those are trusted.
export function isPersistablePhoto(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function resolvePhoto(remote: unknown, fallback: string) {
  return isPersistablePhoto(remote) ? remote : fallback
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/**
 * Rebuild a list of rows the admin edits (info blocks, accounts) from whatever Firestore
 * returned. A missing field means the couple has never touched that list, so the bundled
 * default stands in; an empty array means they deleted every row on purpose and must be
 * honoured, or a deleted account would keep coming back on the next load.
 */
function resolveRows<T>(remote: unknown, fallback: T[], row: (source: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(remote)) return fallback
  return remote
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map(row)
}

const toInfoBlock = (source: Record<string, unknown>): InfoBlock => ({
  title: text(source.title),
  body: text(source.body),
})

const toAccount = (source: Record<string, unknown>): AccountEntry => ({
  role: text(source.role),
  name: text(source.name),
  bank: text(source.bank),
  number: text(source.number),
})

/** Merge a settings document from Firestore over the bundled defaults, dropping stale photo paths. */
export function mergeSettings(remote: Partial<WeddingSettings>): WeddingSettings {
  const galleryPhotos = (remote.galleryPhotos ?? []).filter(isPersistablePhoto)
  return {
    ...defaultSettings,
    ...remote,
    mainPhoto: resolvePhoto(remote.mainPhoto, defaultSettings.mainPhoto),
    invitationPhoto: resolvePhoto(remote.invitationPhoto, defaultSettings.invitationPhoto),
    endingPhoto: resolvePhoto(remote.endingPhoto, defaultSettings.endingPhoto),
    galleryPhotos: galleryPhotos.length ? galleryPhotos : defaultSettings.galleryPhotos,
    infoBlocks: resolveRows(remote.infoBlocks, defaultSettings.infoBlocks, toInfoBlock),
    groomAccounts: resolveRows(remote.groomAccounts, defaultSettings.groomAccounts, toAccount),
    brideAccounts: resolveRows(remote.brideAccounts, defaultSettings.brideAccounts, toAccount),
  }
}

/**
 * Strip build-local photo paths before writing to Firestore. An empty string means "the photo
 * was never replaced — use whatever this build bundles", which mergeSettings resolves on read.
 */
export function settingsForSave(settings: WeddingSettings) {
  const payload: Record<string, unknown> = { ...settings }
  for (const key of PHOTO_KEYS) {
    payload[key] = isPersistablePhoto(settings[key]) ? settings[key] : ''
  }
  payload.galleryPhotos = settings.galleryPhotos.filter(isPersistablePhoto)
  return payload
}

const SETTINGS_CACHE_KEY = 'wedding-settings-cache'

/**
 * The last settings document this browser saw. The page renders from the bundled defaults on
 * the very first frame, and every photo the couple has uploaded through /admin lives at a URL
 * those defaults know nothing about — so without a cache every visit paints the bundled photo,
 * then swaps it for the uploaded one a few hundred milliseconds later. Reading the previous
 * answer synchronously means a returning guest paints the real photo immediately (and hits it
 * warm in the HTTP cache), and the fetch below just confirms it.
 */
export function loadCachedSettings(): WeddingSettings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY)
    if (!raw) return null
    return mergeSettings(JSON.parse(raw) as Partial<WeddingSettings>)
  } catch {
    // Private mode, a quota error, or a half-written entry. The defaults still render.
    return null
  }
}

export function cacheSettings(settings: WeddingSettings) {
  try {
    // settingsForSave, not the raw object: it blanks build-local photo paths, which go stale
    // the moment the site is rebuilt. mergeSettings resolves those blanks back on read.
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settingsForSave(settings)))
  } catch {
    // A cache miss next time is not worth breaking the page over.
  }
}

/**
 * Resolve once the image is in the browser's cache, so swapping an `<img src>` to it paints in
 * a single frame instead of blanking the slot for the length of the download. Never rejects —
 * a photo we cannot preload should still be handed to the browser to try — and gives up after
 * `timeoutMs` so a stalled download cannot hold the page hostage.
 */
export function preloadImage(src: string, timeoutMs = 4000) {
  return new Promise<void>((resolve) => {
    if (!src) {
      resolve()
      return
    }
    const image = new Image()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    image.onload = finish
    image.onerror = finish
    image.src = src
    if (image.complete) finish()
  })
}

export function cropStyle(zoom: number, x: number, y: number) {
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${zoom / 100})`,
    transformOrigin: `${x}% ${y}%`,
  }
}

type FirestoreValue = {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  arrayValue?: { values?: FirestoreValue[] }
  mapValue?: { fields?: Record<string, FirestoreValue> }
}

function decodeFields(fields: Record<string, FirestoreValue>) {
  const decoded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    const entry = decodeValue(value)
    if (entry !== undefined) decoded[key] = entry
  }
  return decoded
}

function decodeValue(value: FirestoreValue): unknown {
  if (value.stringValue !== undefined) return value.stringValue
  if (value.integerValue !== undefined) return Number(value.integerValue)
  if (value.doubleValue !== undefined) return Number(value.doubleValue)
  if (value.booleanValue !== undefined) return value.booleanValue
  if (value.arrayValue !== undefined) return (value.arrayValue.values ?? []).map((entry) => decodeValue(entry))
  // Account rows and info blocks are arrays of objects, which arrive as arrayValue-of-mapValue.
  if (value.mapValue !== undefined) return decodeFields(value.mapValue.fields ?? {})
  return undefined
}

/** Fetch the settings document over REST, already merged over the defaults. */
export async function fetchSettings(signal?: AbortSignal): Promise<WeddingSettings> {
  const response = await fetch(SETTINGS_REST_URL, { signal })
  if (!response.ok) throw new Error(`Firestore responded ${response.status}`)
  const doc = await response.json() as { fields?: Record<string, FirestoreValue> }
  return mergeSettings(decodeFields(doc.fields ?? {}) as Partial<WeddingSettings>)
}
