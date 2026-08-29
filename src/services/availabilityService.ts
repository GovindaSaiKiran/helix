import { supabase } from '../lib/supabaseClient';
import { AvailabilityWindow, DayPreference, EnergyPeak } from '../types';

export const defaultDayPreferences: DayPreference[] = [
  {
    dayOfWeek: 'Mon',
    isEnabled: true,
    availableHours: 4,
    energyProfile: 'evening',
    selectedHourBlocks: [18, 19, 20, 21],
    timeSlots: [{ id: 'slot_mon_1', startTime: '18:00', endTime: '22:00', label: 'Evening Study' }],
  },
  {
    dayOfWeek: 'Tue',
    isEnabled: true,
    availableHours: 4,
    energyProfile: 'evening',
    selectedHourBlocks: [18, 19, 20, 21],
    timeSlots: [{ id: 'slot_tue_1', startTime: '18:00', endTime: '22:00', label: 'Evening Study' }],
  },
  {
    dayOfWeek: 'Wed',
    isEnabled: true,
    availableHours: 4,
    energyProfile: 'evening',
    selectedHourBlocks: [18, 19, 20, 21],
    timeSlots: [{ id: 'slot_wed_1', startTime: '18:00', endTime: '22:00', label: 'Evening Study' }],
  },
  {
    dayOfWeek: 'Thu',
    isEnabled: true,
    availableHours: 4,
    energyProfile: 'evening',
    selectedHourBlocks: [18, 19, 20, 21],
    timeSlots: [{ id: 'slot_thu_1', startTime: '18:00', endTime: '22:00', label: 'Evening Study' }],
  },
  {
    dayOfWeek: 'Fri',
    isEnabled: true,
    availableHours: 4,
    energyProfile: 'evening',
    selectedHourBlocks: [18, 19, 20, 21],
    timeSlots: [{ id: 'slot_fri_1', startTime: '18:00', endTime: '22:00', label: 'Evening Study' }],
  },
  {
    dayOfWeek: 'Sat',
    isEnabled: true,
    availableHours: 6,
    energyProfile: 'morning',
    selectedHourBlocks: [9, 10, 11, 14, 15, 16],
    timeSlots: [
      { id: 'slot_sat_1', startTime: '09:00', endTime: '12:00', label: 'Morning Deep Work' },
      { id: 'slot_sat_2', startTime: '14:00', endTime: '17:00', label: 'Afternoon Practice' },
    ],
  },
  {
    dayOfWeek: 'Sun',
    isEnabled: true,
    availableHours: 6,
    energyProfile: 'morning',
    selectedHourBlocks: [9, 10, 11, 14, 15, 16],
    timeSlots: [
      { id: 'slot_sun_1', startTime: '09:00', endTime: '12:00', label: 'Morning Deep Work' },
      { id: 'slot_sun_2', startTime: '14:00', endTime: '17:00', label: 'Afternoon Revision' },
    ],
  },
];

export class AvailabilityService {
  private static STORAGE_KEY = 'helix_day_preferences';

  public static getStoredPreferences(): DayPreference[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading stored day preferences:', e);
    }
    return defaultDayPreferences;
  }

  public static saveStoredPreferences(preferences: DayPreference[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.warn('Error writing stored day preferences:', e);
    }
  }

  public static async getPreferences(userId?: string): Promise<DayPreference[]> {
    const local = this.getStoredPreferences();
    if (!userId) return local;

    try {
      const { data, error } = await supabase
        .from('availability_windows')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error || !data || data.length === 0) {
        return local;
      }

      // Merge remote data with local rich day preferences
      const merged = local.map(day => {
        const row = data.find((r: any) => r.day_of_week === day.dayOfWeek);
        if (row) {
          return {
            ...day,
            availableHours: Number(row.available_hours) || day.availableHours,
            energyProfile: (row.energy_profile as EnergyPeak) || day.energyProfile,
          };
        }
        return day;
      });

      this.saveStoredPreferences(merged);
      return merged;
    } catch (err: any) {
      console.warn('AvailabilityService getPreferences error:', err.message);
      return local;
    }
  }

  public static async getAvailability(userId?: string): Promise<AvailabilityWindow[]> {
    const prefs = await this.getPreferences(userId);
    return prefs.map(p => ({
      dayOfWeek: p.dayOfWeek,
      availableHours: p.isEnabled ? p.availableHours : 0,
      plannedHours: 0,
      bufferHours: p.isEnabled ? Math.max(0.5, Number((p.availableHours * 0.25).toFixed(1))) : 0,
      energyProfile: p.energyProfile,
      selectedHourBlocks: p.selectedHourBlocks,
    }));
  }

  public static async updateDay(
    userId: string | undefined,
    dayOfWeek: AvailabilityWindow['dayOfWeek'],
    availableHours: number,
    energyProfile: EnergyPeak,
    selectedHourBlocks?: number[]
  ): Promise<boolean> {
    const current = this.getStoredPreferences();
    const updated = current.map(d =>
      d.dayOfWeek === dayOfWeek
        ? {
            ...d,
            availableHours,
            energyProfile,
            selectedHourBlocks: selectedHourBlocks || d.selectedHourBlocks,
          }
        : d
    );
    this.saveStoredPreferences(updated);

    if (!userId) return true;

    try {
      const { error } = await supabase
        .from('availability_windows')
        .upsert(
          {
            user_id: userId,
            day_of_week: dayOfWeek,
            available_hours: availableHours,
            buffer_hours: Math.max(0.5, Number((availableHours * 0.25).toFixed(1))),
            energy_profile: energyProfile,
          },
          { onConflict: 'user_id,day_of_week' }
        );

      if (error) {
        console.warn('Error updating availability in Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('AvailabilityService updateDay error:', err.message);
      return false;
    }
  }

  public static async saveAllPreferences(
    userId: string | undefined,
    preferences: DayPreference[]
  ): Promise<boolean> {
    this.saveStoredPreferences(preferences);

    if (!userId) return true;

    try {
      const rows = preferences.map(p => ({
        user_id: userId,
        day_of_week: p.dayOfWeek,
        available_hours: p.isEnabled ? p.availableHours : 0,
        buffer_hours: Math.max(0.5, Number((p.availableHours * 0.25).toFixed(1))),
        energy_profile: p.energyProfile,
      }));

      const { error } = await supabase
        .from('availability_windows')
        .upsert(rows, { onConflict: 'user_id,day_of_week' });

      if (error) {
        console.warn('Error saving all preferences to Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('AvailabilityService saveAllPreferences error:', err.message);
      return false;
    }
  }
}
