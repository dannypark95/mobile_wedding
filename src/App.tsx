import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import mapImage from '../img/main/map.png'
import kakaoMapLogo from '../img/logo/kakao_map.png'
import naverMapLogo from '../img/logo/naver_map.png'
import tmapLogo from '../img/logo/tmap_map.png'
import bgMusicAac from '../music/bgm.m4a'
import bgMusicMp3 from '../music/bgm.mp3'

import './App.css'
import {
  cacheSettings,
  cropStyle,
  defaultSettings,
  fetchSettings,
  loadCachedSettings,
  preloadImage,
  type AccountEntry,
  type WeddingSettings,
} from './settings'

// The admin panel pulls in the Firebase SDK (auth + firestore + storage). Loading it lazily
// keeps it out of the bundle guests download; only /admin ever pays for it.
const AdminPanel = lazy(() => import('./AdminPanel'))

// Read at import time, not inside the component: the first render has to already know which
// photo it is painting, and useState initialisers run twice under StrictMode.
const cachedSettings = loadCachedSettings()
const initialSettings = cachedSettings ?? defaultSettings

// How long the hero photo will wait for Firestore before falling back to whatever this build
// bundles. Long enough to cover a normal round trip, short enough that a guest on a dead
// network is not staring at an empty frame.
const HERO_SETTINGS_DEADLINE_MS = 1500

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * An 오시는 길 안내 body, which is a route rather than a paragraph: a handful of ways to get
 * here, each with its own steps and caveats. Two prefixes give the couple that structure from
 * the plain textarea in /admin without their having to learn anything resembling markup —
 * `#` opens a sub-heading (버스 이용 시), `※` or `*` marks a footnote. A line using neither
 * is an ordinary step, so existing copy keeps rendering exactly as it did.
 */
function InfoBody({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim()
        const key = `${trimmed}-${index}`
        if (!trimmed) return <div className="info-gap" key={key} />
        if (trimmed.startsWith('#')) {
          return <p className="info-sub" key={key}>{trimmed.replace(/^#\s*/, '')}</p>
        }
        if (/^[※*]/.test(trimmed)) {
          return <p className="info-note" key={key}>{trimmed}</p>
        }
        return <p className="info-line" key={key}>{trimmed}</p>
      })}
    </>
  )
}

/**
 * Split an admin-typed body on blank lines so each paragraph reveals on its own as the guest
 * scrolls, instead of the whole passage appearing at once. A body with no blank line yields a
 * single block, so copy written before this still renders exactly as it did.
 */
function Paragraphs({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)
  return (
    <>
      {blocks.map((block, index) => (
        <div className={`${className ?? ''} reveal-para fade-up`.trim()} key={`${index}-${block.slice(0, 12)}`}>
          <Multiline text={block} />
        </div>
      ))}
    </>
  )
}

/** Render an admin-editable string, honouring the line breaks they typed. */
function Multiline({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {line}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  )
}

function AccountRow({
  account,
  onCopy,
}: {
  account: AccountEntry
  onCopy: (accountNumber: string) => void
}) {
  return (
    <div className="acct-row">
      <div className="acct-info">
        <span className="acct-label">{account.role}</span>
        <span className="acct-name">{account.name}</span>
      </div>
      <div className="acct-detail">
        <span className="acct-bank">{account.bank}</span>
        <span className="acct-number">{account.number}</span>
        {/* A row with no number left to copy would hand the guest a button that copies "". */}
        {account.number && (
          <button type="button" className="copy-btn" onClick={() => onCopy(account.number)}>복사</button>
        )}
      </div>
    </div>
  )
}

function App() {
  const [settings, setSettings] = useState<WeddingSettings>(initialSettings)
  // With a cache we already know the real photo, so it can paint on the first frame. Without
  // one, hold it back rather than show the bundled photo and swap it out mid-look.
  const [heroReady, setHeroReady] = useState(cachedSettings !== null)
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0 })
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const isAdminView = window.location.pathname.replace(/\/$/, '').endsWith('/admin')
  const [groomOpen, setGroomOpen] = useState(false)
  const [brideOpen, setBrideOpen] = useState(false)
  // Keyed by index and independent, matching how the two 계좌번호 accordions already behave —
  // a guest checking the airport route should not have the subway route close under them.
  const [openInfo, setOpenInfo] = useState<Record<number, boolean>>({})

  // Keep in step with the toastOut delay in App.css — the CSS fades the toast out and this
  // timer unmounts it, so if the two drift the toast either pops away mid-fade or sits
  // invisible holding the tap target.
  const TOAST_MS = 1700

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const deadline = setTimeout(() => setHeroReady(true), HERO_SETTINGS_DEADLINE_MS)
    fetchSettings(controller.signal)
      .then(async (remote) => {
        if (!active) return
        // Committing a photo URL the browser has not downloaded yet empties the hero for the
        // length of that download — the flash the couple sees after every /admin upload. Wait
        // for the bytes, then swap in one frame. An unchanged photo skips the wait entirely,
        // which is the usual case once the cache above is warm.
        if (remote.mainPhoto !== initialSettings.mainPhoto) await preloadImage(remote.mainPhoto)
        if (!active) return
        setSettings(remote)
        cacheSettings(remote)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // The bundled defaults already render a complete invitation, so a failed fetch is not
        // worth a toast on the guest page — it would alarm people over nothing.
        console.warn('Falling back to bundled settings.', error)
      })
      .finally(() => {
        if (active) setHeroReady(true)
      })
    return () => {
      active = false
      clearTimeout(deadline)
      controller.abort()
    }
  }, [])

  const audioRef = useRef<HTMLAudioElement>(null)
  // Driven by the element's own play/pause events. Mobile blocks autoplay, so starting
  // this at `true` would pulse a "sound on" icon over a silent page.
  const [musicPlaying, setMusicPlaying] = useState(false)
  // A guest who taps mute has stated intent. The autoplay-unlock listener below runs on
  // the same tap (it is on `document`, above React's root), and without this flag it
  // would immediately restart the audio the guest just silenced.
  const musicMutedByUser = useRef(false)

  const [rsvpOpen, setRsvpOpen] = useState(false)
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false)
  const [rsvpData, setRsvpData] = useState({
    attendance: '참석',
    side: '신랑측',
    name: '',
    phone: '',
    // 본인 외 headcount — the same thing the sheet's extraGuests column has always meant, so
    // it goes across untranslated. Held as a digit-only string so the field can be cleared
    // while typing; an empty field submits as 0.
    extraGuests: '0',
    // Counted separately from extraGuests because the hall bills a child plate differently,
    // so the couple needs the split rather than one combined headcount.
    children: '0',
    companionNames: '',
    meal: '예정',
    message: '',
  })

  useEffect(() => {
    if (isAdminView) {
      audioRef.current?.pause()
      return
    }
    const stopListening = () => {
      document.removeEventListener('click', tryPlay)
      document.removeEventListener('touchstart', tryPlay)
      document.removeEventListener('scroll', tryPlay)
    }
    const tryPlay = () => {
      const audio = audioRef.current
      if (!audio || musicMutedByUser.current) return
      audio.play().then(stopListening).catch(() => {})
    }
    document.addEventListener('click', tryPlay)
    document.addEventListener('touchstart', tryPlay)
    document.addEventListener('scroll', tryPlay)
    tryPlay()
    return stopListening
  }, [isAdminView])

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    // Read the element, not React state: the unlock listener can change playback
    // out from under us in the same tick.
    if (audio.paused) {
      musicMutedByUser.current = false
      audio.play().catch(() => {})
    } else {
      musicMutedByUser.current = true
      audio.pause()
    }
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
    // Older Android WebViews and some in-app browsers (KakaoTalk among them) leave
    // navigator.clipboard undefined. Reading .writeText off it would throw
    // synchronously, so no toast would ever fire and the tap would look dead.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (!ok) throw new Error('execCommand copy failed')
  }, [])

  const copyAccount = useCallback(async (accountNumber: string) => {
    try {
      await copyToClipboard(accountNumber)
      showToast('계좌번호가 복사되었습니다.')
    } catch {
      showToast('복사에 실패했습니다. 계좌번호를 길게 눌러 복사해 주세요.')
    }
  }, [copyToClipboard, showToast])

  const copyShareLink = useCallback(async () => {
    try {
      // origin + pathname, not href: a guest who arrived on a link carrying ?utm= or a #hash
      // would otherwise pass that tail along to everyone they share with.
      await copyToClipboard(`${window.location.origin}${window.location.pathname}`)
      showToast('청첩장 링크가 복사되었습니다.')
    } catch {
      showToast('복사에 실패했습니다. 주소창의 링크를 길게 눌러 복사해 주세요.')
    }
  }, [copyToClipboard, showToast])

  const shareInvitation = useCallback(async () => {
    // navigator.share needs a secure context, so it is undefined over plain http — including
    // http://<LAN-IP>:5173 on a real phone. The button stays visible regardless and copies
    // the link when the sheet is unavailable, rather than disappearing and looking broken.
    if (!navigator.share) {
      await copyShareLink()
      return
    }
    try {
      await navigator.share({
        title: `${settings.mainNames} 결혼합니다`,
        text: `${settings.mainDateText}\n${settings.mainLocationText}`,
        url: `${window.location.origin}${window.location.pathname}`,
      })
    } catch (error) {
      // A guest who backed out of the sheet decided not to share — falling through to copy
      // the link would be an action they did not ask for. Anything else is a real failure.
      if ((error as Error)?.name === 'AbortError') return
      await copyShareLink()
    }
  }, [settings.mainNames, settings.mainDateText, settings.mainLocationText, copyShareLink])

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

  // Re-run when settings arrive: a .fade-up that only exists once Firestore answers (an extra
  // invitation paragraph, another 안내 block) was never picked up by a one-shot observer, and
  // an unobserved .fade-up is stuck at opacity 0 — invisible for the rest of the visit.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.fade-up:not(.is-visible)')
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        // Stagger whatever crosses the line together, so a section arrives as a cascade
        // rather than one flat pop. Capped, or a fast scroll would queue a visible wait
        // before the last element in a long batch showed up.
        let step = 0
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          el.style.transitionDelay = `${Math.min(step, 4) * 80}ms`
          el.classList.add('is-visible')
          step += 1
          // Revealing is one-way, so stop watching rather than paying for every later scroll.
          obs.unobserve(el)
        })
      },
      { threshold: 0.1 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [settings])

  // `overflow: hidden` on body is a no-op on iOS Safari once the page is scrolled — the
  // background keeps scrolling behind the lightbox and the RSVP sheet. Pinning the body
  // with position:fixed is the technique that actually holds, but it resets scroll
  // position, so we restore it on close.
  const overlayOpen = lightbox !== null || rsvpOpen
  useEffect(() => {
    if (!overlayOpen) return
    const scrollY = window.scrollY
    const body = document.body
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    return () => {
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.width = ''
      // Unpinning the body drops the page back to scroll 0, and `html` carries
      // scroll-behavior: smooth — so restoring the position would *animate* from the top
      // back down, which is exactly the scroll-to-top-then-glide-to-middle the guest sees
      // on closing. Suppress the smoothing for this one jump.
      const html = document.documentElement
      const previousBehavior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, scrollY)
      html.style.scrollBehavior = previousBehavior
    }
  }, [overlayOpen])

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzu-ccO4ds4ZWwuuIivtUpb6Xvw7XJtWoa-9TJ1PJodnaM5Z97X2XmwrxKAN__F0Fbt/exec'

  const openRsvp = useCallback(() => {
    setRsvpData({
      attendance: '참석', side: '신랑측', name: '', phone: '',
      extraGuests: '0', children: '0', companionNames: '', meal: '예정', message: '',
    })
    setRsvpOpen(true)
  }, [])

  const handleRsvpSubmit = useCallback(async () => {
    if (!rsvpData.name.trim()) {
      showToast('성함을 입력해 주세요.')
      return
    }
    const attending = rsvpData.attendance === '참석'
    // 본인 외, so 0 is both the default and a perfectly valid answer — nothing to validate.
    // An empty field means the guest cleared it and is coming alone.
    const extraGuests = attending ? Number(rsvpData.extraGuests || 0) : 0
    const children = attending ? Number(rsvpData.children || 0) : 0
    setRsvpSubmitting(true)
    try {
      // A successful doPost answers 302 -> script.googleusercontent.com, and every hop carries
      // Access-Control-Allow-Origin: *, so a plain cors request goes through and `ok` is real.
      // When the script throws, Apps Script serves an HTML error page with no CORS header at
      // all — the browser rejects the fetch and we land in the catch. Either way a guest is
      // never told their RSVP arrived when it did not. (This used to be mode:'no-cors', where
      // the opaque response made a 500 indistinguishable from success.)
      //
      // No Content-Type header is set on purpose: anything beyond the safelisted values
      // triggers a preflight, and Apps Script does not answer OPTIONS. The body travels as
      // text/plain and the script parses it with JSON.parse(e.postData.contents).
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          attendance: rsvpData.attendance,
          side: rsvpData.side,
          name: rsvpData.name.trim(),
          phone: rsvpData.phone.trim(),
          extraGuests,
          children,
          companionNames: rsvpData.companionNames.trim(),
          meal: rsvpData.meal,
          message: rsvpData.message.trim(),
          timestamp: new Date().toISOString(),
        }),
      })
      if (!response.ok) throw new Error(`RSVP endpoint responded ${response.status}`)
      showToast('참석 여부가 전달되었습니다. 감사합니다.')
      setRsvpOpen(false)
    } catch {
      showToast('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
    setRsvpSubmitting(false)
  }, [rsvpData, APPS_SCRIPT_URL, showToast])

  const galleryPhotos = settings.galleryPhotos
  const activeLightbox = lightbox !== null && lightbox < galleryPhotos.length ? lightbox : null
  const mapQuery = encodeURIComponent(settings.locationQuery)

  const closeLightbox = useCallback(() => setLightbox(null), [])
  const prevSlide = useCallback(() => {
    setLightbox((prev) => (prev !== null && galleryPhotos.length ? (prev - 1 + galleryPhotos.length) % galleryPhotos.length : null))
  }, [galleryPhotos.length])
  const nextSlide = useCallback(() => {
    setLightbox((prev) => (prev !== null && galleryPhotos.length ? (prev + 1) % galleryPhotos.length : null))
  }, [galleryPhotos.length])

  // The lightbox arrows are ~40px targets at the very edge of a phone screen, right where the
  // thumb rests. A swipe is how anyone will actually try to change photos.
  const swipeStart = useRef<{ x: number, y: number } | null>(null)
  const onLightboxTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }, [])
  const onLightboxTouchEnd = useCallback((event: React.TouchEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Ignore mostly-vertical drags so a scroll-ish gesture does not flip the photo.
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) nextSlide()
    else prevSlide()
  }, [nextSlide, prevSlide])

  useEffect(() => {
    if (activeLightbox === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox()
      else if (event.key === 'ArrowLeft') prevSlide()
      else if (event.key === 'ArrowRight') nextSlide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeLightbox, closeLightbox, prevSlide, nextSlide])

  return (
    <div className={`app-root ${isAdminView ? 'app-root-admin' : ''}`}>
      {isAdminView && (
        <Suspense fallback={<aside className="admin-panel admin-login" id="admin-editor"><h2>불러오는 중…</h2></aside>}>
          <AdminPanel settings={settings} setSettings={setSettings} showToast={showToast} />
        </Suspense>
      )}
      {/* Two sources, one download: the browser picks the first it can play. AAC-LC at 64 kbps
          mono beats MP3 at the same bitrate and every mobile browser supports it, but the MP3
          stays as a fallback so nothing can leave a guest with a silent page. */}
      <audio
        ref={audioRef}
        loop
        preload="none"
        onPlay={() => setMusicPlaying(true)}
        onPause={() => setMusicPlaying(false)}
      >
        <source src={bgMusicAac} type="audio/mp4" />
        <source src={bgMusicMp3} type="audio/mpeg" />
      </audio>
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
            {/* The only image above the fold, and it is discovered late because React renders
                it. fetchPriority tells the browser not to queue it behind the rest.
                No src until the photo is settled, though: on a cold cache the bundled default
                is not the photo the couple uploaded, so requesting it would spend ~110 KB of a
                guest's critical path on a picture we are about to replace. */}
            <img
              className={heroReady ? undefined : 'hero-photo-hold'}
              src={heroReady ? settings.mainPhoto : undefined}
              alt="성현과 예은"
              fetchPriority="high"
              decoding="async"
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
          <Paragraphs text={settings.invitationBody} className="section-body" />
          <div className="invite-photo fade-up">
            <img
              src={settings.invitationPhoto}
              alt="성현과 예은"
              loading="lazy"
              decoding="async"
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
                <img src={src} alt={`사진 ${i + 1}`} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </section>

        {/* Location */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">{settings.locationLabel}</div>
            <div className="section-heading">{settings.locationHeading}</div>
          </div>
          <div className="location-addr fade-up">
            <Multiline text={settings.locationAddress} />
          </div>
          <div className="map-img-wrap fade-up">
            <img src={mapImage} alt="센텀호텔 약도" loading="lazy" decoding="async" />
          </div>
          {/* Anchors, not window.open: in-app browsers (KakaoTalk especially) block or trap
              programmatic window.open in a nested WebView with no way back. A real link also
              hands the guest a long-press menu and lets the OS hand off to the installed app. */}
          <div className="map-buttons fade-up">
            <a
              className="map-btn map-btn-naver"
              href={`https://map.naver.com/p/search/${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="map-app-icon" src={naverMapLogo} alt="네이버 지도 로고" loading="lazy" decoding="async" />
              <span>네이버 지도</span>
            </a>
            <a
              className="map-btn map-btn-kakao"
              href={`https://map.kakao.com/?q=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="map-app-icon" src={kakaoMapLogo} alt="카카오맵 로고" loading="lazy" decoding="async" />
              <span>카카오맵</span>
            </a>
            <a
              className="map-btn map-btn-tmap"
              href={`https://map.tmap.co.kr/search?query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="map-app-icon" src={tmapLogo} alt="티맵 로고" loading="lazy" decoding="async" />
              <span>티맵</span>
            </a>
          </div>
        </section>

        {/* Information */}
        {(settings.infoHeading || settings.infoBlocks.length > 0) && (
          <section className="section-wrap alt-bg">
            <div className="fade-up">
              <div className="section-label">{settings.infoLabel}</div>
              <div className="section-heading">{settings.infoHeading}</div>
            </div>
            <div className="info-body fade-up">
              {settings.infoBlocks.map((block, index) => {
                // Two blocks never collapse: one with no title, which would be an accordion
                // with nothing to tap, and one the couple marked alwaysOpen — the short
                // answers (지하철, 주차) that are not worth hiding behind a tap.
                if (!block.title || block.alwaysOpen) {
                  return (
                    <div className="info-box info-box-open" key={`open-${index}`}>
                      {block.title && <div className="info-static-title">{block.title}</div>}
                      <div className="info-panel info-panel-static">
                        <InfoBody text={block.body} />
                      </div>
                    </div>
                  )
                }
                const open = !!openInfo[index]
                return (
                  <div className="info-box" key={`${block.title}-${index}`}>
                    <button
                      type="button"
                      className="info-btn"
                      aria-expanded={open}
                      onClick={() => setOpenInfo((prev) => ({ ...prev, [index]: !prev[index] }))}
                    >
                      <span>{block.title}</span>
                      <svg className={`acct-arrow ${open ? 'acct-arrow-open' : ''}`} viewBox="0 0 24 24">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {open && (
                      <div className="info-panel">
                        <InfoBody text={block.body} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Thanks To */}
        <section className="section-wrap tint-bg">
          <div className="fade-up">
            <div className="section-label">{settings.thanksLabel}</div>
            <div className="section-heading">{settings.thanksHeading}</div>
          </div>
          <div className="thanks-body fade-up">
            <Multiline text={settings.thanksBody} />
          </div>
          {/* An empty list means the couple deleted every row for that side, so the whole
              accordion goes with it rather than opening onto nothing. */}
          {settings.groomAccounts.length > 0 && (
            <div className="acct-box fade-up">
              <button type="button" className="acct-btn" onClick={() => setGroomOpen((open) => !open)}>
                {settings.groomAccountLabel}
                <svg className={`acct-arrow ${groomOpen ? 'acct-arrow-open' : ''}`} viewBox="0 0 24 24">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {groomOpen && (
                <div className="acct-panel">
                  {settings.groomAccounts.map((account, index) => (
                    <AccountRow key={`groom-${index}`} account={account} onCopy={copyAccount} />
                  ))}
                </div>
              )}
            </div>
          )}
          {settings.brideAccounts.length > 0 && (
            <div className="acct-box fade-up">
              <button type="button" className="acct-btn" onClick={() => setBrideOpen((open) => !open)}>
                {settings.brideAccountLabel}
                <svg className={`acct-arrow ${brideOpen ? 'acct-arrow-open' : ''}`} viewBox="0 0 24 24">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {brideOpen && (
                <div className="acct-panel">
                  {settings.brideAccounts.map((account, index) => (
                    <AccountRow key={`bride-${index}`} account={account} onCopy={copyAccount} />
                  ))}
                </div>
              )}
            </div>
          )}
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

        {/* Share */}
        <section className="section-wrap tint-bg">
          <div className="fade-up">
            <div className="section-label">SHARE</div>
            <div className="section-heading">청첩장 공유하기</div>
          </div>
          <hr className="rsvp-divider" />
          <div className="share-btns fade-up">
            <button type="button" className="share-btn share-primary" onClick={shareInvitation}>
              공유하기
            </button>
            <button type="button" className="share-btn share-copy" onClick={copyShareLink}>
              링크 복사하기
            </button>
          </div>
        </section>

        {/* Ending Photo */}
        <section className="ending-photo">
          <img
            src={settings.endingPhoto}
            alt="성현과 예은"
            loading="lazy"
            decoding="async"
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
            🤍
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
                  <p className="gb-form-label">참석 여부<span className="rsvp-req">필수</span></p>
                  <div className="rsvp-toggle">
                    {(['참석', '불참'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`rsvp-opt ${rsvpData.attendance === opt ? 'rsvp-opt-on' : ''}`}
                        onClick={() => setRsvpData((d) => (
                          opt === '불참'
                            // A decline carries no headcount: clear the fields we are about to hide,
                            // or their stale values would still be submitted.
                            ? { ...d, attendance: opt, extraGuests: '0', children: '0', companionNames: '', meal: '해당없음' }
                            : { ...d, attendance: opt, meal: '예정' }
                        ))}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </li>
                <li>
                  <p className="gb-form-label">구분<span className="rsvp-req">필수</span></p>
                  <div className="rsvp-toggle">
                    {(['신랑측', '신부측'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`rsvp-opt ${rsvpData.side === opt ? 'rsvp-opt-on' : ''}`}
                        onClick={() => setRsvpData((d) => ({ ...d, side: opt }))}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </li>
                <li>
                  <p className="gb-form-label">성함<span className="rsvp-req">필수</span></p>
                  <input type="text" className="gb-input" placeholder="성함 입력" value={rsvpData.name} onChange={(e) => setRsvpData((d) => ({ ...d, name: e.target.value }))} />
                </li>
                <li>
                  <p className="gb-form-label">연락처</p>
                  <input type="tel" inputMode="tel" className="gb-input" placeholder="연락처 입력" value={rsvpData.phone} onChange={(e) => setRsvpData((d) => ({ ...d, phone: e.target.value.replace(/[^0-9-]/g, '') }))} />
                </li>
                {rsvpData.attendance === '참석' && (
                  <>
                    <li>
                      <p className="gb-form-label">본인 외 참석 인원</p>
                      {/* type="text" + inputMode="numeric", not type="number": a number input still
                          accepts 'e', '+' and '-', shows spinners nobody taps on a phone, and reports
                          an empty string for junk input so it cannot be filtered. This gets the numeric
                          keypad on mobile while letting us strip anything that is not a digit. */}
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        className="gb-input"
                        placeholder="혼자 참석하시면 0"
                        value={rsvpData.extraGuests}
                        onChange={(e) => setRsvpData((d) => ({ ...d, extraGuests: e.target.value.replace(/[^0-9]/g, '') }))}
                      />
                    </li>
                    <li>
                      <p className="gb-form-label">아이 10세 이하 (본인 외)</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        className="gb-input"
                        placeholder="없으면 0"
                        value={rsvpData.children}
                        onChange={(e) => setRsvpData((d) => ({ ...d, children: e.target.value.replace(/[^0-9]/g, '') }))}
                      />
                    </li>
                    {Number(rsvpData.extraGuests) > 0 && (
                      <li>
                        <p className="gb-form-label">동반 인원 성함</p>
                        <input type="text" className="gb-input" placeholder="예) 홍길동, 김영희" value={rsvpData.companionNames} onChange={(e) => setRsvpData((d) => ({ ...d, companionNames: e.target.value }))} />
                      </li>
                    )}
                    <li>
                      <p className="gb-form-label">식사 여부</p>
                      <select
                        className="gb-input rsvp-select"
                        value={rsvpData.meal}
                        onChange={(e) => setRsvpData((d) => ({ ...d, meal: e.target.value }))}
                      >
                        {['예정', '안함', '미정'].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </li>
                  </>
                )}
                <li>
                  <p className="gb-form-label">전달사항</p>
                  <input type="text" className="gb-input" maxLength={25} placeholder="최대 25자" value={rsvpData.message} onChange={(e) => setRsvpData((d) => ({ ...d, message: e.target.value }))} />
                </li>
              </ul>
              <button type="button" className="gb-submit-btn" disabled={rsvpSubmitting} onClick={handleRsvpSubmit}>
                {rsvpSubmitting ? '전송 중...' : '참석 정보 전달하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox */}
      {activeLightbox !== null && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button type="button" className="lb-close" onClick={closeLightbox}>&times;</button>
          <div
            className="lb-main"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onLightboxTouchStart}
            onTouchEnd={onLightboxTouchEnd}
          >
            <button type="button" className="lb-arrow lb-prev" onClick={prevSlide} aria-label="이전 사진">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5 7.5 12 15 19.5" /></svg>
            </button>
            <img
              className="lb-image"
              src={galleryPhotos[activeLightbox]}
              alt={`사진 ${activeLightbox + 1}`}
            />
            <button type="button" className="lb-arrow lb-next" onClick={nextSlide} aria-label="다음 사진">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5 16.5 12 9 19.5" /></svg>
            </button>
          </div>
          <div className="lb-thumbs" onClick={(e) => e.stopPropagation()}>
            {galleryPhotos.map((src, i) => (
              <button
                type="button"
                key={i}
                className={`lb-thumb ${i === activeLightbox ? 'lb-thumb-active' : ''}`}
                onClick={() => setLightbox(i)}
              >
                <img src={src} alt={`썸네일 ${i + 1}`} loading="lazy" decoding="async" />
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
