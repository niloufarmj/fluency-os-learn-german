import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppState';
import { useTheme } from '../../state/useTheme';

function navClass({ isActive }: { isActive: boolean }) {
  return `nav-item${isActive ? ' active' : ''}`;
}

export function AppLayout() {
  const { profile } = useApp();
  const { toggleTheme, getTheme } = useTheme();
  const loc = useLocation();
  const nav = useNavigate();

  const name = profile?.name || 'Learner';
  const avatar = (name || 'L')[0]?.toUpperCase?.() ?? 'L';
  const level = profile?.level || 'A2';
  const isDark = getTheme() === 'dark';

  // If a user deep-links to /onboarding, keep it full-screen.
  if (loc.pathname.startsWith('/onboarding')) {
    return <Outlet />;
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => nav('/dashboard')} style={{ cursor: 'pointer' }}>
          <span className="sidebar-logo-mark">F</span>
          <h1>
            Fluency<em>OS</em>
          </h1>
        </div>

        <nav>
          <NavLink className={navClass} to="/dashboard">
            <span className="nav-icon">📊</span> Dashboard
          </NavLink>
          <NavLink className={navClass} to="/plan">
            <span className="nav-icon">🧠</span> Daily Plan
          </NavLink>
          <NavLink className={navClass} to="/vocabulary">
            <span className="nav-icon">🗂️</span> Vocabulary
          </NavLink>
          <NavLink className={navClass} to="/grammar">
            <span className="nav-icon">📐</span> Grammar
          </NavLink>
          <NavLink className={navClass} to="/reading">
            <span className="nav-icon">📖</span> Reading
          </NavLink>
          <NavLink className={navClass} to="/roleplay">
            <span className="nav-icon">🎭</span> Roleplay
          </NavLink>
          <NavLink className={navClass} to="/settings">
            <span className="nav-icon">⚙️</span> Settings
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{avatar}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{name}</div>
              <div className="level-badge">{level}</div>
            </div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme}>
            {isDark ? '☀️  Light Mode' : '🌙  Dark Mode'}
          </button>
        </div>
      </aside>

      <main className="main" id="main">
        <div className="module">
          <Outlet />
        </div>
      </main>
    </>
  );
}

