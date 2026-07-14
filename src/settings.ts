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
}

function decodeValue(value: FirestoreValue): unknown {
  if (value.stringValue !== undefined) return value.stringValue
  if (value.integerValue !== undefined) return Number(value.integerValue)
  if (value.doubleValue !== undefined) return Number(value.doubleValue)
  if (value.booleanValue !== undefined) return value.booleanValue
  if (value.arrayValue !== undefined) return (value.arrayValue.values ?? []).map(decodeValue)
  return undefined
}

/** Fetch the settings document over REST, already merged over the defaults. */
export async function fetchSettings(signal?: AbortSignal): Promise<WeddingSettings> {
  const response = await fetch(SETTINGS_REST_URL, { signal })
  if (!response.ok) throw new Error(`Firestore responded ${response.status}`)
  const doc = await response.json() as { fields?: Record<string, FirestoreValue> }
  const remote: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc.fields ?? {})) {
    const decoded = decodeValue(value)
    if (decoded !== undefined) remote[key] = decoded
  }
  return mergeSettings(remote as Partial<WeddingSettings>)
}
