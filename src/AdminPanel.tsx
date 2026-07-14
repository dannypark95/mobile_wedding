import { useState, useCallback, useRef, type ChangeEvent, type Dispatch, type PointerEvent, type SetStateAction } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

import { auth, db, storage } from './firebase'
import {
  cropStyle,
  settingsForSave,
  SETTINGS_DOC_PATH,
  type NumericSettingKey,
  type WeddingSettings,
} from './settings'

const ADMIN_ID = 'admin'
const ADMIN_EMAIL = 'admin@mobile-wedding.local'
const IMAGE_ACCEPT = 'image/*,.heic,.heif'

type CropEditorState = {
  title: string
  photo: string
  zoomKey: NumericSettingKey
  xKey: NumericSettingKey
  yKey: NumericSettingKey
}

type AdminSectionKey = 'main' | 'invitation' | 'gallery' | 'ending'

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
    normalizeImageFile(file).then((imageBlob) => {
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
          <img src={editor.photo} alt={`${editor.title} 크롭 미리보기`} style={cropStyle(zoom, x, y)} />
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

export default function AdminPanel({
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
        ...settingsForSave(settings),
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
            style={cropStyle(settings.endingCropZoom, settings.endingCropX, settings.endingCropY)}
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
