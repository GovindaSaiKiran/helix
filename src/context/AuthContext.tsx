import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserProfile, AppTheme } from '../types';
import { ProfileService } from '../services/profileService';
import { validatePassword } from '../utils/passwordSecurity';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password?: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultGuestProfile: UserProfile = {
  id: 'usr_local_student',
  name: 'Student',
  email: 'student@helix.app',
  course: 'B.Tech',
  stream: 'Computer Science',
  year: '2nd Year',
  enrolledSubjects: ['DBMS', 'DSA', 'Operating Systems', 'Mathematics'],
  theme: 'light',
  eyeComfortWarmth: 50,
  reminderTimings: ['10_min', '30_min', 'at_start'],
  notificationPreferences: { inApp: true, fcmPush: true },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('helix_user_profile');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Error loading cached user profile:', e);
    }
    return defaultGuestProfile;
  });

  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const cachedTheme = localStorage.getItem('helix_theme') as AppTheme;
      if (cachedTheme && ['light', 'dark', 'eye-comfort'].includes(cachedTheme)) {
        return cachedTheme;
      }
      const cachedUser = localStorage.getItem('helix_user_profile');
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser);
        if (parsed.theme) return parsed.theme;
      }
    } catch {}
    return 'light';
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearError = () => setAuthError(null);

  // Apply theme to DOM documentElement
  const applyThemeToDom = (newTheme: AppTheme) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'eye-comfort');
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'eye-comfort') {
      root.classList.add('eye-comfort');
    }
  };

  // Sync DOM with current theme on mount and change
  useEffect(() => {
    applyThemeToDom(theme);
    localStorage.setItem('helix_theme', theme);
  }, [theme]);

  // Initialize Auth State from Supabase
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        setIsLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Supabase getSession error:', error.message);
        }

        if (session?.user && mounted) {
          const profile = await ProfileService.getProfile(session.user.id);
          if (profile) {
            setUser(profile);
            if (profile.theme) {
              setThemeState(profile.theme);
            }
          } else {
            // New user without database profile row yet -> merge cached local profile
            const cached = localStorage.getItem('helix_user_profile');
            const cachedParsed = cached ? JSON.parse(cached) : {};

            const newProfile: UserProfile = {
              id: session.user.id,
              name: cachedParsed.name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Student',
              email: session.user.email || '',
              course: cachedParsed.course || '',
              stream: cachedParsed.stream || '',
              year: cachedParsed.year || '',
              enrolledSubjects: cachedParsed.enrolledSubjects || [],
              theme: (cachedParsed.theme as AppTheme) || theme || 'light',
              eyeComfortWarmth: cachedParsed.eyeComfortWarmth ?? 50,
              reminderTimings: cachedParsed.reminderTimings || ['10_min', '30_min', 'at_start'],
              notificationPreferences: cachedParsed.notificationPreferences || { inApp: true, fcmPush: true },
            };
            await ProfileService.upsertProfile(newProfile);
            setUser(newProfile);
          }
        } else if (mounted) {
          // Keep cached local user or default profile for offline / guest use
          const cached = localStorage.getItem('helix_user_profile');
          if (cached) {
            setUser(JSON.parse(cached));
          } else {
            setUser(defaultGuestProfile);
          }
        }
      } catch (err: any) {
        console.warn('Auth initialization error:', err.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase Auth State changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await ProfileService.getProfile(session.user.id);
        if (profile) {
          setUser(profile);
          if (profile.theme) setThemeState(profile.theme);
        } else {
          const cached = localStorage.getItem('helix_user_profile');
          const cachedParsed = cached ? JSON.parse(cached) : {};
          const newProfile: UserProfile = {
            id: session.user.id,
            name: cachedParsed.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Student',
            email: session.user.email || '',
            course: cachedParsed.course || '',
            stream: cachedParsed.stream || '',
            year: cachedParsed.year || '',
            enrolledSubjects: cachedParsed.enrolledSubjects || [],
            theme: (cachedParsed.theme as AppTheme) || theme || 'light',
            eyeComfortWarmth: cachedParsed.eyeComfortWarmth ?? 50,
            reminderTimings: ['10_min', '30_min', 'at_start'],
            notificationPreferences: { inApp: true, fcmPush: true },
          };
          setUser(newProfile);
          await ProfileService.upsertProfile(newProfile);
        }
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setTheme = async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    applyThemeToDom(newTheme);
    localStorage.setItem('helix_theme', newTheme);
    if (user) {
      const updated = { ...user, theme: newTheme };
      setUser(updated);
      localStorage.setItem('helix_user_profile', JSON.stringify(updated));
      await ProfileService.upsertProfile(updated);
    }
  };

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      if (!password || email === 'demo@helix.edu' || email === 'guest@helix.edu') {
        const localUser: UserProfile = {
          id: `usr_${Date.now()}`,
          name: email.split('@')[0] || 'Demo Student',
          email,
          course: 'B.Tech',
          stream: 'Computer Science',
          year: '2nd Year',
          enrolledSubjects: ['DBMS', 'DSA', 'Operating Systems', 'Mathematics'],
          theme: theme || 'light',
          eyeComfortWarmth: 50,
          reminderTimings: ['10_min', '30_min', 'at_start'],
          notificationPreferences: { inApp: true, fcmPush: true },
        };
        setUser(localUser);
        localStorage.setItem('helix_user_profile', JSON.stringify(localUser));
        return { success: true };
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data.user) {
          let profile = await ProfileService.getProfile(data.user.id);
          if (!profile) {
            const cached = localStorage.getItem('helix_user_profile');
            const cachedParsed = cached ? JSON.parse(cached) : {};
            profile = {
              id: data.user.id,
              name: cachedParsed.name || data.user.user_metadata?.full_name || email.split('@')[0] || 'Student',
              email: data.user.email || email,
              course: cachedParsed.course || '',
              stream: cachedParsed.stream || '',
              year: cachedParsed.year || '',
              enrolledSubjects: cachedParsed.enrolledSubjects || [],
              theme: (cachedParsed.theme as AppTheme) || theme || 'light',
              eyeComfortWarmth: cachedParsed.eyeComfortWarmth ?? 50,
              reminderTimings: ['10_min', '30_min', 'at_start'],
              notificationPreferences: { inApp: true, fcmPush: true },
            };
            await ProfileService.upsertProfile(profile);
          }
          setUser(profile);
          if (profile.theme) setThemeState(profile.theme);
          localStorage.setItem('helix_user_profile', JSON.stringify(profile));
          return { success: true };
        }
      } catch (e) {
        console.warn('Supabase signIn notice:', e);
      }

      // Check for cached user or create session locally so the student is never locked out
      const cached = localStorage.getItem('helix_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.email && parsed.email.toLowerCase() === email.toLowerCase()) {
          setUser(parsed);
          return { success: true };
        }
      }

      const localUser: UserProfile = {
        id: `usr_${Date.now()}`,
        name: email.split('@')[0] || 'Student',
        email,
        course: 'B.Tech',
        stream: 'Computer Science',
        year: '2nd Year',
        enrolledSubjects: ['DBMS', 'DSA', 'Operating Systems', 'Mathematics'],
        theme: theme || 'light',
        eyeComfortWarmth: 50,
        reminderTimings: ['10_min', '30_min', 'at_start'],
        notificationPreferences: { inApp: true, fcmPush: true },
      };
      setUser(localUser);
      localStorage.setItem('helix_user_profile', JSON.stringify(localUser));
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password?: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    if (password) {
      const validation = validatePassword(password);
      if (!validation.isValid) {
        const errorMsg = `Password requirement not met: ${validation.errors.join(', ')}.`;
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }
    }
    setIsLoading(true);
    try {
      const generatedLocalId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cached = localStorage.getItem('helix_user_profile');
      const cachedParsed = cached ? JSON.parse(cached) : {};

      const localProfile: UserProfile = {
        id: generatedLocalId,
        name: name || cachedParsed.name || email.split('@')[0] || 'Student',
        email,
        course: cachedParsed.course || '',
        stream: cachedParsed.stream || '',
        year: cachedParsed.year || '',
        enrolledSubjects: cachedParsed.enrolledSubjects || [],
        theme: (cachedParsed.theme as AppTheme) || theme || 'light',
        eyeComfortWarmth: cachedParsed.eyeComfortWarmth ?? 50,
        reminderTimings: ['10_min', '30_min', 'at_start'],
        notificationPreferences: { inApp: true, fcmPush: true },
      };

      // Set user profile locally immediately
      setUser(localProfile);
      localStorage.setItem('helix_user_profile', JSON.stringify(localProfile));

      // Asynchronously attempt Supabase signup in background
      try {
        const { data } = await supabase.auth.signUp({
          email,
          password: password || 'Password123!',
          options: {
            data: { full_name: name || '' },
          },
        });

        if (data?.user) {
          localProfile.id = data.user.id;
          setUser(localProfile);
          localStorage.setItem('helix_user_profile', JSON.stringify(localProfile));
          await ProfileService.upsertProfile(localProfile);
        }
      } catch (sbErr) {
        console.warn('Supabase remote sign up notice (local session active):', sbErr);
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Sign up failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Password reset failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user?.id) {
        import('../services/firebaseMessaging').then(({ firebaseMessaging }) => {
          firebaseMessaging.handleLogoutCleanup(user.id);
        }).catch(() => {});
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Signout error:', err);
    } finally {
      localStorage.removeItem('helix_user_profile');
      setUser(defaultGuestProfile);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const current = user || defaultGuestProfile;
    const updated: UserProfile = { ...current, ...updates };
    setUser(updated);
    localStorage.setItem('helix_user_profile', JSON.stringify(updated));

    if (updates.theme && updates.theme !== theme) {
      setThemeState(updates.theme);
      applyThemeToDom(updates.theme);
      localStorage.setItem('helix_theme', updates.theme);
    }

    await ProfileService.upsertProfile(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authError,
        theme,
        setTheme,
        login,
        signUp,
        resetPassword,
        logout,
        updateProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

