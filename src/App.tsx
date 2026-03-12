import './App.css'

function App() {
  return (
    <div className="app-root">
      <main className="invitation">
        <div className="invitation-inner">
          <section className="top-banner">we are getting married</section>

          <section className="hero-card">
            <div className="hero-photo">
              <img
                className="hero-image"
                src="https://images.pexels.com/photos/3951628/pexels-photo-3951628.jpeg?auto=compress&cs=tinysrgb&w=1200"
                alt="Romantic couple standing by the sea at sunset"
              />
              <div className="hero-photo-caption">
                AI generated photo in a warm autumn mood
              </div>
            </div>
            <div className="hero-text">
              <div className="hero-date">2026. 10. 24 SAT 2:30 PM</div>
              <h1 className="hero-names">박성현 &amp; 배예은</h1>
              <div className="hero-subtitle">서로의 가장 따뜻한 안식처가 되겠습니다.</div>
            </div>
          </section>

          <section className="section">
            <div className="section-title">invitation</div>
            <div className="section-box">
              <p className="message-korean">
                {`만남에 사랑이 스며들어
저희 두 사람,
결혼이라는 새 출발을 하려 합니다.

소중한 분들을 모시고
조심스레 한 걸음 내딛는 이 날,
축복의 발걸음으로 함께 해주신다면
더없는 기쁨이 되겠습니다.`}
              </p>
              <div className="names-line">
                <span>박성현</span>
                <span>배예은</span>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-title">our day</div>
            <div className="section-box">
              <table className="calendar-grid">
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
                    <td className="is-empty">29</td>
                    <td className="is-empty">30</td>
                    <td>1</td>
                    <td>2</td>
                    <td>3</td>
                    <td>4</td>
                    <td>5</td>
                  </tr>
                  <tr>
                    <td>6</td>
                    <td>7</td>
                    <td>8</td>
                    <td>9</td>
                    <td>10</td>
                    <td>11</td>
                    <td>12</td>
                  </tr>
                  <tr>
                    <td>13</td>
                    <td>14</td>
                    <td>15</td>
                    <td>16</td>
                    <td>17</td>
                    <td>18</td>
                    <td>19</td>
                  </tr>
                  <tr>
                    <td>20</td>
                    <td>21</td>
                    <td>22</td>
                    <td>23</td>
                    <td className="is-active">24</td>
                    <td>25</td>
                    <td>26</td>
                  </tr>
                  <tr>
                    <td>27</td>
                    <td>28</td>
                    <td>29</td>
                    <td>30</td>
                    <td className="is-empty">31</td>
                    <td className="is-empty">1</td>
                    <td className="is-empty">2</td>
                  </tr>
                </tbody>
              </table>

              <div className="datetime-detail">
                <div className="datetime-detail-strong">
                  2026년 10월 24일 토요일 오후 2시 30분
                </div>
                <div>부산 센터호텔 4F 벨라홀</div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-title">photo</div>
            <div className="section-box">
              <div className="photo-strip">
                <figure className="photo-card">
                  <img
                    src="https://images.pexels.com/photos/3951621/pexels-photo-3951621.jpeg?auto=compress&cs=tinysrgb&w=1200"
                    alt="Couple walking together on a seaside promenade"
                  />
                  <figcaption className="photo-card-caption">
                    함께 걸어온 시간들이 모여
                    <br />
                    우리의 계절을 만들어 주었습니다.
                  </figcaption>
                </figure>
                <figure className="photo-card">
                  <img
                    src="https://images.pexels.com/photos/3951622/pexels-photo-3951622.jpeg?auto=compress&cs=tinysrgb&w=1200"
                    alt="Close-up of couple holding hands with bouquet"
                  />
                  <figcaption className="photo-card-caption">
                    이 사랑이 오래도록
                    <br />
                    잔잔하게 빛나길 소망합니다.
                  </figcaption>
                </figure>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-title">location</div>
            <div className="section-box">
              <div className="location-name">부산 센터호텔 4F 벨라홀</div>
              <div className="location-address">부산광역시 (상세 주소 입력 예정)</div>
              <div className="location-helper">
                모바일 청첩장에서 지도 앱으로 길찾기를
                <br />
                바로 열어보실 수 있도록 사용할 수 있습니다.
              </div>

              <div className="map-placeholder">
                <div>
                  <div className="map-pin">📍</div>
                  <div>
                    부산 센터호텔 벨라홀
                    <br />
                    지도를 삽입하거나 캡처 이미지를
                    <br />
                    넣어 사용하실 수 있어요.
                  </div>
                </div>
              </div>

              <div className="button-row">
                <button
                  type="button"
                  className="outline-button"
                  onClick={() =>
                    window.open(
                      'https://map.naver.com/p/search/%EB%B6%80%EC%82%B0%20%EC%84%BC%ED%84%B0%ED%98%B8%ED%85%94',
                      '_blank',
                    )
                  }
                >
                  네이버지도 열기
                </button>
                <button
                  type="button"
                  className="filled-button"
                  onClick={() =>
                    window.open(
                      'https://map.kakao.com/?q=%EB%B6%80%EC%82%B0%20%EC%84%BC%ED%84%B0%ED%98%B8%ED%85%94',
                      '_blank',
                    )
                  }
                >
                  카카오맵 열기
                </button>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-title">photo booth</div>
            <div className="section-box">
              <p className="photobooth-note">
                {`결혼식 당일 예식장 내부에
포토부스가 준비될 예정입니다.

조금 일찍 방문하셔서
미소 가득한 사진과 따뜻한 메시지를
남겨 주신다면
저희 두 사람이 오래도록
소중히 간직하겠습니다.`}
              </p>
            </div>
          </section>

          <footer className="footer">
            copyright © 박성현 &amp; 배예은 2026. all rights reserved.
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
