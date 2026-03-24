import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  Landmark,
  FileText,
  Settings,
} from 'lucide-react'
import logo from '../../assets/Authlogo/Sterllologo.svg'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Merchants', icon: Users, path: '/merchants' },
  { label: 'Wallet', icon: Wallet, path: '/wallets' },
  { label: 'Transactions', icon: ArrowLeftRight, path: '/transactions' },
  { label: 'Compliance', icon: ShieldCheck, path: '/compliance' },
  { label: 'Disputes', icon: AlertTriangle, path: '/disputes' },
  { label: 'Settlements', icon: Landmark, path: '/settlements' },
  { label: 'Reports', icon: FileText, path: '/reports' },
  { label: 'Admin Tools', icon: Settings, path: '/admin' },
]

export default function Sidebar({ mobileOpen = false, onNavigate }) {
  return (
    <aside
      className={cn(
        'flex h-full w-[248px] shrink-0 flex-col border-r border-border-subtle bg-sidebar',
        'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:static lg:z-auto lg:translate-x-0'
      )}
    >
      <div className="flex items-center gap-2 px-6 py-5">
        <img src={logo} alt="Sterllo Logo" className="h-6 w-6" />
        <span className="text-lg font-semibold text-text-primary">Sterllo</span>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[#252A09] text-[#F7F7F7] shadow-md shadow-accent/20'
                  : 'text-text-secondary hover:bg-card-hover hover:text-text-primary hover:translate-x-0.5 active:scale-[0.98]'
              }`
            }
          >
            <item.icon size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
