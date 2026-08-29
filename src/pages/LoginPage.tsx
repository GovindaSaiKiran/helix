import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, ArrowRight, User, AlertCircle, ShieldCheck, CheckCircle2, KeyRound } from 'lucide-react';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, signUp, resetPassword, authError, clearError } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (mode === 'reset') {
      if (!email.trim()) {
        setLocalError('Please enter your registered email address.');
        return;
      }
      setIsLoading(true);
      try {
        const res = await resetPassword(email.trim());
        if (res.success) {
          setResetSent(true);
        } else {
          setLocalError(res.error || 'Failed to send password reset email.');
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const res = await signUp(email.trim(), password, name.trim());
        if (res.success) {
          navigate('/onboarding');
        } else {
          setLocalError(res.error || 'Failed to create account.');
        }
      } else {
        const res = await login(email.trim(), password);
        if (res.success) {
          navigate('/dashboard');
        } else {
          setLocalError(res.error || 'Invalid credentials or user not found.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Visual Brand Panel */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight">Helix</span>
            </div>
            <div className="mt-12">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Deterministic Adaptive Planner
              </span>
              <h2 className="text-2xl font-extrabold mt-4 leading-tight">
                Master your semester without academic burnout.
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Deterministic capacity balancing, human-verified syllabus intelligence, and focused study routines built for university students.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Private & Secure</p>
              <p className="text-[11px] text-slate-400">Authenticated data with PostgreSQL RLS</p>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-bold text-slate-900">Helix</span>
          </div>

          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {mode === 'signup'
                ? 'Create your account'
                : mode === 'reset'
                ? 'Reset your password'
                : 'Welcome back'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'signup'
                ? 'Set up your student credentials to start intelligent planning'
                : mode === 'reset'
                ? 'Enter your email to receive a password reset link'
                : 'Sign in to access your timetable, syllabus, and study hub'}
            </p>
          </div>

          {activeError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {resetSent && mode === 'reset' && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-bold">Password Reset Email Sent</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Please check your email inbox for instructions to reset your password.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Full Name"
                placeholder="e.g. Govinda"
                value={name}
                onChange={e => setName(e.target.value)}
                leftIcon={<User className="w-4 h-4 text-slate-400" />}
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. student@university.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              required
            />

            {mode !== 'reset' && (
              <div>
                <Input
                  label="Password"
                  type="password"
                  placeholder={mode === 'signup' ? 'Create a secure password (min 6 chars)' : 'Enter your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                  required
                />
                {mode === 'signin' && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setResetSent(false);
                        setLocalError(null);
                        clearError();
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="md"
              isLoading={isLoading}
              className="mt-2"
              rightIcon={mode !== 'reset' ? <ArrowRight className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            >
              {mode === 'signup'
                ? 'Create Free Account'
                : mode === 'reset'
                ? 'Send Reset Link'
                : 'Sign In to Helix'}
            </Button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              fullWidth
              size="md"
              onClick={async () => {
                setIsLoading(true);
                await login('demo@helix.edu');
                navigate('/dashboard');
              }}
              leftIcon={<Sparkles className="w-4 h-4 text-indigo-600" />}
            >
              Explore as Demo Student (1-Click)
            </Button>
          </form>

          {/* Toggle between Modes */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
            {mode === 'signup' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setLocalError(null);
                    clearError();
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            ) : mode === 'reset' ? (
              <p>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setLocalError(null);
                    clearError();
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Back to Sign In
                </button>
              </p>
            ) : (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setLocalError(null);
                    clearError();
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Create Account
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
