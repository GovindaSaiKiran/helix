import { supabase } from '../lib/supabaseClient';

export const AUTH_REQUIRED_MESSAGE = 'Please sign in or log in to use this feature.';

export interface AuthGuardResult {
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  error?: string;
  message?: string;
}

/**
 * Centralized Authentication and Feature Access Guard for HELIX.
 * Protects AI, YouTube, Extraction, Task Mutations, and External API services.
 */
export class AuthGuard {
  /**
   * Check if a valid authenticated Supabase session exists.
   */
  public static async checkAuth(): Promise<AuthGuardResult> {
    try {
      // 1. Primary check: Verify live Supabase Auth session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session?.user?.id) {
        return {
          isAuthenticated: true,
          userId: session.user.id,
          userEmail: session.user.email || null,
        };
      }
    } catch (err) {
      console.warn('[AuthGuard] Supabase getSession note:', err);
    }

    // 2. Secondary check: Validate cached profile for verified authenticated UUID
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('helix_user_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          // Ensure it's not a guest/local dummy ID (e.g. usr_local_student)
          if (
            parsed?.id &&
            typeof parsed.id === 'string' &&
            !parsed.id.startsWith('usr_local') &&
            parsed?.email &&
            parsed.email.includes('@') &&
            !parsed.email.endsWith('@helix.app') // default guest email
          ) {
            return {
              isAuthenticated: true,
              userId: parsed.id,
              userEmail: parsed.email,
            };
          }
        }
      } catch (e) {
        console.warn('[AuthGuard] Cache check note:', e);
      }
    }

    // Unauthenticated
    return {
      isAuthenticated: false,
      userId: null,
      userEmail: null,
      error: 'AUTHENTICATION_REQUIRED',
      message: AUTH_REQUIRED_MESSAGE,
    };
  }

  /**
   * Synchronous quick check for fast UI rendering / guards.
   */
  public static isLocallyAuthenticated(): boolean {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    try {
      const cached = localStorage.getItem('helix_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Boolean(
          parsed?.id &&
          !parsed.id.startsWith('usr_local') &&
          parsed?.email &&
          !parsed.email.endsWith('@helix.app')
        );
      }
    } catch {}
    return false;
  }

  /**
   * Enforce authentication. Throws standard AUTH_REQUIRED_MESSAGE if unauthenticated.
   * Returns the authenticated user's ID.
   */
  public static async requireAuth(): Promise<string> {
    const result = await this.checkAuth();
    if (!result.isAuthenticated || !result.userId) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    return result.userId;
  }

  /**
   * Check if a specific feature capability requires authentication.
   */
  public static isProtectedCapability(capability: string): boolean {
    const protectedList = [
      'youtube_search',
      'gemini_ai',
      'groq_ai',
      'ai_chat',
      'ai_action',
      'syllabus_extraction',
      'pdf_extraction',
      'topic_generation',
      'quiz_generation',
      'ai_summarization',
      'ai_explanation',
      'ai_qa',
      'task_mutation',
      'project_mutation',
      'subject_mutation',
      'reminder_scheduling',
    ];

    return protectedList.includes(capability.toLowerCase());
  }
}

export const requireAuthenticatedUser = () => AuthGuard.requireAuth();
