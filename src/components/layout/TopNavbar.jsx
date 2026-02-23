import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, User, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function TopNavbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const displayName = user?.first_name || user?.email || 'User'

  return (
    <header className="flex h-[76px] items-center justify-end border-b border-border-subtle bg-page px-6">
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-3 rounded-full bg-card px-4 py-2 transition-colors hover:bg-card-hover"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-dim">
            <User size={18} className="text-accent" />
          </div>
          <span className="text-sm font-medium text-text-primary">{displayName}</span>
          <ChevronDown size={16} className="text-text-secondary" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-[var(--radius-card)] border border-border bg-card py-1 shadow-lg">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
