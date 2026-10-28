import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, AppTheme } from '../types';
import { ProfileService } from '../services/profileService';
import { validatePassword } from '../utils/passwordSecurity';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
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

function mapFirebaseAuthError(err: any): string {
  if (!err?.code) return err?.message || 'Authentication failed.';
  switch (err.code) {
    case 'auth/user-not-found':
      return 'No registered account found with this email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Access temporarily disabled due to many failed attempts. Try again later.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Offline guest mode enabled.';
    default:
      return err.message || 'Authentication operation failed.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
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

  // Construct unified profile from Firebase user
  const buildProfileFromFirebase = (fbUser: FirebaseUser, cachedParsed?: any): UserProfile => {
    return {
      id: fbUser.uid,
      name: fbUser.displayName || cachedParsed?.name || fbUser.email?.split('@')[0] || 'Student',
      email: fbUser.email || '',
      avatarUrl: fbUser.photoURL || cachedParsed?.avatarUrl,
      course: cachedParsed?.course || 'B.Tech',
      stream: cachedParsed?.stream || 'Computer Science',
      year: cachedParsed?.year || '2nd Year',
      enrolledSubjects: cachedParsed?.enrolledSubjects || ['DBMS', 'DSA', 'Operating Systems', 'Mathematics'],
      theme: (cachedParsed?.theme as AppTheme) || theme || 'light',
      eyeComfortWarmth: cachedParsed?.eyeComfortWarmth ?? 50,
      reminderTimings: cachedParsed?.reminderTimings || ['10_min', '30_min', 'at_start'],
      notificationPreferences: cachedParsed?.notificationPreferences || { inApp: true, fcmPush: true },
    };
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!mounted) return;
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const profile = await ProfileService.getProfile(fbUser.uid);
          if (profile && mounted) {
            setUser(profile);
            if (profile.theme) setThemeState(profile.theme);
            localStorage.setItem('helix_user_profile', JSON.stringify(profile));
          } else if (mounted) {
            const cached = localStorage.getItem('helix_user_profile');
            const cachedParsed = cached ? JSON.parse(cached) : {};
            const newProfile = buildProfileFromFirebase(fbUser, cachedParsed);
            setUser(newProfile);
            localStorage.setItem('helix_user_profile', JSON.stringify(newProfile));
            await ProfileService.upsertProfile(newProfile);
          }
        } catch (err: any) {
          console.warn('[Firebase Auth] Profile sync notice:', err.message);
        }
      } else if (mounted) {
        // Fall back to local cached profile or default guest
        const cached = localStorage.getItem('helix_user_profile');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {
            setUser(defaultGuestProfile);
          }
        } else {
          setUser(defaultGuestProfile);
        }
      }

      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
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
      // Demo / Guest instant login bypass
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

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      let profile = await ProfileService.getProfile(fbUser.uid);
      if (!profile) {
        const cached = localStorage.getItem('helix_user_profile');
        const cachedParsed = cached ? JSON.parse(cached) : {};
        profile = buildProfileFromFirebase(fbUser, cachedParsed);
        await ProfileService.upsertProfile(profile);
      }

      setUser(profile);
      if (profile.theme) setThemeState(profile.theme);
      localStorage.setItem('helix_user_profile', JSON.stringify(profile));
      return { success: true };
    } catch (err: any) {
      console.warn('[Firebase Auth] Login error:', err);
      // Offline fallback: check cached user so user is never locked out
      const cached = localStorage.getItem('helix_user_profile');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.email && parsed.email.toLowerCase() === email.toLowerCase()) {
            setUser(parsed);
            return { success: true };
          }
        } catch {}
      }

      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      let profile = await ProfileService.getProfile(fbUser.uid);
      if (!profile) {
        const cached = localStorage.getItem('helix_user_profile');
        const cachedParsed = cached ? JSON.parse(cached) : {};
        profile = buildProfileFromFirebase(fbUser, cachedParsed);
        await ProfileService.upsertProfile(profile);
      }

      setUser(profile);
      if (profile.theme) setThemeState(profile.theme);
      localStorage.setItem('helix_user_profile', JSON.stringify(profile));
      return { success: true };
    } catch (err: any) {
      console.warn('[Firebase Auth] Google Sign-in error:', err);
      const msg = mapFirebaseAuthError(err);
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password || 'Password123!');
      const fbUser = userCredential.user;

      if (name) {
        try {
          await updateFirebaseProfile(fbUser, { displayName: name });
        } catch (profileErr) {
          console.warn('[Firebase Auth] Failed to update displayName:', profileErr);
        }
      }

      const cached = localStorage.getItem('helix_user_profile');
      const cachedParsed = cached ? JSON.parse(cached) : {};

      const newProfile: UserProfile = {
        id: fbUser.uid,
        name: name || fbUser.displayName || email.split('@')[0] || 'Student',
        email: fbUser.email || email,
        course: cachedParsed.course || 'B.Tech',
        stream: cachedParsed.stream || 'Computer Science',
        year: cachedParsed.year || '2nd Year',
        enrolledSubjects: cachedParsed.enrolledSubjects || ['DBMS', 'DSA', 'Operating Systems', 'Mathematics'],
        theme: (cachedParsed.theme as AppTheme) || theme || 'light',
        eyeComfortWarmth: cachedParsed.eyeComfortWarmth ?? 50,
        reminderTimings: ['10_min', '30_min', 'at_start'],
        notificationPreferences: { inApp: true, fcmPush: true },
      };

      setUser(newProfile);
      localStorage.setItem('helix_user_profile', JSON.stringify(newProfile));
      await ProfileService.upsertProfile(newProfile);

      return { success: true };
    } catch (err: any) {
      console.warn('[Firebase Auth] SignUp error:', err);
      const msg = mapFirebaseAuthError(err);
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
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err: any) {
      console.warn('[Firebase Auth] Password reset error:', err);
      const msg = mapFirebaseAuthError(err);
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
      await signOut(auth);
    } catch (err) {
      console.warn('[Firebase Auth] Signout error:', err);
    } finally {
      localStorage.removeItem('helix_user_profile');
      setUser(defaultGuestProfile);
      setFirebaseUser(null);
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
        firebaseUser,
        isAuthenticated: !!user,
        isLoading,
        authError,
        theme,
        setTheme,
        login,
        loginWithGoogle,
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
