import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';

export class ProfileService {
  public static async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found
          return null;
        }
        console.warn('Error fetching profile from Supabase:', error.message);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        name: data.name || '',
        email: data.email || '',
        avatarUrl: data.avatar_url,
        course: data.course || '',
        stream: data.stream || '',
        year: data.year || '',
        enrolledSubjects: data.enrolled_subjects || [],
        theme: data.theme || 'light',
        eyeComfortWarmth: data.eye_comfort_warmth ?? 50,
        reminderTimings: data.reminder_timings || ['10_min', '30_min', 'at_start'],
        notificationPreferences: data.notification_preferences || { inApp: true, fcmPush: true },
      };
    } catch (err: any) {
      console.warn('Profile fetch exception:', err.message);
      return null;
    }
  }

  public static async upsertProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile | null> {
    try {
      // Also cache to localStorage immediately for instant offline/session access
      try {
        const cached = localStorage.getItem('helix_user_profile');
        const existing = cached ? JSON.parse(cached) : {};
        localStorage.setItem('helix_user_profile', JSON.stringify({ ...existing, ...profile }));
      } catch (storageErr) {
        console.warn('LocalStorage profile save error:', storageErr);
      }

      const payload: any = {
        id: profile.id,
        updated_at: new Date().toISOString(),
      };

      if (profile.name !== undefined) payload.name = profile.name;
      if (profile.email !== undefined) payload.email = profile.email;
      if (profile.avatarUrl !== undefined) payload.avatar_url = profile.avatarUrl;
      if (profile.course !== undefined) payload.course = profile.course;
      if (profile.stream !== undefined) payload.stream = profile.stream;
      if (profile.year !== undefined) payload.year = profile.year;
      if (profile.enrolledSubjects !== undefined) payload.enrolled_subjects = profile.enrolledSubjects;
      if (profile.theme !== undefined) payload.theme = profile.theme;
      if (profile.eyeComfortWarmth !== undefined) payload.eye_comfort_warmth = profile.eyeComfortWarmth;
      if (profile.reminderTimings !== undefined) payload.reminder_timings = profile.reminderTimings;
      if (profile.notificationPreferences !== undefined) payload.notification_preferences = profile.notificationPreferences;

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      if (error) {
        console.warn('Error upserting profile in Supabase (falling back to local):', error.message);
        return {
          id: profile.id,
          name: profile.name || '',
          email: profile.email || '',
          avatarUrl: profile.avatarUrl,
          course: profile.course || '',
          stream: profile.stream || '',
          year: profile.year || '',
          enrolledSubjects: profile.enrolledSubjects || [],
          theme: profile.theme || 'light',
          eyeComfortWarmth: profile.eyeComfortWarmth ?? 50,
          reminderTimings: profile.reminderTimings || ['10_min', '30_min', 'at_start'],
          notificationPreferences: profile.notificationPreferences || { inApp: true, fcmPush: true },
          dayPreferences: profile.dayPreferences,
        };
      }

      return {
        id: data.id,
        name: data.name || '',
        email: data.email || '',
        avatarUrl: data.avatar_url,
        course: data.course || '',
        stream: data.stream || '',
        year: data.year || '',
        enrolledSubjects: data.enrolled_subjects || [],
        theme: data.theme || 'light',
        eyeComfortWarmth: data.eye_comfort_warmth ?? 50,
        reminderTimings: data.reminder_timings || ['10_min', '30_min', 'at_start'],
        notificationPreferences: data.notification_preferences || { inApp: true, fcmPush: true },
      };
    } catch (err: any) {
      console.warn('Profile upsert exception:', err.message);
      return null;
    }
  }
}
