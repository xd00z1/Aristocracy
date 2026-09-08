/**
 * Placeholder shell. The app-shell agent replaces this with the real routes:
 * Today, Session, Estate, Tour, Collection, Settings, Rank-up.
 */
import { Route, Routes } from 'react-router-dom'
import { getContent } from '../content'

function Placeholder() {
  const c = getContent()
  return (
    <main className="mx-auto max-w-xl p-6">
      <p className="smallcaps text-ink-mute">Aristocracy</p>
      <h1 className="mt-2 text-3xl">Scaffold</h1>
      <p className="mt-4 text-ink-soft">
        {c.stats.items} items, {c.stats.scenarios} scenarios, {c.lessons.length} lessons.
      </p>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  )
}
