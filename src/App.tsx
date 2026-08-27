import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Welcome from './pages/Welcome'

const Library = lazy(() => import('./pages/Library'))
const Planner = lazy(() => import('./pages/Planner'))
const Recipes = lazy(() => import('./pages/Recipes'))
const BlockMap = lazy(() => import('./pages/BlockMap'))
const Specialist = lazy(() => import('./pages/Specialist'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Account = lazy(() => import('./pages/Account'))
const Help = lazy(() => import('./pages/Help'))

export default function App() {
  return <Suspense fallback={<div className="full-loader">Loading…</div>}><Routes>
    <Route element={<Layout />}>
      <Route index element={<Welcome />} />
      <Route path="dashboard" element={<Navigate to="/library#ward-dashboard" replace />} />
      <Route path="library" element={<Library />} />
      <Route path="planner" element={<Planner />} />
      <Route path="recipes" element={<Recipes />} />
      <Route path="block-map" element={<BlockMap />} />
      <Route path="specialist" element={<Specialist />} />
      <Route path="feedback" element={<Feedback />} />
      <Route path="account" element={<Account />} />
      <Route path="help" element={<Help />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></Suspense>
}
