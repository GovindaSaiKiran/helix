import { supabase } from '../lib/supabaseClient';
import { Subject, PriorityLevel } from '../types';

const STORAGE_KEY = 'helix_local_subjects';

const defaultColors = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316'];

export class SubjectService {
  private static getStoredSubjects(): Subject[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Purge legacy mock subjects
          const mockIds = ['sub_dbms', 'sub_dsa', 'sub_os', 'sub_cpp', 'sub_maths', 'sub_react'];
          const cleanSubjects = parsed.filter(s => !mockIds.includes(s.id));
          if (cleanSubjects.length !== parsed.length) {
            this.saveStoredSubjects(cleanSubjects);
          }
          return cleanSubjects;
        }
      }
    } catch (e) {
      console.warn('Error reading stored subjects:', e);
    }

    // Check user profile for enrolled subjects
    let initialSubjects: Subject[] = [];
    try {
      const profileStr = localStorage.getItem('helix_user_profile');
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        if (Array.isArray(profile.enrolledSubjects) && profile.enrolledSubjects.length > 0) {
          initialSubjects = profile.enrolledSubjects.map((name: string, idx: number) => ({
            id: `sub_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx}`,
            name,
            code: `SUB${101 + idx}`,
            color: defaultColors[idx % defaultColors.length],
            syllabusCoverage: 0,
            totalUnits: 5,
            completedUnits: 0,
            targetGrade: 'A',
            priority: 'medium' as PriorityLevel,
          }));
        }
      }
    } catch {}

    this.saveStoredSubjects(initialSubjects);
    return initialSubjects;
  }

  private static saveStoredSubjects(subjects: Subject[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
    } catch (e) {
      console.warn('Error saving stored subjects:', e);
    }
  }

  public static async getSubjects(userId?: string): Promise<Subject[]> {
    let localSubjects = this.getStoredSubjects();

    // Reconcile with user enrolledSubjects if defined in profile
    try {
      const profileStr = localStorage.getItem('helix_user_profile');
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        if (Array.isArray(profile.enrolledSubjects)) {
          const enrolledList: string[] = profile.enrolledSubjects;
          if (enrolledList.length === 0) {
            // User explicitly cleared enrolled subjects
            localSubjects = [];
            this.saveStoredSubjects([]);
            return [];
          }

          // Filter local subjects to ONLY match enrolled subjects
          const filtered = localSubjects.filter(s =>
            enrolledList.some(e => e.toLowerCase() === s.name.toLowerCase())
          );

          // Add any missing enrolled subjects
          for (let i = 0; i < enrolledList.length; i++) {
            const subName = enrolledList[i];
            if (!filtered.some(s => s.name.toLowerCase() === subName.toLowerCase())) {
              filtered.push({
                id: `sub_${subName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${i}`,
                name: subName,
                code: `SUB${101 + i}`,
                color: defaultColors[i % defaultColors.length],
                syllabusCoverage: 0,
                totalUnits: 5,
                completedUnits: 0,
                targetGrade: 'A',
                priority: 'medium' as PriorityLevel,
              });
            }
          }
          localSubjects = filtered;
          this.saveStoredSubjects(localSubjects);
        }
      }
    } catch {}

    try {
      if (userId && !userId.startsWith('usr_local')) {
        let query = supabase.from('subjects').select('*').order('created_at', { ascending: true });
        query = query.eq('user_id', userId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const remoteSubjects: Subject[] = data.map((row: any) => ({
            id: row.id,
            name: row.name,
            code: row.code || '',
            color: row.color || '#6366F1',
            syllabusCoverage: Number(row.syllabus_coverage) || 0,
            totalUnits: Number(row.total_units) || 0,
            completedUnits: Number(row.completed_units) || 0,
            targetGrade: row.target_grade || undefined,
            priority: row.priority || 'medium',
          }));

          const merged = [...remoteSubjects];
          for (const ls of localSubjects) {
            if (!merged.some(m => m.id === ls.id)) {
              merged.push(ls);
            }
          }
          this.saveStoredSubjects(merged);
          return merged;
        }
      }
    } catch (err: any) {
      console.warn('SubjectService getSubjects remote fallback:', err.message);
    }

    return localSubjects;
  }

  public static async createSubject(
    userId: string,
    subject: Omit<Subject, 'id'>
  ): Promise<Subject | null> {
    const localSubjects = this.getStoredSubjects();
    const generatedId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newSubject: Subject = {
      id: generatedId,
      name: subject.name.trim(),
      code: subject.code?.trim() || '',
      color: subject.color || '#6366F1',
      syllabusCoverage: subject.syllabusCoverage || 0,
      totalUnits: subject.totalUnits || 5,
      completedUnits: subject.completedUnits || 0,
      targetGrade: subject.targetGrade || 'A',
      priority: subject.priority || 'medium',
    };

    // Save locally
    const updatedSubjects = [...localSubjects, newSubject];
    this.saveStoredSubjects(updatedSubjects);

    // Sync with enrolledSubjects in user profile
    try {
      const profileStr = localStorage.getItem('helix_user_profile');
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        const enrolled = Array.isArray(profile.enrolledSubjects) ? profile.enrolledSubjects : [];
        if (!enrolled.includes(newSubject.name)) {
          profile.enrolledSubjects = [...enrolled, newSubject.name];
          localStorage.setItem('helix_user_profile', JSON.stringify(profile));
        }
      }
    } catch (e) {
      console.warn('Error syncing enrolledSubjects:', e);
    }

    // Asynchronously sync with Supabase if logged in
    try {
      if (userId && !userId.startsWith('usr_local')) {
        const { data, error } = await supabase
          .from('subjects')
          .insert({
            user_id: userId,
            name: newSubject.name,
            code: newSubject.code,
            color: newSubject.color,
            syllabus_coverage: newSubject.syllabusCoverage,
            total_units: newSubject.totalUnits,
            completed_units: newSubject.completedUnits,
            target_grade: newSubject.targetGrade || null,
            priority: newSubject.priority || 'medium',
          })
          .select()
          .single();

        if (!error && data) {
          newSubject.id = data.id;
          const updated = this.getStoredSubjects().map(s => (s.id === generatedId ? newSubject : s));
          this.saveStoredSubjects(updated);
        }
      }
    } catch (err: any) {
      console.warn('Supabase subject sync notice (persisted locally):', err.message);
    }

    return newSubject;
  }

  public static async updateSubject(id: string, updates: Partial<Subject>): Promise<boolean> {
    const subjects = this.getStoredSubjects();
    const updated = subjects.map(s => (s.id === id ? { ...s, ...updates } : s));
    this.saveStoredSubjects(updated);

    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.code !== undefined) payload.code = updates.code;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.syllabusCoverage !== undefined) payload.syllabus_coverage = updates.syllabusCoverage;
      if (updates.totalUnits !== undefined) payload.total_units = updates.totalUnits;
      if (updates.completedUnits !== undefined) payload.completed_units = updates.completedUnits;
      if (updates.targetGrade !== undefined) payload.target_grade = updates.targetGrade;
      if (updates.priority !== undefined) payload.priority = updates.priority;

      await supabase.from('subjects').update(payload).eq('id', id);
    } catch (err: any) {
      console.warn('Supabase updateSubject notice:', err.message);
    }

    return true;
  }

  public static async deleteSubject(id: string): Promise<boolean> {
    const subjects = this.getStoredSubjects();
    const target = subjects.find(s => s.id === id);
    const updated = subjects.filter(s => s.id !== id);
    this.saveStoredSubjects(updated);

    // Also remove from user profile enrolledSubjects
    if (target) {
      try {
        const profileStr = localStorage.getItem('helix_user_profile');
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          if (Array.isArray(profile.enrolledSubjects)) {
            profile.enrolledSubjects = profile.enrolledSubjects.filter(
              (name: string) => name.toLowerCase() !== target.name.toLowerCase()
            );
            localStorage.setItem('helix_user_profile', JSON.stringify(profile));
          }
        }
      } catch (e) {
        console.warn('Error updating profile enrolledSubjects on delete:', e);
      }

      // Remove cached units for this subject
      try {
        localStorage.removeItem(`helix_units_${id}`);
      } catch {}
    }

    try {
      await supabase.from('subjects').delete().eq('id', id);
    } catch (err: any) {
      console.warn('Supabase deleteSubject notice:', err.message);
    }

    return true;
  }
}

