import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Mail,
  Lock,
  ArrowRight,
  User,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { validatePassword, getStrengthColor } from '../utils/passwordSecurity';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, signUp, resetPassword, authError, clearError } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const passwordValidation = validatePassword(password);
  const strengthInfo = getStrengthColor(passwordValidation.strength);
  const passwordsMatch = mode === 'signup' && confirmPassword.length > 0 ? password === confirmPassword : true;

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

    if (mode === 'signup') {
      if (!passwordValidation.isValid) {
        setLocalError(`Please satisfy all password security requirements: ${passwordValidation.errors.join(', ')}.`);
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match. Please re-enter your confirm password.');
        return;
      }
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
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Visual Brand Panel */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/25">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <span className="text-xl font-bold tracking-tight">Helix</span>
            </div>
            <div className="mt-12">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Deterministic Adaptive Planner
              </span>
              <h2 className="text-2xl font-extrabold mt-4 leading-tight">
                Master your semester with enterprise-grade security.
              </h2>
              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                Deterministic capacity balancing, human-verified syllabus intelligence, and focused study routines protected with PostgreSQL Row Level Security.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Private & Secure</p>
              <p className="text-[11px] text-slate-400">Strong encryption & PostgreSQL RLS isolation</p>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-slate-900">Helix</span>
          </div>

          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {mode === 'signup'
                ? 'Create your secure account'
                : mode === 'reset'
                ? 'Reset your password'
                : 'Welcome back'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'signup'
                ? 'Set up your authenticated credentials with strong password protection'
                : mode === 'reset'
                ? 'Enter your email to receive a password reset link'
                : 'Sign in to access your timetable, syllabus, and study hub'}
            </p>
          </div>

          {activeError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{activeError}</span>
            </div>
          )}

          {resetSent && mode === 'reset' && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
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
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'signup' ? 'Create a strong password (min 8 chars)' : 'Enter your password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Real-time Password Security Meter (Sign Up Mode) */}
                {mode === 'signup' && password.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5 transition-all">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Password Strength:</span>
                      <span className={`font-bold ${strengthInfo.color}`}>{strengthInfo.label}</span>
                    </div>

                    {/* 4-Segment Strength Progress Bar */}
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map(step => (
                        <div
                          key={step}
                          className={`h-full rounded-full transition-all duration-300 ${
                            (passwordValidation.score >= 5 && step <= 4) ||
                            (passwordValidation.score === 4 && step <= 3) ||
                            (passwordValidation.score >= 2 && step <= 2) ||
                            (passwordValidation.score >= 1 && step <= 1)
                              ? strengthInfo.bgColor
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Security Checklist */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${passwordValidation.rules.minLength ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        {passwordValidation.rules.minLength ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                        <span>8+ Characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordValidation.rules.hasUppercase ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        {passwordValidation.rules.hasUppercase ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                        <span>Uppercase (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordValidation.rules.hasLowercase ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        {passwordValidation.rules.hasLowercase ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                        <span>Lowercase (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordValidation.rules.hasNumber ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        {passwordValidation.rules.hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                        <span>Number (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 col-span-2 ${passwordValidation.rules.hasSpecialChar ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        {passwordValidation.rules.hasSpecialChar ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                        <span>Special Symbol (!@#$%^&*)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirm Password Field (Sign Up Mode) */}
                {mode === 'signup' && (
                  <div className="pt-1">
                    <div className="relative">
                      <Input
                        label="Confirm Password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && (
                      <p className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </p>
                    )}
                  </div>
                )}

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
              className="mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-bold"
              rightIcon={mode !== 'reset' ? <ArrowRight className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            >
              {mode === 'signup'
                ? 'Create Secure Account'
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
