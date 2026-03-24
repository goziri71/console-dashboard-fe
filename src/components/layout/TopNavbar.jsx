import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function TopNavbar({ onMenuClick }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const displayName = user?.first_name || user?.email || 'User'

  return (
    <header className="flex h-[76px] items-center gap-3 border-b border-border-subtle bg-page px-3 sm:px-6">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary lg:hidden"
      >
        <Menu size={22} strokeWidth={2} />
      </button>
      <div className="flex min-w-0 flex-1 justify-end">
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex min-w-0 max-w-full items-center gap-2 rounded-full bg-card px-3 py-2 transition-colors hover:bg-card-hover sm:gap-3 sm:px-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-dim">
            <User size={18} className="text-accent" />
          </div>
          <span className="min-w-0 max-w-[120px] truncate text-sm font-medium text-text-primary sm:max-w-[200px] md:max-w-none">
            {displayName}
          </span>
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
      </div>
    </header>
  )
}
