import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Today from '@/screens/Today'
import Gym from '@/screens/Gym'
import Review from '@/screens/Review'
import Coach from '@/screens/Coach'
import Field from '@/screens/Field'
import Learn from '@/screens/Learn'

function TabIcon({ name }: { name: 'today' | 'coach' | 'gym' | 'review' | 'field' | 'learn' }) {
  switch (name) {
    case 'today':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
          <path d="M5 6h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        </svg>
      )
    case 'coach':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
      )
    case 'gym':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 7v10" />
          <path d="M18 7v10" />
          <path d="M4 10v4" />
          <path d="M20 10v4" />
          <path d="M6 12h12" />
        </svg>
      )
    case 'review':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 17V9" />
          <path d="M12 17V7" />
          <path d="M16 17v-5" />
        </svg>
      )
    case 'field':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l4 9-4 11-4-11 4-9z" />
          <path d="M12 11l7 3-7 8-7-8 7-3z" />
        </svg>
      )
    case 'learn':
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19a2 2 0 0 0 2 2h14" />
          <path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M8 7h8" />
        </svg>
      )
  }
}

function BottomNav() {
  const linkBase = 'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs'
  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    `${linkBase} ${isActive ? 'text-primary' : 'text-text-secondary'}`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex max-w-md rounded-t-[12px] px-2">
        <NavLink to="/today" className={linkClassName}>
          <TabIcon name="today" />
          <span>Today</span>
        </NavLink>
        <NavLink to="/coach" className={linkClassName}>
          <TabIcon name="coach" />
          <span>Coach</span>
        </NavLink>
        <NavLink to="/gym" className={linkClassName}>
          <TabIcon name="gym" />
          <span>Gym</span>
        </NavLink>
        <NavLink to="/review" className={linkClassName}>
          <TabIcon name="review" />
          <span>Review</span>
        </NavLink>
        <NavLink to="/field" className={linkClassName}>
          <TabIcon name="field" />
          <span>Field</span>
        </NavLink>
        <NavLink to="/learn" className={linkClassName}>
          <TabIcon name="learn" />
          <span>Learn</span>
        </NavLink>
      </div>
    </nav>
  )
}

function App() {
  const location = useLocation()
  const showShellHeader = location.pathname !== '/today'

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-5 pb-20">
        {showShellHeader ? (
          <header className="mb-4">
            <div className="text-lg font-bold tracking-wide text-primary">GRND</div>
          </header>
        ) : null}

        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/gym" element={<Gym />} />
          <Route path="/review" element={<Review />} />
          <Route path="/field" element={<Field />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>

      <BottomNav />
    </div>
  )
}

export default App
