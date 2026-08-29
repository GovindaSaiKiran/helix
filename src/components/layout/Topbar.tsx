import React, { useState, useEffect } from 'react';
import { Menu, Bell, Plus, AlertCircle, RefreshCw, Check, Sun, Moon, Eye } from 'lucide-react';
import { Button } from '../common/Button';
import { usePlan } from '../../context/PlanContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { NavLink } from 'react-router-dom';

import { TaskService } from '../../services/taskService';

export interface TopbarProps {
  onOpenMobileMenu: () => void;
  onOpenUrgentModal: () => void;
  onOpenCommandPalette?: () => void;
  onOpenPomodoro?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileMenu,
  onOpenUrgentModal,
  onOpenCommandPalette,
  onOpenPomodoro,
}) => {
  const { schedule } = usePlan();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { theme, setTheme, user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Real Dynamic Student Streak Metrics
  const [streakCount, setStreakCount] = useState<number>(0);

  useEffect(() => {
    const calculateRealMetrics = async () => {
      try {
        const allTasks = await TaskService.getTasks(user?.id);
        const completedTasks = allTasks.filter(t => t.status === 'completed');

        // Calculate Real Consecutive Day Streak
        const uniqueCompletedDates = Array.from(
          new Set(
            completedTasks
              .map(t => t.scheduledDate || '')
              .filter(Boolean)
          )
        ).sort().reverse();

        if (uniqueCompletedDates.length === 0) {
          setStreakCount(0);
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let streak = 0;
        let checkDate = new Date();

        // If student completed a task today or yesterday, count back consecutive days
        if (uniqueCompletedDates.includes(today) || uniqueCompletedDates.includes(yesterday)) {
          if (!uniqueCompletedDates.includes(today)) {
            checkDate = new Date(Date.now() - 86400000);
          }

          while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (uniqueCompletedDates.includes(dateStr)) {
              streak += 1;
              checkDate = new Date(checkDate.getTime() - 86400000);
            } else {
              break;
            }
          }
        }

        setStreakCount(streak);
      } catch (e) {
        console.warn('Real metrics calculation error:', e);
      }
    };

    calculateRealMetrics();
  }, [user?.id, schedule]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 transition-all">
      {/* Left side: Mobile menu & Quick Search Spotlight */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* ⌘K Command Bar Search Trigger with Glowing Hover */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center justify-between w-full max-w-xs px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-400 text-xs transition-all duration-200 cursor-pointer group hover:border-indigo-400/80 hover:shadow-[0_0_16px_rgba(99,102,241,0.22)] hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400 group-hover:text-indigo-600 transition-colors">🔍</span>
            <span className="text-slate-500 group-hover:text-slate-700 transition-colors">Quick actions & search...</span>
          </div>
          <kbd className="text-[10px] font-bold bg-white px-1.5 py-0.5 rounded-md border border-slate-200 text-slate-500 shadow-2xs group-hover:border-indigo-300">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right side: Student Gamification (Streak, XP, Pomodoro) & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real Student Streak Flame with Amber Glow */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.25)] transition-all hover:scale-105"
          title={`Daily Study Streak: ${streakCount} consecutive day(s) with completed tasks.`}
        >
          <span className="text-sm animate-pulse">🔥</span>
          <span>{streakCount} {streakCount === 1 ? 'Day' : 'Days'}</span>
        </div>

        {/* Pomodoro Focus Launcher with Glowing Hover */}
        <button
          onClick={onOpenPomodoro}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-[0_0_16px_rgba(99,102,241,0.3)] hover:-translate-y-0.5"
          title="Open Floating Study Session Timer & Stopwatch"
        >
          <span className="text-indigo-600">⏱</span>
          <span>Focus Timer</span>
        </button>

        {/* Theme Switcher Quick Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 cursor-pointer flex items-center justify-center hover:shadow-[0_0_12px_rgba(99,102,241,0.2)]"
            title={`Current Theme: ${theme}`}
            aria-label="Toggle theme appearance"
          >
            {theme === 'dark' ? (
              <Moon className="w-4.5 h-4.5 text-indigo-400" />
            ) : theme === 'eye-comfort' ? (
              <Eye className="w-4.5 h-4.5 text-amber-500" />
            ) : (
              <Sun className="w-4.5 h-4.5 text-amber-500" />
            )}
          </button>

          {showThemeMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowThemeMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 z-50 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Appearance
                </div>
                <button
                  onClick={() => {
                    setTheme('light');
                    setShowThemeMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                    theme === 'light' ? 'text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Light Mode</span>
                  {theme === 'light' && <Check className="w-3.5 h-3.5 ml-auto text-indigo-600" />}
                </button>

                <button
                  onClick={() => {
                    setTheme('dark');
                    setShowThemeMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                    theme === 'dark' ? 'text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>Dark Mode</span>
                  {theme === 'dark' && <Check className="w-3.5 h-3.5 ml-auto text-indigo-600" />}
                </button>

                <button
                  onClick={() => {
                    setTheme('eye-comfort');
                    setShowThemeMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                    theme === 'eye-comfort' ? 'text-amber-700 bg-amber-50/50 dark:bg-amber-950/40' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Eye className="w-4 h-4 text-amber-600" />
                  <span>Eye Comfort (Warm)</span>
                  {theme === 'eye-comfort' && <Check className="w-3.5 h-3.5 ml-auto text-amber-600" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer hover:shadow-[0_0_12px_rgba(99,102,241,0.2)]"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-950 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                          !n.read ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                          <span className="text-[10px] text-slate-400 shrink-0">{n.createdAt}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                        {n.actionUrl && (
                          <NavLink
                            to={n.actionUrl}
                            onClick={() => setShowNotifications(false)}
                            className="inline-block text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold mt-1.5"
                          >
                            View Details →
                          </NavLink>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-center">
                  <NavLink
                    to="/settings"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium"
                  >
                    Notification Settings
                  </NavLink>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
