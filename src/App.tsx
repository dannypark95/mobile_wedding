import { useEffect, useState, useCallback, useRef, type ChangeEvent, type Dispatch, type PointerEvent, type SetStateAction } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import mainPhoto from '../img/main/IMG_0368.jpg'
import secondPhoto from '../img/main/invitation.jpg'
import endingPhoto from '../img/main/send_off.JPG'
import mapImage from '../img/main/map.png'
import kakaoMapLogo from '../img/logo/kakao_map.png'
import naverMapLogo from '../img/logo/naver_map.png'
import tmapLogo from '../img/logo/tmap_map.png'
import bgMusic from '../music/참_아름다워라.mp3'

import p01 from '../img/gallery/IMG_0079.jpg'
import p02 from '../img/gallery/IMG_0515.jpg'
import p03 from '../img/gallery/P20260530_175906740_DSCF3166.JPG'

import './App.css'
import { auth, db, storage } from './firebase'

const albumPhotos = [p01, p02, p03]
const ADMIN_ID = 'admin'
const ADMIN_EMAIL = 'admin@mobile-wedding.local'
const SETTINGS_DOC_PATH = 'wedding/settings'
const IMAGE_ACCEPT = 'image/*,.heic,.heif'

type WeddingSettings = {
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

type NumericSettingKey = {
  [K in keyof WeddingSettings]: WeddingSettings[K] extends number ? K : never
}[keyof WeddingSettings]

type CropEditorState = {
  title: string
  photo: string
  zoomKey: NumericSettingKey
  xKey: NumericSettingKey
  yKey: NumericSettingKey
  brightness?: number
}

type AdminSectionKey = 'main' | 'invitation' | 'gallery' | 'ending'

const defaultSettings: WeddingSettings = {
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
  invitationPhoto: secondPhoto,
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
function loadSettings() {
  return defaultSettings
}

function isHeicFile(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

async function normalizeImageFile(file: File) {
  if (!isHeicFile(file)) return file
  const heic2any = (await import('heic2any')).default
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  })
  return Array.isArray(converted) ? converted[0] : converted
}

function resizeImage(file: File, maxSize = 1800, quality = 0.82) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image()
    const source = normalizeImageFile(file)
    source.then((imageBlob) => {
    const url = URL.createObjectURL(imageBlob)
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas is not available.'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) {
          reject(new Error('Unable to process image.'))
          return
        }
        resolve(blob)
      }, 'image/jpeg', quality)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to load image.'))
    }
    image.src = url
    }).catch(reject)
  })
}

async function uploadImageFile(file: File, folder: string) {
  const blob = await resizeImage(file)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.(heic|heif)$/i, '.jpg')
  const imageRef = ref(storage, `wedding/${folder}/${Date.now()}-${safeName}`)
  await uploadBytes(imageRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(imageRef)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function cropStyle(zoom: number, x: number, y: number) {
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${zoom / 100})`,
    transformOrigin: `${x}% ${y}%`,
  }
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function clampZoom(value: number) {
  return Math.min(180, Math.max(100, value))
}

function CropEditor({
  editor,
  settings,
  onCancel,
  onDone,
}: {
  editor: CropEditorState
  settings: WeddingSettings
  onCancel: () => void
  onDone: (patch: Partial<WeddingSettings>) => void
}) {
  const [zoom, setZoom] = useState(Number(settings[editor.zoomKey]))
  const [x, setX] = useState(Number(settings[editor.xKey]))
  const [y, setY] = useState(Number(settings[editor.yKey]))
  const dragRef = useRef<{
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  } | null>(null)

  const startDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: x,
      startY: y,
    }
  }, [x, y])

  const moveDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setX(clampPercent(drag.startX - (event.clientX - drag.startClientX) / 2))
    setY(clampPercent(drag.startY - (event.clientY - drag.startClientY) / 2))
  }, [])

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={`${editor.title} 크롭 조정`}>
      <div className="crop-editor-top">
        <button type="button" onClick={onCancel}>취소</button>
        <strong>{editor.title}</strong>
        <button type="button" className="crop-editor-done" onClick={() => onDone({
          [editor.zoomKey]: zoom,
          [editor.xKey]: x,
          [editor.yKey]: y,
        } as Partial<WeddingSettings>)}>
          완료
        </button>
      </div>

      <div className="crop-editor-stage">
        <div
          className="crop-editor-frame"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            src={editor.photo}
            alt={`${editor.title} 크롭 미리보기`}
            style={{
              ...cropStyle(zoom, x, y),
            }}
          />
        </div>
      </div>

      <div className="crop-editor-bottom">
        <span className="crop-editor-chip">CROP</span>
        <div className="crop-editor-zoom">
          <button type="button" onClick={() => setZoom((current) => clampZoom(current - 5))} aria-label="사진 축소">-</button>
          <span>{zoom}%</span>
          <button type="button" onClick={() => setZoom((current) => clampZoom(current + 5))} aria-label="사진 확대">+</button>
        </div>
        <p>사진을 드래그해서 위치를 맞춰주세요.</p>
      </div>
    </div>
  )
}

function AdminPanel({
  settings,
  setSettings,
  showToast,
}: {
  settings: WeddingSettings
  setSettings: Dispatch<SetStateAction<WeddingSettings>>
  showToast: (msg: string) => void
}) {
  const [adminId, setAdminId] = useState(ADMIN_ID)
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('mobileWeddingAdminAuthed') === '1')
  const [draggingGalleryIndex, setDraggingGalleryIndex] = useState<number | null>(null)
  const [galleryDropIndex, setGalleryDropIndex] = useState<number | null>(null)
  const [cropEditor, setCropEditor] = useState<CropEditorState | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSectionKey>('main')
  const galleryListRef = useRef<HTMLDivElement>(null)
  const galleryPointerDragRef = useRef<{ index: number, pointerId: number } | null>(null)
  const galleryDropIndexRef = useRef<number | null>(null)

  const update = useCallback((patch: Partial<WeddingSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [setSettings])

  const uploadSingle = useCallback(async (event: ChangeEvent<HTMLInputElement>, key: 'mainPhoto' | 'invitationPhoto' | 'endingPhoto') => {
    const file = event.target.files?.[0]
    if (!file) return
    const label = key === 'mainPhoto' ? '메인 사진' : key === 'invitationPhoto' ? '초대글 사진' : '마지막 사진'
    try {
      const url = await uploadImageFile(file, key)
      update({ [key]: url })
      showToast(`${label}을 업로드했어요. 저장 버튼을 눌러 반영해주세요.`)
      event.target.value = ''
    } catch {
      showToast(`${label} 업로드에 실패했어요. Firebase 로그인과 Storage 권한을 확인해주세요.`)
    }
  }, [showToast, update])

  const addGalleryPhotos = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    try {
      const photos = await Promise.all(files.map((file) => uploadImageFile(file, 'gallery')))
      update({ galleryPhotos: [...settings.galleryPhotos, ...photos] })
      showToast(`갤러리에 사진 ${photos.length}장을 업로드했어요. 저장 버튼을 눌러 반영해주세요.`)
      event.target.value = ''
    } catch {
      showToast('갤러리 업로드에 실패했어요. Firebase 로그인과 Storage 권한을 확인해주세요.')
    }
  }, [settings.galleryPhotos, showToast, update])

  const updateGalleryDropIndexAt = useCallback((clientY: number) => {
    const container = galleryListRef.current
    if (!container) return
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-gallery-index]'))
    if (!items.length) {
      galleryDropIndexRef.current = 0
      setGalleryDropIndex(0)
      return
    }

    let nextIndex = items.length
    for (const item of items) {
      const rect = item.getBoundingClientRect()
      const index = Number(item.dataset.galleryIndex)
      if (clientY < rect.top + rect.height / 2) {
        nextIndex = Number.isInteger(index) ? index : nextIndex
        break
      }
    }
    galleryDropIndexRef.current = nextIndex
    setGalleryDropIndex(nextIndex)
  }, [])
  const moveGalleryPhoto = useCallback((index: number, nextIndex: number) => {
    if (index === nextIndex || nextIndex < 0 || nextIndex > settings.galleryPhotos.length) return
    const photos = [...settings.galleryPhotos]
    const [photo] = photos.splice(index, 1)
    const adjustedIndex = index < nextIndex ? nextIndex - 1 : nextIndex
    if (index === adjustedIndex) return
    photos.splice(adjustedIndex, 0, photo)
    update({ galleryPhotos: photos })
    showToast('갤러리 순서를 바꿨어요. 저장 버튼을 눌러 반영해주세요.')
  }, [settings.galleryPhotos, showToast, update])

  const removeGalleryPhoto = useCallback((index: number) => {
    const confirmed = window.confirm(`갤러리 사진 ${index + 1}번을 삭제할까요?`)
    if (!confirmed) return
    update({ galleryPhotos: settings.galleryPhotos.filter((_, i) => i !== index) })
    showToast('갤러리 사진을 삭제했어요. 저장 버튼을 눌러 반영해주세요.')
  }, [settings.galleryPhotos, showToast, update])

  const finishGalleryPointerDrag = useCallback(() => {
    const drag = galleryPointerDragRef.current
    const nextIndex = galleryDropIndexRef.current
    if (drag && nextIndex !== null) {
      moveGalleryPhoto(drag.index, nextIndex)
    }
    galleryPointerDragRef.current = null
    galleryDropIndexRef.current = null
    setDraggingGalleryIndex(null)
    setGalleryDropIndex(null)
  }, [moveGalleryPhoto])
  const saveSection = useCallback(async (label: string) => {
    try {
      await setDoc(doc(db, SETTINGS_DOC_PATH), {
        ...settings,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      showToast(`${label} 변경사항을 저장했어요.`)
    } catch {
      showToast('저장에 실패했어요. Firebase 로그인과 Firestore 권한을 확인해주세요.')
    }
  }, [settings, showToast])

  if (!authed) {
    return (
      <aside className="admin-panel admin-login" id="admin-editor">
        <h2>관리자 로그인</h2>
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
          />
          <button
            type="button"
            className="admin-primary"
            onClick={async () => {
              if (adminId.trim() !== ADMIN_ID) {
                showToast('아이디를 확인해주세요.')
                return
              }
              try {
                await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password)
                sessionStorage.setItem('mobileWeddingAdminAuthed', '1')
                setAuthed(true)
                showToast('관리자 모드로 들어왔어요. 음악은 자동으로 꺼져 있어요.')
              } catch {
                showToast('아이디 또는 비밀번호가 맞지 않습니다.')
              }
            }}
          >
            로그인
          </button>
        </div>
      </aside>
    )
  }

  return (
    <>
      {cropEditor && (
        <CropEditor
          editor={cropEditor}
          settings={settings}
          onCancel={() => setCropEditor(null)}
          onDone={(patch) => {
            update(patch)
            setCropEditor(null)
            showToast('사진 크롭을 적용했어요.')
          }}
        />
      )}
      <aside className="admin-panel" id="admin-editor">
      <div className="admin-head">
        <div>
          <span className="admin-kicker">관리자</span>
          <h2>청첩장 편집</h2>
        </div>
        <button
          type="button"
          className="admin-ghost"
          onClick={async () => {
            await signOut(auth)
            sessionStorage.removeItem('mobileWeddingAdminAuthed')
            setAuthed(false)
            setPassword('')
            showToast('로그아웃했어요.')
          }}
        >
          로그아웃
        </button>
      </div>
      <div className="admin-section-tabs" aria-label="편집 섹션 선택">
        <button type="button" className={activeSection === 'main' ? 'is-active' : ''} onClick={() => setActiveSection('main')}>메인</button>
        <button type="button" className={activeSection === 'invitation' ? 'is-active' : ''} onClick={() => setActiveSection('invitation')}>초대글</button>
        <button type="button" className={activeSection === 'gallery' ? 'is-active' : ''} onClick={() => setActiveSection('gallery')}>갤러리</button>
        <button type="button" className={activeSection === 'ending' ? 'is-active' : ''} onClick={() => setActiveSection('ending')}>마지막</button>
      </div>
      <p className="admin-helper">
        각 섹션에서 수정한 뒤 해당 섹션의 저장 버튼을 눌러주세요. 저장 전에는 현재 화면의 미리보기에서만 확인됩니다.
      </p>

      {activeSection === 'main' && <section className="admin-section">
        <h3>메인 사진</h3>
        <div className="admin-real-preview admin-real-main">
          <div className="hero-photo">
            <div className="hero-top hero-date-overlay">
              <span className="hero-date-full">2026 / 10 / 24</span>
              <span className="hero-day">SATURDAY</span>
            </div>
            <img
              src={settings.mainPhoto}
              alt="메인 사진 미리보기"
              style={cropStyle(settings.mainCropZoom, settings.mainCropX, settings.mainCropY)}
            />
            <div className="hero-photo-gradient" />
          </div>
          <div className="hero-bottom" style={{ transform: `translateY(${settings.mainTextY}px)` }}>
            <div className="hero-names" style={{ fontSize: settings.mainNameSize }}>{settings.mainNames}</div>
            <div className="hero-detail" style={{ fontSize: settings.mainDetailSize }}>
              <div>{settings.mainDateText}</div>
              <div>{settings.mainLocationText}</div>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="admin-crop-launch"
          onClick={() => setCropEditor({
            title: '메인 사진',
            photo: settings.mainPhoto,
            zoomKey: 'mainCropZoom',
            xKey: 'mainCropX',
            yKey: 'mainCropY',
          })}
        >
          크롭 조정
        </button>
        <label className="admin-file">
          <input type="file" accept={IMAGE_ACCEPT} onChange={(event) => uploadSingle(event, 'mainPhoto')} />
          메인 사진 변경
        </label>
        <label>이름 문구 <input className="admin-input" value={settings.mainNames} onChange={(event) => update({ mainNames: event.target.value })} /></label>
        <label>날짜 문구 <input className="admin-input" value={settings.mainDateText} onChange={(event) => update({ mainDateText: event.target.value })} /></label>
        <label>장소 문구 <input className="admin-input" value={settings.mainLocationText} onChange={(event) => update({ mainLocationText: event.target.value })} /></label>
        <label>이름 글자 크기 <input type="range" min="12" max="34" value={settings.mainNameSize} onChange={(event) => update({ mainNameSize: Number(event.target.value) })} /></label>
        <label>날짜/장소 글자 크기 <input type="range" min="10" max="24" value={settings.mainDetailSize} onChange={(event) => update({ mainDetailSize: Number(event.target.value) })} /></label>
        <label>문구 위치 <input type="range" min="-80" max="80" value={settings.mainTextY} onChange={(event) => update({ mainTextY: Number(event.target.value) })} /></label>
        <button type="button" className="admin-section-save" onClick={() => saveSection('메인 사진')}>메인 사진 변경사항 저장</button>
      </section>}

      {activeSection === 'invitation' && <section className="admin-section">
        <h3>초대글</h3>
        <div className="admin-mini-preview admin-mini-photo admin-mobile-crop">
          <img
            src={settings.invitationPhoto}
            alt="초대글 사진 미리보기"
            style={cropStyle(settings.invitationCropZoom, settings.invitationCropX, settings.invitationCropY)}
          />
        </div>
        <button
          type="button"
          className="admin-crop-launch"
          onClick={() => setCropEditor({
            title: '초대글 사진',
            photo: settings.invitationPhoto,
            zoomKey: 'invitationCropZoom',
            xKey: 'invitationCropX',
            yKey: 'invitationCropY',
          })}
        >
          크롭 조정
        </button>
        <label className="admin-file">
          <input type="file" accept={IMAGE_ACCEPT} onChange={(event) => uploadSingle(event, 'invitationPhoto')} />
          초대글 사진 변경
        </label>
        <label>라벨 <input className="admin-input" value={settings.invitationLabel} onChange={(event) => update({ invitationLabel: event.target.value })} /></label>
        <label>제목 <input className="admin-input" value={settings.invitationHeading} onChange={(event) => update({ invitationHeading: event.target.value })} /></label>
        <label>초대글 본문 <textarea className="admin-input admin-textarea" value={settings.invitationBody} onChange={(event) => update({ invitationBody: event.target.value })} /></label>
        <label>신랑 소개 <input className="admin-input" value={settings.invitationGroomLine} onChange={(event) => update({ invitationGroomLine: event.target.value })} /></label>
        <label>신부 소개 <input className="admin-input" value={settings.invitationBrideLine} onChange={(event) => update({ invitationBrideLine: event.target.value })} /></label>
        <button type="button" className="admin-section-save" onClick={() => saveSection('초대글')}>초대글 변경사항 저장</button>
      </section>}

      {activeSection === 'gallery' && <section className="admin-section">
        <h3>갤러리</h3>
        <label>라벨 <input className="admin-input" value={settings.galleryLabel} onChange={(event) => update({ galleryLabel: event.target.value })} /></label>
        <label className="admin-file">
          <input type="file" accept={IMAGE_ACCEPT} multiple onChange={addGalleryPhotos} />
          갤러리 사진 추가
        </label>
        <div className="admin-gallery-preview" aria-label="갤러리 미리보기">
          {settings.galleryPhotos.map((photo, index) => (
            <img src={photo} alt={`갤러리 미리보기 ${index + 1}`} key={`${photo}-preview-${index}`} />
          ))}
        </div>
        <div className="admin-gallery-sort" ref={galleryListRef}>
          {galleryDropIndex === 0 && <div className="admin-gallery-drop-line" />}
          {settings.galleryPhotos.map((photo, index) => (
            <div key={`${photo.slice(0, 30)}-${index}`} data-gallery-index={index}>
              <div
                className={[
                  'admin-gallery-row',
                  draggingGalleryIndex === index ? 'admin-gallery-row-dragging' : '',
                ].filter(Boolean).join(' ')}
              >
                <img src={photo} alt={`Gallery ${index + 1}`} />
                <div className="admin-gallery-row-copy">
                  <strong>{index + 1}번째 사진</strong>
                  <span>오른쪽 핸들을 잡고 위아래로 이동</span>
                </div>
                <button
                  type="button"
                  className="admin-gallery-remove"
                  aria-label={`갤러리 사진 ${index + 1} 삭제`}
                  onClick={() => removeGalleryPhoto(index)}
                >
                  ×
                </button>
                <button
                  type="button"
                  className="admin-gallery-handle"
                  aria-label={`갤러리 사진 ${index + 1} 순서 변경`}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    galleryPointerDragRef.current = { index, pointerId: event.pointerId }
                    galleryDropIndexRef.current = index
                    setDraggingGalleryIndex(index)
                    setGalleryDropIndex(index)
                  }}
                  onPointerMove={(event) => {
                    const drag = galleryPointerDragRef.current
                    if (!drag || drag.pointerId !== event.pointerId) return
                    event.preventDefault()
                    updateGalleryDropIndexAt(event.clientY)
                  }}
                  onPointerUp={(event) => {
                    const drag = galleryPointerDragRef.current
                    if (!drag || drag.pointerId !== event.pointerId) return
                    event.preventDefault()
                    finishGalleryPointerDrag()
                  }}
                  onPointerCancel={(event) => {
                    const drag = galleryPointerDragRef.current
                    if (!drag || drag.pointerId !== event.pointerId) return
                    galleryPointerDragRef.current = null
                    galleryDropIndexRef.current = null
                    setDraggingGalleryIndex(null)
                    setGalleryDropIndex(null)
                  }}
                >
                  |||
                </button>
              </div>
              {galleryDropIndex === index + 1 && <div className="admin-gallery-drop-line" />}
            </div>
          ))}
        </div>
        <button type="button" className="admin-section-save" onClick={() => saveSection('갤러리')}>갤러리 변경사항 저장</button>
      </section>}
      {activeSection === 'ending' && <section className="admin-section">
        <h3>마지막 사진</h3>
        <div className="admin-mini-preview admin-mini-ending admin-mobile-crop">
          <img
            src={settings.endingPhoto}
            alt="마지막 사진 미리보기"
            style={{
              ...cropStyle(settings.endingCropZoom, settings.endingCropX, settings.endingCropY),
            }}
          />
          <div className="admin-mini-ending-overlay" style={{ background: `rgba(0, 0, 0, ${settings.endingOverlayOpacity / 100})` }} />
          <p
            className={`ending-font-${settings.endingTextFont}`}
            style={{
              top: `${settings.endingTextTop}%`,
              fontSize: Math.max(10, settings.endingTextSize * 0.72),
            }}
          >
            {settings.endingText}
          </p>
        </div>
        <button
          type="button"
          className="admin-crop-launch"
          onClick={() => setCropEditor({
            title: '마지막 사진',
            photo: settings.endingPhoto,
            zoomKey: 'endingCropZoom',
            xKey: 'endingCropX',
            yKey: 'endingCropY',
          })}
        >
          크롭 조정
        </button>
        <label className="admin-file">
          <input type="file" accept={IMAGE_ACCEPT} onChange={(event) => uploadSingle(event, 'endingPhoto')} />
          마지막 사진 변경
        </label>
        <label>텍스트 배경 어둡게 <input type="range" min="0" max="80" value={settings.endingOverlayOpacity} onChange={(event) => update({ endingOverlayOpacity: Number(event.target.value) })} /></label>
        <label>문구 <input className="admin-input" value={settings.endingText} onChange={(event) => update({ endingText: event.target.value })} /></label>
        <label>문구 크기 <input type="range" min="12" max="36" value={settings.endingTextSize} onChange={(event) => update({ endingTextSize: Number(event.target.value) })} /></label>
        <label>문구 위치 <input type="range" min="10" max="90" value={settings.endingTextTop} onChange={(event) => update({ endingTextTop: Number(event.target.value) })} /></label>
        <label>글꼴
          <select className="admin-input" value={settings.endingTextFont} onChange={(event) => update({ endingTextFont: event.target.value })}>
            <option value="serif">명조</option>
            <option value="sans">고딕</option>
            <option value="script">손글씨</option>
          </select>
        </label>
        <button type="button" className="admin-section-save" onClick={() => saveSection('마지막 사진')}>마지막 사진 변경사항 저장</button>
      </section>}
      </aside>
    </>
  )
}

function App() {
  const [settings, setSettings] = useState<WeddingSettings>(loadSettings)
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0 })
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const isAdminView = window.location.pathname.replace(/\/$/, '').endsWith('/admin')
  const [groomOpen, setGroomOpen] = useState(false)
  const [brideOpen, setBrideOpen] = useState(false)

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, SETTINGS_DOC_PATH), (snapshot) => {
      if (!snapshot.exists()) return
      const remoteSettings = snapshot.data() as Partial<WeddingSettings>
      setSettings({
        ...defaultSettings,
        ...remoteSettings,
        galleryPhotos: remoteSettings.galleryPhotos?.length ? remoteSettings.galleryPhotos : defaultSettings.galleryPhotos,
      })
    }, () => {
      showToast('Firebase 설정을 불러오지 못했어요. 기본 사진으로 표시합니다.')
    })
    return unsubscribe
  }, [showToast])

  const audioRef = useRef<HTMLAudioElement>(null)
  const [musicPlaying, setMusicPlaying] = useState(!isAdminView)

  const [rsvpOpen, setRsvpOpen] = useState(false)
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false)
  const [rsvpData, setRsvpData] = useState({
    attendance: '참석',
    side: '신랑측',
    name: '',
    phone: '',
    extraGuests: 0,
    companionNames: '',
    meal: '예정',
    message: '',
  })

  useEffect(() => {
    if (isAdminView) {
      audioRef.current?.pause()
      return
    }
    const tryPlay = () => {
      const audio = audioRef.current
      if (!audio) return
      audio.play().then(() => {
        setMusicPlaying(true)
        document.removeEventListener('click', tryPlay)
        document.removeEventListener('touchstart', tryPlay)
        document.removeEventListener('scroll', tryPlay)
      }).catch(() => {})
    }
    document.addEventListener('click', tryPlay, { once: false })
    document.addEventListener('touchstart', tryPlay, { once: false })
    document.addEventListener('scroll', tryPlay, { once: false })
    tryPlay()
    return () => {
      document.removeEventListener('click', tryPlay)
      document.removeEventListener('touchstart', tryPlay)
      document.removeEventListener('scroll', tryPlay)
    }
  }, [isAdminView])

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (musicPlaying) {
      audio.pause()
      setMusicPlaying(false)
    } else {
      audio.play().then(() => setMusicPlaying(true)).catch(() => {})
    }
  }, [musicPlaying])

  const copyAccount = useCallback((accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber).then(() => {
      showToast('계좌번호가 복사되었습니다.')
    }).catch(() => {
      showToast('복사에 실패했습니다. 계좌번호를 직접 확인해 주세요.')
    })
  }, [showToast])

  useEffect(() => {
    const target = new Date('2026-10-24T14:30:00+09:00').getTime()
    const tick = () => {
      const diff = Math.max(target - Date.now(), 0)
      setCd({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff / 3600000) % 24),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.fade-up')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible')
        })
      },
      { threshold: 0.1 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (lightbox !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [lightbox])

  useEffect(() => {
    if (rsvpOpen) {
      document.body.style.overflow = 'hidden'
    } else if (lightbox === null) {
      document.body.style.overflow = ''
    }
  }, [rsvpOpen, lightbox])

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzu-ccO4ds4ZWwuuIivtUpb6Xvw7XJtWoa-9TJ1PJodnaM5Z97X2XmwrxKAN__F0Fbt/exec'

  const openRsvp = useCallback(() => {
    setRsvpData({
      attendance: '참석', side: '신랑측', name: '', phone: '',
      extraGuests: 0, companionNames: '', meal: '예정', message: '',
    })
    setRsvpOpen(true)
  }, [])

  const handleRsvpSubmit = useCallback(async () => {
    if (!rsvpData.name.trim()) {
      showToast('성함을 입력해 주세요.')
      return
    }
    setRsvpSubmitting(true)
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance: rsvpData.attendance,
          side: rsvpData.side,
          name: rsvpData.name.trim(),
          phone: rsvpData.phone.trim(),
          extraGuests: rsvpData.extraGuests,
          companionNames: rsvpData.companionNames.trim(),
          meal: rsvpData.meal,
          message: rsvpData.message.trim(),
          timestamp: new Date().toISOString(),
        }),
      })
      showToast('참석 여부가 전달되었습니다. 감사합니다.')
      setRsvpOpen(false)
    } catch {
      showToast('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
    setRsvpSubmitting(false)
  }, [rsvpData, APPS_SCRIPT_URL, showToast])

  const galleryPhotos = settings.galleryPhotos
  const activeLightbox = lightbox !== null && lightbox < galleryPhotos.length ? lightbox : null

  const closeLightbox = useCallback(() => setLightbox(null), [])
  const prevSlide = useCallback(() => {
    setLightbox((prev) => (prev !== null && galleryPhotos.length ? (prev - 1 + galleryPhotos.length) % galleryPhotos.length : null))
  }, [galleryPhotos.length])
  const nextSlide = useCallback(() => {
    setLightbox((prev) => (prev !== null && galleryPhotos.length ? (prev + 1) % galleryPhotos.length : null))
  }, [galleryPhotos.length])

  return (
    <div className={`app-root ${isAdminView ? 'app-root-admin' : ''}`}>
      {isAdminView && (
        <AdminPanel settings={settings} setSettings={setSettings} showToast={showToast} />
      )}
      <audio ref={audioRef} src={bgMusic} loop preload="auto" />
      <div className={isAdminView ? 'admin-preview-shell' : undefined} id="admin-preview">
        {isAdminView && <div className="admin-preview-label">모바일 미리보기</div>}
        <main className="invitation">

        <button
          type="button"
          className={`music-btn ${musicPlaying ? 'music-playing' : ''}`}
          onClick={toggleMusic}
          aria-label={musicPlaying ? '음악 끄기' : '음악 켜기'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {musicPlaying ? (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            ) : (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            )}
          </svg>
        </button>

        {/* Hero / Save the Date */}
        <section className="hero">
          <div className="hero-photo fade-up">
            <div className="hero-top hero-date-overlay">
              <span className="hero-date-full">2026 / 10 / 24</span>
              <span className="hero-day">SATURDAY</span>
            </div>
            <img
              src={settings.mainPhoto}
              alt="성현과 예은"
              style={cropStyle(settings.mainCropZoom, settings.mainCropX, settings.mainCropY)}
            />
            <div className="hero-photo-gradient" />
          </div>
          <div className="hero-bottom fade-up" style={{ transform: `translateY(${settings.mainTextY}px)` }}>
            <div className="hero-names" style={{ fontSize: settings.mainNameSize }}>{settings.mainNames}</div>
            <div className="hero-detail" style={{ fontSize: settings.mainDetailSize }}>
              {settings.mainDateText}
              <br />
              {settings.mainLocationText}
            </div>
          </div>
        </section>

        {/* Invitation */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">{settings.invitationLabel}</div>
            <div className="section-heading">{settings.invitationHeading}</div>
          </div>
          <div className="section-body fade-up">
            {settings.invitationBody.split('\n').map((line, index, lines) => (
              <span key={`${line}-${index}`}>
                {line}
                {index < lines.length - 1 && <br />}
              </span>
            ))}
          </div>
          <div className="invite-photo fade-up">
            <img
              src={settings.invitationPhoto}
              alt="성현과 예은"
              style={cropStyle(settings.invitationCropZoom, settings.invitationCropX, settings.invitationCropY)}
            />
          </div>
          <div className="invite-names fade-up">
            <div className="honju-line">{settings.invitationGroomLine}</div>
            <div className="honju-line">{settings.invitationBrideLine}</div>
          </div>
        </section>

        {/* Wedding Date */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">WEDDING DATE</div>
            <div className="calendar-date-text">2026년 10월 24일 토요일 오후 2시 30분</div>
          </div>
          <table className="calendar-grid fade-up" aria-label="2026년 10월 달력">
            <thead>
              <tr>
                <th>일</th>
                <th>월</th>
                <th>화</th>
                <th>수</th>
                <th>목</th>
                <th>금</th>
                <th>토</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="is-empty">.</td>
                <td className="is-empty">.</td>
                <td className="is-empty">.</td>
                <td className="is-empty">.</td>
                <td>1</td>
                <td>2</td>
                <td>3</td>
              </tr>
              <tr>
                <td className="is-sun">4</td>
                <td>5</td>
                <td>6</td>
                <td>7</td>
                <td>8</td>
                <td>9</td>
                <td>10</td>
              </tr>
              <tr>
                <td className="is-sun">11</td>
                <td>12</td>
                <td>13</td>
                <td>14</td>
                <td>15</td>
                <td>16</td>
                <td>17</td>
              </tr>
              <tr>
                <td className="is-sun">18</td>
                <td>19</td>
                <td>20</td>
                <td>21</td>
                <td>22</td>
                <td>23</td>
                <td className="is-active">24</td>
              </tr>
              <tr>
                <td className="is-sun">25</td>
                <td>26</td>
                <td>27</td>
                <td>28</td>
                <td>29</td>
                <td>30</td>
                <td>31</td>
              </tr>
            </tbody>
          </table>
          <div className="countdown-bar fade-up">
            <div className="cd-unit"><span className="cd-label">DAYS</span><span className="cd-num">{cd.d}</span></div>
            <span className="cd-colon">:</span>
            <div className="cd-unit"><span className="cd-label">HOUR</span><span className="cd-num">{pad(cd.h)}</span></div>
            <span className="cd-colon">:</span>
            <div className="cd-unit"><span className="cd-label">MIN</span><span className="cd-num">{pad(cd.m)}</span></div>
            <span className="cd-colon">:</span>
            <div className="cd-unit"><span className="cd-label">SEC</span><span className="cd-num">{pad(cd.s)}</span></div>
          </div>
        </section>

        {/* Gallery */}
        <section className="section-wrap gallery-section">
          <div className="fade-up">
            <div className="section-label">{settings.galleryLabel}</div>
          </div>
          <div className="gallery-strip fade-up">
            {galleryPhotos.map((src, i) => (
              <button
                type="button"
                className="gallery-slide"
                key={i}
                aria-label={`사진 ${i + 1}`}
                onClick={() => setLightbox(i)}
              >
                <img src={src} alt={`사진 ${i + 1}`} />
              </button>
            ))}
          </div>
        </section>

        {/* Location */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">LOCATION</div>
            <div className="section-heading">오시는 길</div>
          </div>
          <div className="location-addr fade-up">
            부산광역시 해운대구 센텀5로 26
            <br />
            부산 센텀호텔 4F 벨라홀
          </div>
          <div className="map-img-wrap fade-up">
            <img src={mapImage} alt="센텀호텔 약도" />
          </div>
          <div className="map-buttons fade-up">
            <button type="button" className="map-btn map-btn-naver" onClick={() => window.open('https://map.naver.com/p/search/%EB%B6%80%EC%82%B0%20%EC%84%BC%ED%85%80%ED%98%B8%ED%85%94%EC%9B%A8%EB%94%A9%ED%99%80', '_blank')}>
              <img className="map-app-icon" src={naverMapLogo} alt="네이버 지도 로고" />
              <span>네이버 지도</span>
            </button>
            <button type="button" className="map-btn map-btn-kakao" onClick={() => window.open('https://map.kakao.com/?q=%EB%B6%80%EC%82%B0%20%EC%84%BC%ED%85%80%ED%98%B8%ED%85%94%EC%9B%A8%EB%94%A9%ED%99%80', '_blank')}>
              <img className="map-app-icon" src={kakaoMapLogo} alt="카카오맵 로고" />
              <span>카카오맵</span>
            </button>
            <button type="button" className="map-btn map-btn-tmap" onClick={() => window.open('https://map.tmap.co.kr/search?query=%EB%B6%80%EC%82%B0%20%EC%84%BC%ED%85%80%ED%98%B8%ED%85%94%EC%9B%A8%EB%94%A9%ED%99%80', '_blank')}>
              <img className="map-app-icon" src={tmapLogo} alt="티맵 로고" />
              <span>티맵</span>
            </button>
          </div>
        </section>

        {/* Information */}
        <section className="section-wrap alt-bg">
          <div className="fade-up">
            <div className="section-label">INFORMATION</div>
            <div className="section-heading">오시는 길 안내</div>
          </div>
          <div className="info-body fade-up">
            <strong>대중교통</strong>
            <br />
            지하철 2호선 센텀시티역 하차 후 도보 이동 가능합니다.
            <br />
            버스 이용 시 센텀시티 또는 벡스코 정류장을 이용해 주세요.
            <br /><br />
            <strong>주차 안내</strong>
            <br />
            예식장 건물 내 주차장을 이용하실 수 있습니다.
            <br />
            주차권 또는 무료 주차 시간 안내는 추후 확정 후 업데이트하겠습니다.
          </div>
        </section>

        {/* Thanks To */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">THANKS TO</div>
            <div className="section-heading">마음 전하실 곳</div>
          </div>
          <div className="thanks-body fade-up">
            참석이 어려운 분들을 위해 계좌번호를 기재했습니다.
            <br />
            따뜻한 마음으로 양해 부탁드립니다.
          </div>
          <div className="acct-box fade-up">
            <button type="button" className="acct-btn" onClick={() => setGroomOpen((open) => !open)}>
              신랑측 계좌번호
              <svg className={`acct-arrow ${groomOpen ? 'acct-arrow-open' : ''}`} viewBox="0 0 24 24">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {groomOpen && (
              <div className="acct-panel">
                <div className="acct-row">
                  <div className="acct-info">
                    <span className="acct-label">신랑</span>
                    <span className="acct-name">박성현</span>
                  </div>
                  <div className="acct-detail">
                    <span className="acct-bank">은행명</span>
                    <span className="acct-number">0000-00-0000000</span>
                    <button type="button" className="copy-btn" onClick={() => copyAccount('0000-00-0000000')}>복사</button>
                  </div>
                </div>
                <div className="acct-row">
                  <div className="acct-info">
                    <span className="acct-label">혼주</span>
                    <span className="acct-name">박영준</span>
                  </div>
                  <div className="acct-detail">
                    <span className="acct-bank">은행명</span>
                    <span className="acct-number">0000-00-0000000</span>
                    <button type="button" className="copy-btn" onClick={() => copyAccount('0000-00-0000000')}>복사</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="acct-box fade-up">
            <button type="button" className="acct-btn" onClick={() => setBrideOpen((open) => !open)}>
              신부측 계좌번호
              <svg className={`acct-arrow ${brideOpen ? 'acct-arrow-open' : ''}`} viewBox="0 0 24 24">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {brideOpen && (
              <div className="acct-panel">
                <div className="acct-row">
                  <div className="acct-info">
                    <span className="acct-label">신부</span>
                    <span className="acct-name">배예은</span>
                  </div>
                  <div className="acct-detail">
                    <span className="acct-bank">은행명</span>
                    <span className="acct-number">0000-00-0000000</span>
                    <button type="button" className="copy-btn" onClick={() => copyAccount('0000-00-0000000')}>복사</button>
                  </div>
                </div>
                <div className="acct-row">
                  <div className="acct-info">
                    <span className="acct-label">혼주</span>
                    <span className="acct-name">김미경</span>
                  </div>
                  <div className="acct-detail">
                    <span className="acct-bank">은행명</span>
                    <span className="acct-number">0000-00-0000000</span>
                    <button type="button" className="copy-btn" onClick={() => copyAccount('0000-00-0000000')}>복사</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RSVP */}
        <section className="section-wrap alt-bg">
          <div className="fade-up">
            <div className="section-label">R/S/V/P</div>
            <div className="section-heading">참석 여부</div>
          </div>
          <hr className="rsvp-divider" />
          <div className="rsvp-body fade-up">
            참석 가능 여부를 알려주시면
            <br />
            감사한 마음으로 준비하겠습니다.
          </div>
          <div className="fade-up">
            <button type="button" className="rsvp-btn" onClick={openRsvp}>전달하기</button>
          </div>
        </section>

        {/* Ending Photo */}
        <section className="ending-photo">
          <img
            src={settings.endingPhoto}
            alt="성현과 예은"
            style={cropStyle(settings.endingCropZoom, settings.endingCropX, settings.endingCropY)}
          />
          <div className="ending-overlay" style={{ background: `rgba(0, 0, 0, ${settings.endingOverlayOpacity / 100})` }} />
          <div className="ending-text fade-up" style={{ top: `${settings.endingTextTop}%` }}>
            <p
              className={`ending-font-${settings.endingTextFont}`}
              style={{ fontSize: settings.endingTextSize }}
            >
              {settings.endingText}
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          Made with{' '}
          <a
            href="https://github.com/dannypark95/mobile_wedding"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-heart"
          >
            ♥
          </a>
        </footer>
        </main>
      </div>

      {/* RSVP Modal */}
      {rsvpOpen && (
        <div className="gb-overlay" onClick={() => setRsvpOpen(false)}>
          <div className="gb-modal rsvp-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="gb-modal-close" onClick={() => setRsvpOpen(false)}>&times;</button>
            <div className="gb-modal-body rsvp-body-modal">
              <ul className="gb-form">
                <li>
                  <p className="gb-form-label">성함<span className="rsvp-req">필수</span></p>
                  <input type="text" className="gb-input" placeholder="성함 입력" value={rsvpData.name} onChange={(e) => setRsvpData((d) => ({ ...d, name: e.target.value }))} />
                </li>
                <li>
                  <p className="gb-form-label">연락처</p>
                  <input type="text" className="gb-input" placeholder="연락처 입력" value={rsvpData.phone} onChange={(e) => setRsvpData((d) => ({ ...d, phone: e.target.value.replace(/[^0-9-]/g, '') }))} />
                </li>
                <li>
                  <p className="gb-form-label">전달사항</p>
                  <input type="text" className="gb-input" maxLength={25} placeholder="최대 25자" value={rsvpData.message} onChange={(e) => setRsvpData((d) => ({ ...d, message: e.target.value }))} />
                </li>
              </ul>
              <button type="button" className="gb-submit-btn" disabled={rsvpSubmitting} onClick={handleRsvpSubmit}>
                {rsvpSubmitting ? '전송 중...' : '제출하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox */}
      {activeLightbox !== null && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button type="button" className="lb-close" onClick={closeLightbox}>&times;</button>
          <div className="lb-main" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lb-arrow lb-prev" onClick={prevSlide}>&lsaquo;</button>
            <img
              className="lb-image"
              src={galleryPhotos[activeLightbox]}
              alt={`사진 ${activeLightbox + 1}`}
            />
            <button type="button" className="lb-arrow lb-next" onClick={nextSlide}>&rsaquo;</button>
          </div>
          <div className="lb-thumbs" onClick={(e) => e.stopPropagation()}>
            {galleryPhotos.map((src, i) => (
              <button
                type="button"
                key={i}
                className={`lb-thumb ${i === activeLightbox ? 'lb-thumb-active' : ''}`}
                onClick={() => setLightbox(i)}
              >
                <img src={src} alt={`썸네일 ${i + 1}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
