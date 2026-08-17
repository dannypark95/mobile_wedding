import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// /video is a working tool for collecting footage, not part of the invitation, so it is routed
// here rather than inside App: mounting it that way would still run every hook the invitation
// has — the settings fetch, the guestbook fetch, the intro, the music — behind a page that
// wants none of them. Lazy, so guests never download it; App stays a static import so their
// first paint is not held up by a second chunk.
const VideoPage = lazy(() => import('./VideoPage.tsx'))

const path = window.location.pathname.replace(/\/$/, '')
const isVideoRoute = path.endsWith('/video')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isVideoRoute
      ? (
        <Suspense fallback={<aside className="admin-panel admin-login video-panel"><h2>불러오는 중…</h2></aside>}>
          <VideoPage />
        </Suspense>
      )
      : <App />}
  </StrictMode>,
)
