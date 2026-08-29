import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Briefcase,
  BookOpen,
  Bot,
  Sparkles,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const navItems: {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[] = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Today', path: '/today', icon: CalendarCheck },
    { label: 'Week', path: '/week', icon: CalendarDays },
    { label: 'Work', path: '/work', icon: Briefcase },
    { label: 'Study', path: '/study', icon: BookOpen },
    { label: 'Planning Agent', path: '/planning-agent', icon: Bot, badge: 'AI' },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          'fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-slate-950/85 backdrop-blur-xl text-slate-300 border-r border-slate-800/60 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 shadow-2xl shadow-black/40',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800/80">
          <NavLink to="/dashboard" className="flex items-center gap-3 group" onClick={onClose}>
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-[0_0_16px_rgba(99,102,241,0.5)] group-hover:bg-indigo-500 group-hover:shadow-[0_0_22px_rgba(99,102,241,0.8)] transition-all">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">Helix</span>
              <span className="text-[10px] block text-indigo-400 font-semibold tracking-wider uppercase -mt-1">
                Adaptive AI
              </span>
            </div>
          </NavLink>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group border',
                    isActive
                      ? 'bg-indigo-600 text-white font-bold shadow-[0_0_18px_rgba(99,102,241,0.45)] border-indigo-400/40'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 hover:border-slate-800 hover:shadow-[0_0_12px_rgba(99,102,241,0.12)]'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={clsx(
                          'w-4 h-4 transition-colors',
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={clsx(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                          isActive
                            ? 'bg-indigo-700 text-white'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800/60 shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Mini Profile Card */}
        <div className="p-3 border-t border-slate-800/80">
          <NavLink
            to="/settings"
            onClick={onClose}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/80 transition-colors group cursor-pointer"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User'}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/50 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                {(user?.name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                {user?.name || 'My Profile'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user?.course ? `${user.course}${user.year ? ` • ${user.year}` : ''}` : 'Set up profile'}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-slate-900" title="Connected" />
          </NavLink>
        </div>
      </aside>
    </>
  );
};
