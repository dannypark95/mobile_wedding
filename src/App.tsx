import { useEffect, useState } from 'react'
import mainPhoto from '../img/main/IMG_8608.JPG'
import mapImage from '../img/main/map.png'
import photoJpg1 from '../img/IMG_2322.JPG'
import photoJpg2 from '../img/IMG_1938.JPG'
import photoJpg3 from '../img/IMG_1937.JPG'
import photoJpg4 from '../img/IMG_1935.JPG'
import photoJpg5 from '../img/IMG_0849.JPG'
import photoJpg6 from '../img/IMG_0842.JPG'
import photoJpg7 from '../img/4649CC90-5A72-4290-9AB0-30EF97767350.JPG'
import photoJpg8 from '../img/IMG_8620.JPG'
import './App.css'

const albumPhotos = [
  photoJpg1, photoJpg2, photoJpg3, photoJpg4,
  photoJpg5, photoJpg6, photoJpg7, photoJpg8,
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function App() {
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0 })

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
      { threshold: 0.12 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
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
            부산 센터호텔 4F 벨라홀
          </div>
        </section>

        {/* ── Quote ── */}
        <section className="quote-block fade-up">
          서로의 가장 따뜻한 안식처가 되겠습니다.
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
            <img src={photoJpg8} alt="성현과 예은" />
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
        </section>

        {/* ── Countdown ── */}
        <div style={{ padding: '0 30px 50px', background: 'var(--c-main03)' }}>
          <div className="countdown-bar fade-up">
            <div className="countdown-bar-bg">
              <img src={photoJpg5} alt="" />
            </div>
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
          <div className="countdown-message fade-up">
            성현 ♥ 예은 님의 결혼식이 {cd.d}일 남았습니다.
          </div>
        </div>

        {/* ── Gallery ── */}
        <section className="section-wrap" style={{ background: '#fff' }}>
          <div className="fade-up">
            <div className="section-label">GALLERY</div>
            <div className="gallery-heading">우리가 함께 한 모든 순간</div>
          </div>
          <div className="gallery-strip fade-up">
            {albumPhotos.map((src, i) => (
              <button type="button" className="gallery-slide" key={i} aria-label={`사진 ${i + 1}`}>
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
            부산 센터호텔 4F 벨라홀
          </div>
          <div className="map-img-wrap fade-up">
            <img src={mapImage} alt="센터호텔 약도" />
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
        <section className="section-wrap" style={{ background: '#fff' }}>
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
            <button type="button" className="acct-btn">
              신랑 측 계좌번호
              <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            <button type="button" className="acct-btn">
              신부 측 계좌번호
              <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </div>
        </section>

        {/* ── RSVP ── */}
        <section className="section-wrap" style={{ background: '#fff' }}>
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

        {/* ── Footer ── */}
        <footer className="footer">
          copyright © 박성현 &amp; 배예은 2026
        </footer>
      </main>
    </div>
  )
}

export default App
