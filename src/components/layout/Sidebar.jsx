import { NavLink } from 'react-router-dom'
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

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Customers', icon: Users, path: '/customers' },
  { label: 'Wallet', icon: Wallet, path: '/wallets' },
  { label: 'Transactions', icon: ArrowLeftRight, path: '/transactions' },
  { label: 'Compliance', icon: ShieldCheck, path: '/compliance' },
  { label: 'Disputes', icon: AlertTriangle, path: '/disputes' },
  { label: 'Settlements', icon: Landmark, path: '/settlements' },
  { label: 'Reports', icon: FileText, path: '/reports' },
  { label: 'Admin Tools', icon: Settings, path: '/admin' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-[248px] flex-col bg-sidebar border-r border-border-subtle">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <span className="text-sm font-bold text-page">S</span>
        </div>
        <span className="text-lg font-semibold text-text-primary">Sterllo</span>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-accent text-page shadow-md shadow-accent/20'
                  : 'text-text-secondary hover:bg-card-hover hover:text-text-primary hover:translate-x-0.5 active:scale-[0.98]'
              }`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
