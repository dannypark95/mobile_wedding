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
  /** Render expanded with no toggle — for the short blocks every guest needs anyway. */
  alwaysOpen: boolean
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
  /**
   * A TMAP share link (tmap.life/…) pinned to the exact venue. TMAP's web search resolves
   * 부산 센텀호텔웨딩홀 poorly, so this overrides the query URL when set; blank falls back
   * to searching locationQuery like the other two apps.
   */
  locationTmapUrl: string
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
  // The blank line is load-bearing: Paragraphs splits on it so the verse and the message
  // reveal separately as the guest scrolls.
  invitationBody: '내가 너희를 사랑한 것 같이\n너희도 서로 사랑하라\n(요한복음 13:34)\n\n서로가 마주 보며 다져온 사랑을\n이제 함께 한 곳을 바라보며 걸어갈 수 있는\n큰 사랑으로 키우고자 합니다.\n저희가 이 고백을 평생 지켜나갈 수 있도록\n앞날을 축복해 주세요.',
  invitationGroomLine: '박 영 준 의 아들  박 성 현',
  invitationBrideLine: '김 미 경 의 딸  배 예 은',
  galleryPhotos: albumPhotos,
  galleryLabel: 'GALLERY',
  locationLabel: 'LOCATION',
  locationHeading: '오시는 길',
  locationAddress: '부산광역시 해운대구 센텀3로 20\n부산 센텀호텔 4F 벨라홀',
  locationQuery: '부산 센텀호텔웨딩홀',
  locationTmapUrl: 'https://tmap.life/773b2dac',
  infoLabel: 'INFORMATION',
  infoHeading: '오시는 길 안내',
  // Each block is one tap-to-open route. Within a body, `#` opens a sub-heading and `※`
  // marks a footnote — see InfoBody in App.tsx.
  infoBlocks: [
    {
      title: '🚇 지하철',
      body: '부산 지하철 2호선 센텀시티역 하차\n3번 출구에서 도보 1분 (약 100m)',
      alwaysOpen: false,
    },
    {
      title: '🚌 시내버스',
      body: '# 센텀시티역·벡스코 정류장 하차 (도보 1~2분)\n일반버스: 5-1, 39, 40, 63, 107, 115, 139, 141, 155, 181\n급행버스: 1001, 1002, 1006\n\n# 벡스코 정류장 하차 (도보 3~4분)\n일반버스: 307',
      alwaysOpen: false,
    },
    {
      title: '🚄 부산역(KTX/SRT)에서 오시는 길',
      body: '# 지하철 이용 시\n[1호선] 부산역 승차 ➔ 서면역에서 [2호선(장산 방향)] 환승 ➔ 센텀시티역 하차 (3번 출구)\n\n# 버스 이용 시\n부산역 광장 앞 정류장에서 1001번(급행) 또는 40번, 5-1번(일반) 탑승 ➔ 센텀시티역·벡스코 정류장 하차 (도보 2분)',
      alwaysOpen: false,
    },
    {
      title: '✈️ 김해공항에서 오시는 길',
      body: '※ 기존 공항리무진 운행 중단으로 대체 급행버스 운행\n\n# 급행버스 이용 시 (2029번)\n승차: 김해공항 1층 (국제선/국내선 2번 승차장)에서 2029번 탑승\n하차: 벡스코 정류장 하차 (도보 3분)\n\n# 시내버스 이용 시 (307번)\n승차: 김해공항 1층 승차장에서 307번 탑승\n하차: 벡스코 정류장 하차 (도보 3분)\n\n# 지하철 이용 시\n[부산김해경전철] 공항역 승차 ➔ 사상역에서 [2호선(장산 방향)] 환승 ➔ 센텀시티역 하차 (3번 출구)',
      alwaysOpen: false,
    },
    {
      title: '🅿️ 주차 안내',
      body: '본건물 지하주차장(B2~B5층) 이용 시 2시간 무료\n\n※ 예식 당일 주차장이 혼잡할 수 있으니 가급적 대중교통 이용을 부탁드립니다.',
      alwaysOpen: false,
    },
  ],
  thanksLabel: 'THANKS TO',
  thanksHeading: '마음 전하실 곳',
  thanksBody: '참석이 어려운 분들을 위해 계좌번호를 기재했습니다.\n따뜻한 마음으로 양해 부탁드립니다.',
  groomAccountLabel: '신랑측 계좌번호',
  groomAccounts: [
    { role: '신랑', name: '박성현', bank: '국민은행', number: '433401-01-469146' },
    { role: '혼주', name: '박영준', bank: '농협', number: '356-1519-1790-93' },
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
  // Absent on every block saved before this field existed, which should read as "collapsed"
  // rather than crash or default to open.
  alwaysOpen: source.alwaysOpen === true,
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
