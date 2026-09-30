import { NavLink, Route, Routes } from 'react-router-dom';
import Modules from './pages/Modules.jsx';
import Workspace from './pages/Workspace.jsx';
import Render from './pages/Render.jsx';
import Kit from './pages/Kit.jsx';
import Settings from './pages/Settings.jsx';

const nav = ({ isActive }) => `px-3 py-1.5 rounded-md text-sm ${isActive ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`;

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-onair" />
            Module Audio Studio
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={nav}>Modules</NavLink>
            <NavLink to="/kit" className={nav}>Kit</NavLink>
            <NavLink to="/settings" className={nav}>Settings</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Routes>
          <Route path="/" element={<Modules />} />
          <Route path="/m/:id" element={<Workspace />} />
          <Route path="/m/:id/render" element={<Render />} />
          <Route path="/kit" element={<Kit />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
