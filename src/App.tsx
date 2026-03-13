import { useEffect, useState, useCallback, useRef } from 'react'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import mainPhoto from '../img/main/wedding_1.jpg'
import secondPhoto from '../img/main/main_2.jpg'
import endingPhoto from '../img/main/ending.png'
import mapImage from '../img/main/map.png'

import p01 from '../img/IMG_0386.jpg'
import p02 from '../img/IMG_0842.JPG'
import p03 from '../img/IMG_0849.JPG'
import p04 from '../img/IMG_1107.jpg'
import p06 from '../img/IMG_1351.jpg'
import p07 from '../img/IMG_1367.jpg'
import p08 from '../img/IMG_1542.jpg'
import p09 from '../img/IMG_1587.jpg'
import p10 from '../img/IMG_1610.jpg'
import p11 from '../img/IMG_1737.jpg'
import p12 from '../img/IMG_1859.jpg'
import p13 from '../img/IMG_1935.JPG'
import p14 from '../img/IMG_1937.JPG'
import p15 from '../img/IMG_1938.JPG'
import p16 from '../img/IMG_1973.jpg'
import p17 from '../img/IMG_2028.jpg'
import p18 from '../img/IMG_2030.jpg'
import p19 from '../img/IMG_2033.jpg'
import p20 from '../img/IMG_2062.jpg'
import p21 from '../img/IMG_2322.JPG'
import p22 from '../img/IMG_8620.JPG'
import p23 from '../img/4649CC90-5A72-4290-9AB0-30EF97767350.JPG'

import './App.css'

const albumPhotos = [
  p01, p02, p03, p04, p06, p07, p08, p09, p10,
  p11, p12, p13, p14, p15, p16, p17, p18, p19, p20,
  p21, p22, p23,
]

interface GuestBookEntry {
  id: string
  name: string
  password: string
  content: string
  createdAt: Timestamp
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDate(ts: Timestamp) {
  const d = ts.toDate()
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

function App() {
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0 })
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [groomOpen, setGroomOpen] = useState(false)
  const [brideOpen, setBrideOpen] = useState(false)

  const [gbEntries, setGbEntries] = useState<GuestBookEntry[]>([])
  const [gbShowWrite, setGbShowWrite] = useState(false)
  const [gbShowDelete, setGbShowDelete] = useState<string | null>(null)
  const [gbShowMore, setGbShowMore] = useState(false)
  const [gbName, setGbName] = useState('')
  const [gbPw, setGbPw] = useState('')
  const [gbContent, setGbContent] = useState('')
  const [gbDelPw, setGbDelPw] = useState('')
  const [gbSubmitting, setGbSubmitting] = useState(false)
  const gbVisibleCount = 3
  const gbContentRef = useRef<HTMLTextAreaElement>(null)

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
    const q = query(collection(db, 'guestbook'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const entries: GuestBookEntry[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<GuestBookEntry, 'id'>),
      }))
      setGbEntries(entries)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (gbShowWrite || gbShowDelete || gbShowMore) {
      document.body.style.overflow = 'hidden'
    } else if (lightbox === null) {
      document.body.style.overflow = ''
    }
  }, [gbShowWrite, gbShowDelete, gbShowMore, lightbox])

  const handleGbSubmit = useCallback(async () => {
    if (!gbName.trim() || !gbPw.trim() || !gbContent.trim()) {
      alert('모든 항목을 입력해 주세요.')
      return
    }
    setGbSubmitting(true)
    try {
      await addDoc(collection(db, 'guestbook'), {
        name: gbName.trim(),
        password: gbPw.trim(),
        content: gbContent.trim(),
        createdAt: Timestamp.now(),
      })
      setGbName('')
      setGbPw('')
      setGbContent('')
      setGbShowWrite(false)
    } catch {
      alert('등록에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
    setGbSubmitting(false)
  }, [gbName, gbPw, gbContent])

  const handleGbDelete = useCallback(async () => {
    if (!gbShowDelete) return
    const entry = gbEntries.find((e) => e.id === gbShowDelete)
    if (!entry) return
    if (gbDelPw !== entry.password) {
      alert('비밀번호가 일치하지 않습니다.')
      return
    }
    setGbSubmitting(true)
    try {
      await deleteDoc(doc(db, 'guestbook', gbShowDelete))
      setGbDelPw('')
      setGbShowDelete(null)
    } catch {
      alert('삭제에 실패했습니다.')
    }
    setGbSubmitting(false)
  }, [gbShowDelete, gbDelPw, gbEntries])

  const closeLightbox = useCallback(() => setLightbox(null), [])
  const prevSlide = useCallback(() => {
    setLightbox((prev) => (prev !== null ? (prev - 1 + albumPhotos.length) % albumPhotos.length : null))
  }, [])
  const nextSlide = useCallback(() => {
    setLightbox((prev) => (prev !== null ? (prev + 1) % albumPhotos.length : null))
  }, [])

  return (
    <div className="app-root">
      <main className="invitation">

        {/* ── Hero / Save the Date ── */}
        <section className="hero">
          <div className="hero-date-block fade-up">
            <span className="hero-name-side">박 성 현</span>
            <div className="hero-date-num">
              <span className="month">10</span>
              <span className="day">24</span>
            </div>
            <span className="hero-name-side">배 예 은</span>
          </div>
          <div className="hero-photo fade-up">
            <img src={mainPhoto} alt="성현과 예은" />
            <div className="hero-photo-gradient" />
          </div>
          <div className="hero-caption fade-up">
            2026년 10월 24일 토요일 오후 2시 30분
            <br />
            부산 센텀호텔 4F 벨라홀
          </div>
        </section>

        {/* ── Invitation ── */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">INVITATION</div>
            <div className="section-heading">초대합니다.</div>
          </div>
          <div className="section-body fade-up">
            서로가 마주 보며 다져온 사랑을
            <br />
            이제 함께 한곳을 바라보며 걸어갈 수 있는
            <br />
            큰 사랑으로 키우고자 합니다.
            <br />
            저희가 지켜나갈 수 있게
            <br />
            앞날을 축복해 주시면 감사하겠습니다.
          </div>
          <div className="invite-photo fade-up">
            <img src={secondPhoto} alt="성현과 예은" />
          </div>
          <div className="invite-names fade-up">
            박성현 · 배예은
          </div>
        </section>

        {/* ── Wedding Date ── */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">WEDDING DATE</div>
            <div className="calendar-date-text">
              2026년 10월 24일 토요일 오후 2시 30분
            </div>
          </div>

          <table className="calendar-grid fade-up">
            <thead>
              <tr>
                <th>일</th><th>월</th><th>화</th><th>수</th>
                <th>목</th><th>금</th><th>토</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="is-empty">.</td>
                <td className="is-empty">.</td>
                <td className="is-empty">.</td>
                <td className="is-empty">.</td>
                <td>1</td><td>2</td><td>3</td>
              </tr>
              <tr>
                <td className="is-sun">4</td><td>5</td><td>6</td><td>7</td>
                <td>8</td><td>9</td><td>10</td>
              </tr>
              <tr>
                <td className="is-sun">11</td><td>12</td><td>13</td><td>14</td>
                <td>15</td><td>16</td><td>17</td>
              </tr>
              <tr>
                <td className="is-sun">18</td><td>19</td><td>20</td><td>21</td>
                <td>22</td><td>23</td><td className="is-active">24</td>
              </tr>
              <tr>
                <td className="is-sun">25</td><td>26</td><td>27</td><td>28</td>
                <td>29</td><td>30</td><td>31</td>
              </tr>
            </tbody>
          </table>

          {/* ── Countdown ── */}
          <div className="countdown-bar fade-up">
            <div className="cd-unit">
              <span className="cd-num">{cd.d}</span>
              <span className="cd-label">Days</span>
            </div>
            <span className="cd-colon">:</span>
            <div className="cd-unit">
              <span className="cd-num">{pad(cd.h)}</span>
              <span className="cd-label">Hours</span>
            </div>
            <span className="cd-colon">:</span>
            <div className="cd-unit">
              <span className="cd-num">{pad(cd.m)}</span>
              <span className="cd-label">Minutes</span>
            </div>
            <span className="cd-colon">:</span>
            <div className="cd-unit">
              <span className="cd-num">{pad(cd.s)}</span>
              <span className="cd-label">Seconds</span>
            </div>
          </div>
        </section>

        {/* ── Gallery ── */}
        <section className="section-wrap gallery-section">
          <div className="fade-up">
            <div className="section-label">GALLERY</div>
            <div className="gallery-heading">우리가 함께 한 모든 순간</div>
          </div>
          <div className="gallery-strip fade-up">
            {albumPhotos.map((src, i) => (
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

        {/* ── Location ── */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">LOCATION</div>
            <div className="section-heading">오시는 길</div>
          </div>
          <div className="location-addr fade-up">
            부산광역시 해운대구 센텀남대로 26
            <br />
            부산 센텀호텔 4F 벨라홀
          </div>
          <div className="map-img-wrap fade-up">
            <img src={mapImage} alt="센텀호텔 약도" />
          </div>
          <div className="map-buttons fade-up">
            <button
              type="button"
              className="map-btn"
              onClick={() => window.open('https://map.naver.com/p/search/%EB%B6%80%EC%82%B0%20%EC%84%BC%ED%85%80%ED%98%B8%ED%85%94%EC%9B%A8%EB%94%A9%ED%99%80', '_blank')}
            >
              네이버 지도
            </button>
            <button
              type="button"
              className="map-btn"
              onClick={() => window.open('https://map.kakao.com/?q=%EB%B6%80%EC%82%B0%20%EC%84%BC%ED%85%80%ED%98%B8%ED%85%94%EC%9B%A8%EB%94%A9%ED%99%80', '_blank')}
            >
              카카오 내비
            </button>
          </div>
        </section>

        {/* ── Information / Photo Booth ── */}
        <section className="section-wrap alt-bg">
          <div className="fade-up">
            <div className="section-label">INFORMATION</div>
            <div className="section-heading">안내사항</div>
          </div>
          <div className="info-body fade-up">
            기쁜 날 함께해 주신 모든 분들께서도
            <br />
            행복한 추억으로 기념하실 수 있도록
            <br />
            포토부스를 마련하였습니다.
            <br /><br />
            조금 일찍 방문하셔서
            <br />
            미소 가득한 사진과 따뜻한 메시지를
            <br />
            남겨 주시면
            <br />
            저희 두 사람이 오래도록
            <br />
            소중히 간직하겠습니다.
          </div>
        </section>

        {/* ── Thanks To ── */}
        <section className="section-wrap">
          <div className="fade-up">
            <div className="section-label">THANKS TO</div>
            <div className="section-heading">마음 전하는 곳</div>
          </div>
          <div className="thanks-body fade-up">
            직접 축하를 전하지 못하는 분들을 위해
            <br />
            부득이하게 계좌번호를 기재하게 되었습니다.
            <br />
            넓은 마음으로 양해 부탁드립니다.
          </div>
          <div className="fade-up">
            {/* 신랑 측 */}
            <div className="acct-box">
              <button
                type="button"
                className="acct-btn"
                onClick={() => setGroomOpen((v) => !v)}
              >
                신랑 측 계좌번호
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
                      <span className="acct-bank">카카오뱅크</span>
                      <span className="acct-number">0000-00-0000000</span>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => { navigator.clipboard.writeText('0000-00-0000000'); alert('계좌번호가 복사되었습니다.') }}
                      >
                        복사
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 신부 측 */}
            <div className="acct-box">
              <button
                type="button"
                className="acct-btn"
                onClick={() => setBrideOpen((v) => !v)}
              >
                신부 측 계좌번호
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
                      <span className="acct-bank">카카오뱅크</span>
                      <span className="acct-number">0000-00-0000000</span>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => { navigator.clipboard.writeText('0000-00-0000000'); alert('계좌번호가 복사되었습니다.') }}
                      >
                        복사
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── RSVP ── */}
        <section className="section-wrap alt-bg">
          <div className="fade-up">
            <div className="section-label">R/S/V/P</div>
            <div className="section-heading">참석 여부</div>
          </div>
          <hr className="rsvp-divider" />
          <div className="rsvp-body fade-up">
            특별한 날 축하하는 마음으로
            <br />
            참석해 주시는 모든 분들에게 한 분 한 분
            <br />
            마음을 담아 귀하게 모실 수 있도록,
            <br />
            하단의 버튼을 클릭하여
            <br />
            참석 여부 전달을 꼭 부탁드립니다.
          </div>
          <div className="fade-up">
            <button type="button" className="rsvp-btn">전달하기</button>
          </div>
        </section>

        {/* ── Guest Book ── */}
        <section className="section-wrap gb-section">
          <div className="fade-up">
            <div className="section-label">GUEST BOOK</div>
            <div className="section-heading" style={{ marginBottom: 5 }}>
              따뜻한 마음으로 축복해 주세요
            </div>
          </div>

          <ul className="gb-list fade-up">
            {gbEntries.length === 0 && (
              <li className="gb-entry gb-empty">첫번째 방명록을 남겨주세요.</li>
            )}
            {gbEntries.slice(0, gbVisibleCount).map((entry) => (
              <li className="gb-entry" key={entry.id}>
                <h3 className="gb-author">
                  {entry.name}
                  <button
                    type="button"
                    className="gb-del-btn"
                    onClick={() => { setGbDelPw(''); setGbShowDelete(entry.id) }}
                    aria-label="삭제"
                  >
                    &times;
                  </button>
                </h3>
                <p className="gb-message">{entry.content}</p>
                <span className="gb-date">{formatDate(entry.createdAt)}</span>
              </li>
            ))}
          </ul>

          <div className="gb-buttons fade-up">
            <button
              type="button"
              className="gb-write-btn"
              onClick={() => { setGbName(''); setGbPw(''); setGbContent(''); setGbShowWrite(true) }}
            >
              작성하기
            </button>
            {gbEntries.length > gbVisibleCount && (
              <button
                type="button"
                className="gb-more-btn"
                onClick={() => setGbShowMore(true)}
              >
                더 보기
              </button>
            )}
          </div>
        </section>

        {/* ── Ending Photo ── */}
        <section className="ending-photo">
          <img src={endingPhoto} alt="성현과 예은" />
          <div className="ending-overlay" />
          <div className="ending-text fade-up">
            <p>평생을 같이 하고 싶은</p>
            <p>사람이 생겼습니다.</p>
            <p>서로 아껴주고 배려하며</p>
            <p>사랑으로 베풀며 살겠습니다.</p>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="footer">
          Made with{' '}
          <a
            href="https://github.com/dannypark95/mobile_wedding"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-heart"
          >
            ❤️
          </a>
        </footer>
      </main>

      {/* ── Guest Book: Write Modal ── */}
      {gbShowWrite && (
        <div className="gb-overlay" onClick={() => setGbShowWrite(false)}>
          <div className="gb-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="gb-modal-close" onClick={() => setGbShowWrite(false)}>&times;</button>
            <div className="gb-modal-body">
              <ul className="gb-form">
                <li>
                  <p className="gb-form-label">성함</p>
                  <input
                    type="text"
                    className="gb-input"
                    placeholder="본인 성함 입력"
                    value={gbName}
                    onChange={(e) => setGbName(e.target.value)}
                  />
                </li>
                <li>
                  <p className="gb-form-label">비밀번호</p>
                  <input
                    type="password"
                    className="gb-input"
                    maxLength={10}
                    placeholder="방명록 삭제를 위한 비밀번호 입력(최대 10자리)"
                    value={gbPw}
                    onChange={(e) => setGbPw(e.target.value)}
                  />
                </li>
                <li>
                  <p className="gb-form-label">내용</p>
                  <textarea
                    ref={gbContentRef}
                    className="gb-textarea"
                    maxLength={100}
                    placeholder="최대 100자까지 입력"
                    value={gbContent}
                    onChange={(e) => setGbContent(e.target.value)}
                  />
                </li>
              </ul>
              <button
                type="button"
                className="gb-submit-btn"
                disabled={gbSubmitting}
                onClick={handleGbSubmit}
              >
                {gbSubmitting ? '등록 중...' : '제출하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guest Book: Delete Modal ── */}
      {gbShowDelete && (
        <div className="gb-overlay" onClick={() => setGbShowDelete(null)}>
          <div className="gb-modal gb-modal-sm" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="gb-modal-close" onClick={() => setGbShowDelete(null)}>&times;</button>
            <div className="gb-modal-body">
              <ul className="gb-form">
                <li>
                  <p className="gb-form-label">비밀번호</p>
                  <input
                    type="password"
                    className="gb-input"
                    placeholder="비밀번호 입력"
                    value={gbDelPw}
                    onChange={(e) => setGbDelPw(e.target.value)}
                  />
                </li>
              </ul>
              <button
                type="button"
                className="gb-submit-btn"
                disabled={gbSubmitting}
                onClick={handleGbDelete}
              >
                {gbSubmitting ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guest Book: More Modal ── */}
      {gbShowMore && (
        <div className="gb-overlay" onClick={() => setGbShowMore(false)}>
          <div className="gb-modal gb-modal-tall" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="gb-modal-close" onClick={() => setGbShowMore(false)}>&times;</button>
            <div className="gb-modal-body gb-modal-scroll">
              <ul className="gb-list gb-list-full">
                {gbEntries.map((entry) => (
                  <li className="gb-entry" key={entry.id}>
                    <h3 className="gb-author">
                      {entry.name}
                      <button
                        type="button"
                        className="gb-del-btn"
                        onClick={() => { setGbDelPw(''); setGbShowDelete(entry.id); setGbShowMore(false) }}
                        aria-label="삭제"
                      >
                        &times;
                      </button>
                    </h3>
                    <p className="gb-message">{entry.content}</p>
                    <span className="gb-date">{formatDate(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button type="button" className="lb-close" onClick={closeLightbox}>&times;</button>
          <div className="lb-main" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lb-arrow lb-prev" onClick={prevSlide}>&lsaquo;</button>
            <img
              className="lb-image"
              src={albumPhotos[lightbox]}
              alt={`사진 ${lightbox + 1}`}
            />
            <button type="button" className="lb-arrow lb-next" onClick={nextSlide}>&rsaquo;</button>
          </div>
          <div className="lb-thumbs" onClick={(e) => e.stopPropagation()}>
            {albumPhotos.map((src, i) => (
              <button
                type="button"
                key={i}
                className={`lb-thumb ${i === lightbox ? 'lb-thumb-active' : ''}`}
                onClick={() => setLightbox(i)}
              >
                <img src={src} alt={`썸네일 ${i + 1}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
