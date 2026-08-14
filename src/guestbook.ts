import { FIREBASE_PROJECT_ID } from './settings'

/**
 * The 방명록 talks to Firestore over REST for the same reason the settings document does: the
 * Firebase SDK is ~180 KB gzipped and lives only in the admin chunk, and pulling it back into
 * the guest bundle to write three fields would undo that. Every call here is plain fetch.
 */
const DOCUMENTS = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`
const COLLECTION = 'guestbook'

export const GUESTBOOK_NAME_MAX = 20
export const GUESTBOOK_MESSAGE_MAX = 100
export const GUESTBOOK_PASSWORD_MAX = 10
/** How many entries the page shows before 더 보기. */
export const GUESTBOOK_PAGE_SIZE = 3

export type GuestbookEntry = {
  id: string
  name: string
  message: string
  passwordHash: string
  /**
   * The first version of the 방명록 stored the delete password exactly as typed, under
   * `password`. Those four messages are real and still on the page, so an entry can carry
   * either shape and matchesPassword accepts both.
   */
  legacyPassword: string
  createdAt: string
}

/**
 * Guests have no account, so the password they set is the only thing that says an entry is
 * theirs — it is what the ⋯ menu checks before letting anyone edit or delete.
 *
 * It is stored as a digest rather than as typed because the entry document has to be
 * world-readable for the book to be readable at all: storing it plainly published it to anyone
 * who opened the REST endpoint, and people reuse passwords. The check still happens on the
 * client, so this stops a guest editing someone else's message, not someone determined enough
 * to call the API directly.
 */
export async function hashPassword(password: string): Promise<string> {
  const text = password.trim()
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(`sunghyun-yeeun-guestbook:${text}`)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // crypto.subtle exists only in a secure context, which http://<LAN-IP>:5173 is not — so this
  // keeps the 방명록 usable when testing on a real phone over the LAN. Production is https.
  let hash = 0
  for (let index = 0; index < text.length; index += 1) hash = (Math.imul(hash, 31) + text.charCodeAt(index)) | 0
  return `insecure-${(hash >>> 0).toString(16)}`
}

/** True if `password` unlocks this entry, in either the current or the original storage shape. */
export async function matchesPassword(entry: GuestbookEntry, password: string): Promise<boolean> {
  if (entry.passwordHash) return await hashPassword(password) === entry.passwordHash
  return entry.legacyPassword !== '' && password.trim() === entry.legacyPassword
}

type RestValue = { stringValue?: string, timestampValue?: string }
type RestDocument = {
  name?: string
  fields?: Record<string, RestValue>
}

function toEntry(document: RestDocument): GuestbookEntry | null {
  // `name` is the full resource path; the id is its last segment.
  const id = document.name?.split('/').pop()
  if (!id) return null
  const fields = document.fields ?? {}
  return {
    id,
    name: fields.name?.stringValue ?? '',
    // `content` is what the first version of the 방명록 called this field.
    message: fields.message?.stringValue ?? fields.content?.stringValue ?? '',
    passwordHash: fields.passwordHash?.stringValue ?? '',
    legacyPassword: fields.password?.stringValue ?? '',
    createdAt: fields.createdAt?.timestampValue ?? fields.createdAt?.stringValue ?? '',
  }
}

/** The couple edit and delete without a password; their ID token stands in for one. */
function authHeaders(idToken?: string) {
  return idToken ? { Authorization: `Bearer ${idToken}` } : undefined
}

export async function fetchGuestbook(signal?: AbortSignal): Promise<GuestbookEntry[]> {
  // Ordering here rather than in the client keeps it right across the 더 보기 boundary.
  const url = `${DOCUMENTS}/${COLLECTION}?pageSize=300&orderBy=${encodeURIComponent('createdAt desc')}`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Firestore responded ${response.status}`)
  const body = await response.json() as { documents?: RestDocument[] }
  // An empty collection comes back as {} rather than an empty array.
  return (body.documents ?? []).map(toEntry).filter((entry): entry is GuestbookEntry => entry !== null)
}

export async function addGuestbookEntry(input: {
  name: string
  message: string
  password: string
}): Promise<GuestbookEntry> {
  const passwordHash = await hashPassword(input.password)
  const response = await fetch(`${DOCUMENTS}/${COLLECTION}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        name: { stringValue: input.name.trim() },
        message: { stringValue: input.message.trim() },
        passwordHash: { stringValue: passwordHash },
        // A timestamp, not a string, to match the entries already in the collection. Firestore
        // orders by type before value, so a string here would have sorted every new entry below
        // every old one no matter what date it carried.
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  })
  if (!response.ok) throw new Error(`Firestore responded ${response.status}`)
  const created = toEntry(await response.json() as RestDocument)
  if (!created) throw new Error('Firestore returned a document with no name.')
  return created
}

export async function updateGuestbookEntry(
  id: string,
  input: { name: string, message: string },
  idToken?: string,
): Promise<void> {
  // An update mask, so only these two fields are touched: a PATCH without one replaces the
  // whole document, which would drop passwordHash and createdAt and leave the entry unowned
  // and undated. It is also what lets the rules require passwordHash to be unchanged.
  const mask = 'updateMask.fieldPaths=name&updateMask.fieldPaths=message'
  const response = await fetch(`${DOCUMENTS}/${COLLECTION}/${encodeURIComponent(id)}?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(idToken) },
    body: JSON.stringify({
      fields: {
        name: { stringValue: input.name.trim() },
        message: { stringValue: input.message.trim() },
      },
    }),
  })
  if (!response.ok) throw new Error(`Firestore responded ${response.status}`)
}

export async function deleteGuestbookEntry(id: string, idToken?: string): Promise<void> {
  const response = await fetch(`${DOCUMENTS}/${COLLECTION}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  })
  if (!response.ok) throw new Error(`Firestore responded ${response.status}`)
}

/** '2026년 8월 15일' — the entry list wants a date, not a timestamp. */
export function formatEntryDate(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}
