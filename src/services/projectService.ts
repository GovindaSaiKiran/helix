import { supabase } from '../lib/supabaseClient';
import { Project } from '../types';

const STORAGE_KEY = 'helix_local_projects';

export class ProjectService {
  private static getStoredProjects(): Project[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Purge legacy mock projects
          const mockIds = ['proj_1', 'proj_2', 'proj_3', 'proj_4'];
          const cleanProjects = parsed.filter(p => !mockIds.includes(p.id));
          if (cleanProjects.length !== parsed.length) {
            this.saveStoredProjects(cleanProjects);
          }
          return cleanProjects;
        }
      }
    } catch (e) {
      console.warn('Error reading stored projects:', e);
    }
    return [];
  }

  private static saveStoredProjects(projects: Project[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.warn('Error saving stored projects:', e);
    }
  }

  public static async getProjects(
    userId?: string,
    filter?: 'all' | 'assignments' | 'projects' | 'goals'
  ): Promise<Project[]> {
    const localProjects = this.getStoredProjects();

    try {
      if (userId && !userId.startsWith('usr_local')) {
        let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
        query = query.eq('user_id', userId);

        if (filter && filter !== 'all') {
          if (filter === 'assignments') query = query.eq('category', 'assignment');
          else if (filter === 'projects') query = query.eq('category', 'project');
          else if (filter === 'goals') query = query.eq('category', 'goal');
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const remoteProjects: Project[] = data.map((row: any) => ({
            id: row.id,
            title: row.title,
            category: row.category || 'project',
            priority: row.priority || 'medium',
            status: row.status || 'pending',
            progress: Number(row.progress) || 0,
            dueDate: row.due_date || 'No deadline',
            createdDate: row.created_date || new Date(row.created_at).toLocaleDateString(),
            estimatedEffortHours: Number(row.estimated_effort_hours) || 0,
            remainingEffortHours: Number(row.remaining_effort_hours) || 0,
            dependencies: row.dependencies || [],
            modules: row.modules || [],
            notes: row.notes || '',
          }));

          const merged = [...remoteProjects];
          for (const lp of localProjects) {
            if (!merged.some(m => m.id === lp.id)) {
              merged.push(lp);
            }
          }
          this.saveStoredProjects(merged);

          if (filter && filter !== 'all') {
            return merged.filter(p => p.category === filter.slice(0, -1));
          }
          return merged;
        }
      }
    } catch (err: any) {
      console.warn('ProjectService getProjects remote fallback:', err.message);
    }

    if (filter && filter !== 'all') {
      const cat = filter === 'assignments' ? 'assignment' : filter === 'projects' ? 'project' : 'goal';
      return localProjects.filter(p => p.category === cat);
    }
    return localProjects;
  }

  public static async getProjectById(id: string): Promise<Project | null> {
    const local = this.getStoredProjects().find(p => p.id === id);
    if (local) return local;

    try {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (!error && data) {
        return {
          id: data.id,
          title: data.title,
          category: data.category,
          priority: data.priority,
          status: data.status,
          progress: Number(data.progress),
          dueDate: data.due_date || 'No deadline',
          createdDate: data.created_date || new Date(data.created_at).toLocaleDateString(),
          estimatedEffortHours: Number(data.estimated_effort_hours),
          remainingEffortHours: Number(data.remaining_effort_hours),
          dependencies: data.dependencies || [],
          modules: data.modules || [],
          notes: data.notes || '',
        };
      }
    } catch (err: any) {
      console.warn('ProjectService getProjectById error:', err.message);
    }

    return null;
  }

  public static async createProject(
    userId: string,
    project: Omit<Project, 'id' | 'createdDate'>
  ): Promise<Project | null> {
    const localProjects = this.getStoredProjects();
    const generatedId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newProject: Project = {
      id: generatedId,
      title: project.title,
      category: project.category || 'project',
      priority: project.priority || 'medium',
      status: project.status || 'pending',
      progress: project.progress || 0,
      dueDate: project.dueDate || 'No deadline',
      createdDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      estimatedEffortHours: project.estimatedEffortHours || 0,
      remainingEffortHours: project.remainingEffortHours || project.estimatedEffortHours || 0,
      dependencies: project.dependencies || [],
      modules: project.modules || [],
      notes: project.notes || '',
    };

    // Save locally first
    this.saveStoredProjects([newProject, ...localProjects]);

    // Asynchronously try Supabase if logged in
    try {
      if (userId && !userId.startsWith('usr_local')) {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            user_id: userId,
            title: newProject.title,
            category: newProject.category,
            priority: newProject.priority,
            status: newProject.status,
            progress: newProject.progress,
            due_date: newProject.dueDate,
            created_date: newProject.createdDate,
            estimated_effort_hours: newProject.estimatedEffortHours,
            remaining_effort_hours: newProject.remainingEffortHours,
            dependencies: newProject.dependencies,
            modules: newProject.modules,
            notes: newProject.notes,
          })
          .select()
          .single();

        if (!error && data) {
          newProject.id = data.id;
          const updated = this.getStoredProjects().map(p => (p.id === generatedId ? newProject : p));
          this.saveStoredProjects(updated);
        }
      }
    } catch (err: any) {
      console.warn('Supabase project sync notice (persisted locally):', err.message);
    }

    return newProject;
  }

  public static async updateProject(id: string, updates: Partial<Project>): Promise<boolean> {
    const projects = this.getStoredProjects();
    const updated = projects.map(p => (p.id === id ? { ...p, ...updates } : p));
    this.saveStoredProjects(updated);

    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.progress !== undefined) payload.progress = updates.progress;
      if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
      if (updates.estimatedEffortHours !== undefined) payload.estimated_effort_hours = updates.estimatedEffortHours;
      if (updates.remainingEffortHours !== undefined) payload.remaining_effort_hours = updates.remainingEffortHours;
      if (updates.dependencies !== undefined) payload.dependencies = updates.dependencies;
      if (updates.modules !== undefined) payload.modules = updates.modules;
      if (updates.notes !== undefined) payload.notes = updates.notes;

      await supabase.from('projects').update(payload).eq('id', id);
    } catch (err: any) {
      console.warn('Supabase updateProject notice:', err.message);
    }

    return true;
  }

  public static async deleteProject(id: string): Promise<boolean> {
    const projects = this.getStoredProjects();
    this.saveStoredProjects(projects.filter(p => p.id !== id));

    try {
      await supabase.from('projects').delete().eq('id', id);
    } catch (err: any) {
      console.warn('Supabase deleteProject notice:', err.message);
    }

    return true;
  }
}


export const projectService = ProjectService;
