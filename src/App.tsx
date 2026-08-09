import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Library from './pages/Library'
import Planner from './pages/Planner'
import Recipes from './pages/Recipes'
import BlockMap from './pages/BlockMap'
import Specialist from './pages/Specialist'
import Feedback from './pages/Feedback'

export default function App() {
  return <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="library" element={<Library />} />
      <Route path="planner" element={<Planner />} />
      <Route path="recipes" element={<Recipes />} />
      <Route path="block-map" element={<BlockMap />} />
      <Route path="specialist" element={<Specialist />} />
      <Route path="feedback" element={<Feedback />} />
      <Route path="*" element={<Home />} />
    </Route>
  </Routes>
}
