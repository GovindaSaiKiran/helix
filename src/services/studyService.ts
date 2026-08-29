import { supabase } from '../lib/supabaseClient';
import { Subject, SyllabusUnit, SyllabusTopic, StudyMaterial, Quiz, QuizResult } from '../types';
import { SubjectService } from './subjectService';

export class StudyService {
  public static async getSubjects(userId?: string): Promise<Subject[]> {
    return SubjectService.getSubjects(userId);
  }

  public static async getUnitsBySubject(subjectId: string): Promise<SyllabusUnit[]> {
    if (!subjectId) return [];

    // Check local storage units cache first
    try {
      const stored = localStorage.getItem(`helix_units_${subjectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading local syllabus units:', e);
    }

    try {
      const { data: unitsData, error: unitsError } = await supabase
        .from('syllabus_units')
        .select('*, syllabus_topics(*)')
        .eq('subject_id', subjectId)
        .order('unit_number', { ascending: true });

      if (!unitsError && unitsData && unitsData.length > 0) {
        const units: SyllabusUnit[] = unitsData.map((u: any) => ({
          id: u.id,
          subjectId: u.subject_id,
          unitNumber: Number(u.unit_number) || 1,
          title: u.title,
          progress: Number(u.progress) || 0,
          status: u.status || 'pending',
          topics: (u.syllabus_topics || [])
            .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
            .map((t: any) => ({
              id: t.id,
              unitId: t.unit_id,
              title: t.title,
              description: t.description || '',
              order: Number(t.order_index) || 1,
              status: t.status || 'pending',
              progress: Number(t.progress) || 0,
              estimatedMinutes: Number(t.estimated_minutes) || 45,
              masteryScore: Number(t.mastery_score) || 0,
              keyPoints: t.key_points || [],
              simplifiedExplanation: t.simplified_explanation || undefined,
              fullExplanation: t.full_explanation || undefined,
              examples: t.examples || [],
              examTips: t.exam_tips || [],
              youtubeRecommendations: t.youtube_recommendations || [],
            })),
        }));

        localStorage.setItem(`helix_units_${subjectId}`, JSON.stringify(units));
        return units;
      }
    } catch (err: any) {
      console.warn('StudyService getUnitsBySubject error:', err.message);
    }

    return [];
  }

  public static async createUnitWithTopics(
    userId: string,
    subjectId: string,
    unit: { unitNumber: number; title: string; topics: Array<{ title: string; estimatedMinutes?: number }> }
  ): Promise<SyllabusUnit | null> {
    const unitId = `unit_${subjectId}_${Date.now()}`;
    const newUnit: SyllabusUnit = {
      id: unitId,
      subjectId,
      unitNumber: unit.unitNumber,
      title: unit.title,
      progress: 0,
      status: 'pending',
      topics: unit.topics.map((t, idx) => ({
        id: `top_${unitId}_${idx + 1}`,
        unitId,
        title: t.title,
        description: 'Key syllabus topic for university exam preparation',
        order: idx + 1,
        status: 'pending',
        progress: 0,
        estimatedMinutes: t.estimatedMinutes || 45,
      })),
    };

    // Save locally
    try {
      const existing = await this.getUnitsBySubject(subjectId);
      const updated = [...existing, newUnit];
      localStorage.setItem(`helix_units_${subjectId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving local unit:', e);
    }

    // Try Supabase in background
    try {
      if (userId && !userId.startsWith('usr_local')) {
        const { data: unitRow } = await supabase
          .from('syllabus_units')
          .insert({
            user_id: userId,
            subject_id: subjectId,
            unit_number: unit.unitNumber,
            title: unit.title,
            progress: 0,
            status: 'pending',
          })
          .select()
          .single();

        if (unitRow) {
          const topicRows = unit.topics.map((t, idx) => ({
            user_id: userId,
            unit_id: unitRow.id,
            subject_id: subjectId,
            title: t.title,
            order_index: idx + 1,
            status: 'pending',
            progress: 0,
            estimated_minutes: t.estimatedMinutes || 45,
            mastery_score: 0,
          }));
          await supabase.from('syllabus_topics').insert(topicRows);
        }
      }
    } catch (err: any) {
      console.warn('createUnitWithTopics remote sync notice:', err.message);
    }

    return newUnit;
  }

  public static async getMaterials(userId?: string, subjectId?: string): Promise<StudyMaterial[]> {
    try {
      let query = supabase.from('study_materials').select('*').order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      if (subjectId) query = query.eq('subject_id', subjectId);

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching study materials:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        subjectId: row.subject_id,
        topicId: row.topic_id || undefined,
        title: row.title,
        fileType: row.file_type || 'notes',
        fileSize: row.file_size || '1.2 MB',
        uploadedAt: new Date(row.created_at).toLocaleDateString(),
        fileUrl: row.file_url || undefined,
      }));
    } catch (err: any) {
      console.warn('StudyService getMaterials error:', err.message);
      return [];
    }
  }

  public static async createMaterial(
    userId: string,
    material: Omit<StudyMaterial, 'id' | 'uploadedAt'>
  ): Promise<StudyMaterial | null> {
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .insert({
          user_id: userId,
          subject_id: material.subjectId,
          topic_id: material.topicId || null,
          title: material.title,
          file_type: material.fileType,
          file_size: material.fileSize || '1.5 MB',
          file_url: material.fileUrl || null,
        })
        .select()
        .single();

      if (error) {
        console.warn('Error creating study material in Supabase:', error.message);
        return null;
      }

      return {
        id: data.id,
        subjectId: data.subject_id,
        topicId: data.topic_id || undefined,
        title: data.title,
        fileType: data.file_type,
        fileSize: data.file_size,
        uploadedAt: new Date(data.created_at).toLocaleDateString(),
        fileUrl: data.file_url || undefined,
      };
    } catch (err: any) {
      console.warn('createMaterial error:', err.message);
      return null;
    }
  }

  public static async deleteMaterial(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('study_materials').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }
}

export const studyService = StudyService;
