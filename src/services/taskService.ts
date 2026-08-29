import { supabase } from '../lib/supabaseClient';
import { Task, ScheduleSlot } from '../types';
import { SubjectService } from './subjectService';

const STORAGE_KEY = 'helix_local_tasks';

export class TaskService {
  private static getStoredTasks(): Task[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Purge legacy mock tasks
          const mockIds = ['task_dbms_1', 'task_cpp_1', 'task_os_1'];
          const cleanTasks = parsed.filter(t => !mockIds.includes(t.id));
          if (cleanTasks.length !== parsed.length) {
            this.saveStoredTasks(cleanTasks);
          }
          return cleanTasks;
        }
      }
    } catch (e) {
      console.warn('Error reading stored tasks:', e);
    }
    return [];
  }

  private static saveStoredTasks(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Error saving stored tasks:', e);
    }
  }

  public static async getTasks(userId?: string): Promise<Task[]> {
    const localTasks = this.getStoredTasks();

    try {
      if (userId && !userId.startsWith('usr_local')) {
        let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
        query = query.eq('user_id', userId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const remoteTasks: Task[] = data.map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
            subjectId: row.subject_id || undefined,
            projectId: row.project_id || undefined,
            type: row.type || 'study',
            priority: row.priority || 'medium',
            status: row.status || 'pending',
            estimatedMinutes: Number(row.estimated_minutes) || 45,
            completedMinutes: Number(row.actual_minutes) || 0,
            dueDate: row.due_date || undefined,
            scheduledDate: row.scheduled_date || new Date().toISOString().split('T')[0],
            scheduledStartTime: row.scheduled_start_time || '18:00',
            scheduledEndTime: row.scheduled_end_time || '18:45',
            isUrgent: Boolean(row.is_urgent),
            progress: Number(row.progress) || 0,
            difficulty: row.difficulty || 'medium',
            notes: row.notes || '',
          }));

          // Merge remote with local tasks (avoiding duplicate IDs)
          const merged = [...remoteTasks];
          for (const lt of localTasks) {
            if (!merged.some(m => m.id === lt.id)) {
              merged.push(lt);
            }
          }
          this.saveStoredTasks(merged);
          return merged;
        }
      }
    } catch (err: any) {
      console.warn('TaskService getTasks remote fallback:', err.message);
    }

    return localTasks;
  }

  public static async getTodaySchedule(userId?: string): Promise<ScheduleSlot[]> {
    const today = new Date().toISOString().split('T')[0];
    const allTasks = await this.getTasks(userId);
    const subjects = await SubjectService.getSubjects(userId);

    const subjectMap = new Map<string, string>();
    subjects.forEach(s => subjectMap.set(s.id, s.name));

    // Get today tasks or all pending/in_progress tasks
    const todayTasks = allTasks.filter(
      t => t.scheduledDate === today || t.status === 'in_progress' || t.status === 'pending'
    );

    return todayTasks.map(t => {
      const startTime = t.scheduledStartTime || '18:00';
      const endTime = t.scheduledEndTime || '18:45';
      const subjectName = t.subjectId ? subjectMap.get(t.subjectId) : undefined;

      return {
        id: t.id,
        timeSlot: `${startTime} - ${endTime}`,
        startTime,
        endTime,
        durationMinutes: t.estimatedMinutes,
        title: t.title,
        category: t.type === 'break' ? 'break' : t.type === 'project' ? 'project' : t.type === 'assignment' ? 'assignment' : 'study',
        subjectName: subjectName || (t.type === 'break' ? 'Rest Interval' : 'General Focus'),
        priority: t.priority,
        difficulty: t.difficulty,
        progress: t.progress,
        status: t.status,
        dueInfo: t.dueDate,
      };
    });
  }

  public static async createTask(userId: string, task: Partial<Task>): Promise<Task | null> {
    const localTasks = this.getStoredTasks();
    const generatedId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newTask: Task = {
      id: generatedId,
      title: task.title || 'Untitled Focus Task',
      description: task.description || '',
      subjectId: task.subjectId,
      projectId: task.projectId,
      type: task.type || 'study',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      estimatedMinutes: Number(task.estimatedMinutes) || 45,
      completedMinutes: Number(task.completedMinutes) || 0,
      dueDate: task.dueDate,
      scheduledDate: task.scheduledDate || new Date().toISOString().split('T')[0],
      scheduledStartTime: task.scheduledStartTime || '18:00',
      scheduledEndTime: task.scheduledEndTime || '18:45',
      isUrgent: Boolean(task.isUrgent),
      progress: task.progress || 0,
      difficulty: task.difficulty || 'medium',
      notes: task.notes || '',
    };

    // Save locally first so creation is instant and never fails
    this.saveStoredTasks([newTask, ...localTasks]);

    // Asynchronously try Supabase if user is logged in
    try {
      if (userId && !userId.startsWith('usr_local')) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title: newTask.title,
            description: newTask.description,
            subject_id: newTask.subjectId || null,
            project_id: newTask.projectId || null,
            type: newTask.type,
            priority: newTask.priority,
            status: newTask.status,
            estimated_minutes: newTask.estimatedMinutes,
            actual_minutes: newTask.completedMinutes,
            due_date: newTask.dueDate || null,
            scheduled_date: newTask.scheduledDate,
            scheduled_start_time: newTask.scheduledStartTime,
            scheduled_end_time: newTask.scheduledEndTime,
            is_urgent: newTask.isUrgent,
            progress: newTask.progress,
            difficulty: newTask.difficulty,
            notes: newTask.notes,
          })
          .select()
          .single();

        if (!error && data) {
          newTask.id = data.id;
          // Update local cache with remote id
          const updated = this.getStoredTasks().map(t => (t.id === generatedId ? newTask : t));
          this.saveStoredTasks(updated);
        }
      }
    } catch (err: any) {
      console.warn('Supabase task sync notice (persisted locally):', err.message);
    }

    return newTask;
  }

  public static async rolloverIncompleteTasks(userId?: string): Promise<{ rolledOverCount: number; rolledOverTasks: Task[] }> {
    const tasks = await this.getTasks(userId);
    const today = new Date().toISOString().split('T')[0];
    const rolledOver: Task[] = [];

    const updatedTasks = tasks.map(t => {
      // If task was scheduled before today and is still incomplete
      if (t.status !== 'completed' && t.scheduledDate && t.scheduledDate < today) {
        rolledOver.push(t);
        return {
          ...t,
          scheduledDate: today,
          notes: (t.notes ? t.notes + '\n' : '') + `[Adaptive Rollover]: Rescheduled to ${today} from previous session.`,
        };
      }
      return t;
    });

    if (rolledOver.length > 0) {
      this.saveStoredTasks(updatedTasks);
      
      // Send notifications for rolled over tasks
      try {
        const { notificationService } = await import('./notificationService');
        for (const t of rolledOver) {
          await notificationService.sendInAppReminder(
            '⚡ Incomplete Task Rolled Over',
            `"${t.title}" was not completed in its previous session and has been automatically rolled over to your next focus window!`,
            '/today'
          );
        }
      } catch (e) {
        console.warn('Notification service dispatch notice:', e);
      }
    }

    return { rolledOverCount: rolledOver.length, rolledOverTasks: rolledOver };
  }

  public static async updateTaskStatus(
    taskId: string,
    status: Task['status'],
    progress?: number,
    elapsedMinutes?: number
  ): Promise<boolean> {
    const tasks = this.getStoredTasks();
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        const newProgress = progress !== undefined ? progress : status === 'completed' ? 100 : t.progress;
        const newCompletedMinutes = (t.completedMinutes || 0) + (elapsedMinutes || 0);
        return { ...t, status, progress: newProgress, completedMinutes: newCompletedMinutes };
      }
      return t;
    });
    this.saveStoredTasks(updated);

    try {
      const payload: any = { status };
      if (progress !== undefined) payload.progress = progress;
      if (status === 'completed') payload.progress = 100;
      
      if (elapsedMinutes !== undefined && elapsedMinutes > 0) {
        const task = updated.find(t => t.id === taskId);
        if (task) {
          payload.actual_minutes = task.completedMinutes;
        }
      }
      await supabase.from('tasks').update(payload).eq('id', taskId);
    } catch (err: any) {
      console.warn('Supabase updateTaskStatus notice:', err.message);
    }

    return true;
  }

  public static async deleteTask(taskId: string): Promise<boolean> {
    const tasks = this.getStoredTasks();
    const updated = tasks.filter(t => t.id !== taskId);
    if (updated.length !== tasks.length) {
      this.saveStoredTasks(updated);
    }

    try {
      await supabase.from('tasks').delete().eq('id', taskId);
    } catch (err: any) {
      console.warn('Supabase deleteTask notice:', err.message);
    }
    
    return true;
  }

  public static async addUrgentTask(userId: string, task: Partial<Task>): Promise<ScheduleSlot | null> {
    const created = await this.createTask(userId, {
      ...task,
      isUrgent: true,
      priority: 'urgent',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledStartTime: '19:00',
      scheduledEndTime: '20:00',
    });

    if (!created) return null;

    return {
      id: created.id,
      timeSlot: '19:00 - 20:00',
      startTime: '19:00',
      endTime: '20:00',
      durationMinutes: created.estimatedMinutes,
      title: created.title,
      category: created.type === 'project' ? 'project' : 'study',
      priority: 'urgent',
      difficulty: created.difficulty,
      progress: 0,
      status: 'pending',
      dueInfo: created.dueDate || 'Immediate',
    };
  }

}

export const taskService = TaskService;

