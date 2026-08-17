import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
  uploadBytes,
} from 'firebase/storage'

import { auth, storage } from './firebase'

const ADMIN_ID = 'admin'
const ADMIN_EMAIL = 'admin@mobile-wedding.local'
/**
 * Outside wedding/ on purpose, not merely in its own subfolder. Everything under wedding/ is
 * world-readable so guests can see the invitation, and Storage rules OR together — a stricter
 * rule nested under it would simply be overruled. A separate top-level path can be locked to
 * the admin account on its own terms. See storage.rules.
 */
const VIDEO_FOLDER = 'video-source'
const IMAGE_ACCEPT = 'image/*,.heic,.heif'

type VideoPhoto = {
  path: string
  name: string
  url: string
  size: number
  uploadedAt: string
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function isHeicFile(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

/**
 * Unlike the invitation's uploader, this one does not resize. That one caps photos at 1800px
 * and re-encodes at quality 0.82, which is right for a picture viewed on a phone and wrong for
 * one that has to survive an edit — a 1080p timeline already wants 1920px, and 4K wants 3840.
 * Everything here is uploaded at whatever resolution it arrived at.
 *
 * The one exception is HEIC, which is what an iPhone shoots by default and which most editing
 * software still handles badly. Those are converted to JPEG at quality 0.95 — full size, no
 * downscale. Anything else goes up byte for byte, untouched.
 */
async function prepareFile(file: File): Promise<{ blob: Blob, name: string, contentType: string }> {
  if (!isHeicFile(file)) {
    return { blob: file, name: file.name, contentType: file.type || 'application/octet-stream' }
  }
  const heic2any = (await import('heic2any')).default
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 })
  const blob = Array.isArray(converted) ? converted[0] : converted
  return {
    blob,
    name: file.name.replace(/\.(heic|heif)$/i, '.jpg'),
    contentType: 'image/jpeg',
  }
}

/** Everything currently in the folder, newest first. Pure — it touches no React state. */
async function listVideoPhotos(): Promise<VideoPhoto[]> {
  const listing = await listAll(ref(storage, VIDEO_FOLDER))
  const entries = await Promise.all(listing.items.map(async (item) => {
    const [metadata, url] = await Promise.all([getMetadata(item), getDownloadURL(item)])
    return {
      path: item.fullPath,
      // The stored name is prefixed with an upload timestamp to keep it unique; the person
      // looking at the grid wants the name their phone gave it.
      name: item.name.replace(/^\d+-/, ''),
      url,
      size: metadata.size ?? 0,
      uploadedAt: metadata.timeCreated ?? '',
    }
  }))
  entries.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  return entries
}

export default function VideoPage() {
  const isAdminAccount = (user: { email: string | null } | null) => user?.email === ADMIN_EMAIL
  const [authed, setAuthed] = useState(() => isAdminAccount(auth.currentUser))
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [adminId, setAdminId] = useState(ADMIN_ID)
  const [password, setPassword] = useState('')

  const [photos, setPhotos] = useState<VideoPhoto[]>([])
  // Starts true and is only ever cleared once the first listing lands. Flipping it on inside
  // the effect instead would be a synchronous setState in an effect body — a cascading render,
  // and the thing react-hooks/set-state-in-effect exists to catch.
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number, total: number } | null>(null)

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setAuthed(isAdminAccount(user))
    // Until Firebase has restored the session there is no answer yet, and rendering the login
    // form in the meantime flashes it at someone who is already signed in.
    setCheckingAuth(false)
  }), [])

  useEffect(() => {
    if (!authed) return
    let cancelled = false
    // State is set in the promise callback rather than in the effect body: listVideoPhotos is
    // pure, so nothing here re-renders synchronously on mount.
    listVideoPhotos()
      .then((entries) => { if (!cancelled) setPhotos(entries) })
      .catch(() => { if (!cancelled) setStatus('사진 목록을 불러오지 못했어요. 새로고침 해주세요.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [authed])

  /** Re-read the folder after an upload or a delete. */
  const loadPhotos = useCallback(async () => {
    try {
      setPhotos(await listVideoPhotos())
    } catch {
      setStatus('사진 목록을 불러오지 못했어요. 새로고침 해주세요.')
    }
  }, [])

  const addPhotos = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setStatus(null)
    setProgress({ done: 0, total: files.length })
    let failed = 0
    // One at a time on purpose. These are full-size originals over a phone's uplink, and firing
    // thirty of them at once is how you get stalls and half-finished uploads — sequential is
    // slower to watch and far likelier to finish.
    for (let index = 0; index < files.length; index += 1) {
      try {
        const prepared = await prepareFile(files[index])
        const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        await uploadBytes(ref(storage, `${VIDEO_FOLDER}/${Date.now()}-${safeName}`), prepared.blob, {
          contentType: prepared.contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        })
      } catch {
        failed += 1
      }
      setProgress({ done: index + 1, total: files.length })
    }
    setProgress(null)
    setStatus(failed
      ? `${files.length - failed}장을 올렸어요. ${failed}장은 실패했으니 다시 시도해주세요.`
      : `${files.length}장을 올렸어요.`)
    await loadPhotos()
  }, [loadPhotos])

  const removePhoto = useCallback(async (photo: VideoPhoto) => {
    if (!window.confirm(`${photo.name}을(를) 삭제할까요?`)) return
    try {
      await deleteObject(ref(storage, photo.path))
      setPhotos((current) => current.filter((candidate) => candidate.path !== photo.path))
      setStatus('사진을 삭제했어요.')
    } catch {
      setStatus('삭제에 실패했어요. 잠시 후 다시 시도해주세요.')
    }
  }, [])

  const copyAllLinks = useCallback(async () => {
    const text = photos.map((photo) => photo.url).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setStatus(`링크 ${photos.length}개를 복사했어요.`)
    } catch {
      setStatus('링크 복사에 실패했어요.')
    }
  }, [photos])

  const signIn = useCallback(async () => {
    if (adminId.trim() !== ADMIN_ID) {
      setStatus('아이디를 확인해주세요.')
      return
    }
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password)
      // onAuthStateChanged flips `authed`; setting it here too would race it.
    } catch {
      setStatus('아이디 또는 비밀번호가 맞지 않습니다.')
    }
  }, [adminId, password])

  const totalBytes = photos.reduce((sum, photo) => sum + photo.size, 0)

  if (checkingAuth) {
    return (
      <div className="video-page">
        <aside className="admin-panel admin-login video-panel"><h2>불러오는 중…</h2></aside>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="video-page">
      <aside className="admin-panel admin-login video-panel">
        <h2>영상용 사진 올리기</h2>
        <p className="admin-helper">청첩장 관리자 아이디와 비밀번호로 로그인해주세요.</p>
        <div className="admin-row">
          <input
            type="text"
            className="admin-input"
            placeholder="아이디"
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
          />
          <input
            type="password"
            className="admin-input"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') signIn() }}
          />
          <button type="button" className="admin-primary" onClick={signIn}>
            로그인
          </button>
        </div>
        {status && <p className="admin-note video-status">{status}</p>}
      </aside>
      </div>
    )
  }

  return (
    <div className="video-page">
      <aside className="admin-panel video-panel">
        <div className="admin-head">
          <div>
            <span className="admin-kicker">본식 영상</span>
            <h2>영상용 사진</h2>
          </div>
          <button
            type="button"
            className="admin-ghost"
            onClick={async () => { await signOut(auth); setPassword('') }}
          >
            로그아웃
          </button>
        </div>

        <p className="admin-helper">
          영상에 넣을 사진을 여기에 올려주세요. 청첩장에는 절대 올라가지 않고, 성현이만 따로 받아서 편집합니다.
          사진은 <strong>원본 그대로</strong> 저장되니 크기를 줄이지 말고 올려주세요. 아이폰 HEIC 사진은
          자동으로 JPG로 바뀝니다.
        </p>

        <label className="admin-file video-file">
          <input type="file" accept={IMAGE_ACCEPT} multiple onChange={addPhotos} disabled={progress !== null} />
          {progress ? `올리는 중… ${progress.done} / ${progress.total}` : '+ 사진 선택하기'}
        </label>

        {status && <p className="admin-note video-status">{status}</p>}

        <div className="video-summary">
          <span>{loading ? '불러오는 중…' : `사진 ${photos.length}장`}</span>
          {photos.length > 0 && <span>{formatSize(totalBytes)}</span>}
        </div>

        {photos.length > 0 && (
          <button type="button" className="admin-secondary" onClick={copyAllLinks}>
            링크 전체 복사 (성현이 전달용)
          </button>
        )}

        <div className="video-grid">
          {!loading && photos.length === 0 && (
            <p className="admin-note">아직 올린 사진이 없어요.</p>
          )}
          {photos.map((photo) => (
            <figure className="video-item" key={photo.path}>
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img src={photo.url} alt={photo.name} loading="lazy" decoding="async" />
              </a>
              <button
                type="button"
                className="video-remove"
                aria-label={`${photo.name} 삭제`}
                onClick={() => removePhoto(photo)}
              >
                ×
              </button>
              <figcaption>
                <strong>{photo.name}</strong>
                <span>{formatSize(photo.size)} · {formatWhen(photo.uploadedAt)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </aside>
    </div>
  )
}
