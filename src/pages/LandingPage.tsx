import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sparkles, Calendar, BookOpen, Bell, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/20 text-slate-900 flex flex-col">
      {/* Landing Navbar */}
      <header className="h-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xs px-6 lg:px-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Helix</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</a>
          <a href="#adaptive-replanning" className="hover:text-indigo-600 transition-colors">Adaptive Replanning</a>
          <NavLink to="/study" className="hover:text-indigo-600 transition-colors">Study Hub</NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <NavLink to="/login">
            <Button variant="ghost" size="sm">Log In</Button>
          </NavLink>
          <NavLink to="/onboarding">
            <Button size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>Get Started</Button>
          </NavLink>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Deterministic & AI Student Planning</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl leading-tight">
          Your plan should <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-600">adapt to your life</span>.
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mt-6 leading-relaxed">
          AI planning that balances your syllabus, goals, deadlines, projects, and availability — automatically adapting when life changes.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <NavLink to="/onboarding">
            <Button size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
              Get Started Free
            </Button>
          </NavLink>
          <NavLink to="/dashboard">
            <Button size="lg" variant="outline">
              Explore Live Dashboard
            </Button>
          </NavLink>
        </div>

        {/* Feature Pill Row matching Visual Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mt-16 text-left">
          <Card className="border-slate-200 hover:border-indigo-300" padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Adaptive Planning</h4>
                <p className="text-xs text-slate-500 mt-0.5">Smart schedules that adapt to life</p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 hover:border-indigo-300" padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Syllabus Intelligence</h4>
                <p className="text-xs text-slate-500 mt-0.5">Understands your course & topics</p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 hover:border-indigo-300" padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Smart Reminders</h4>
                <p className="text-xs text-slate-500 mt-0.5">Never miss what matters (FCM/Push)</p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 hover:border-indigo-300" padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Dynamic Replanning</h4>
                <p className="text-xs text-slate-500 mt-0.5">Adjusts instantly when urgent tasks arrive</p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        © 2026 Helix. Built for high-performance students. Focused and distraction-free.
      </footer>
    </div>
  );
};
