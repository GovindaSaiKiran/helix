import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { TaskService } from '../../services/taskService';
import { SubjectService } from '../../services/subjectService';
import { Subject } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'study' | 'assignment' | 'project' | 'revision' | 'break'>('study');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [subjectId, setSubjectId] = useState<string>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('45');
  const [dueDate, setDueDate] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('18:00');
  const [scheduledEndTime, setScheduledEndTime] = useState('18:45');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      SubjectService.getSubjects(user?.id).then(subs => {
        setSubjects(subs);
        if (subs.length > 0) setSubjectId(subs[0].id);
      });
    }
  }, [isOpen, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a task title.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const userId = user?.id || 'usr_local_student';
      const created = await TaskService.createTask(userId, {
        title: title.trim(),
        type,
        priority,
        subjectId: subjectId || undefined,
        estimatedMinutes: Number(estimatedMinutes) || 45,
        dueDate: dueDate || undefined,
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledStartTime,
        scheduledEndTime,
        progress: 0,
        status: 'pending',
      });

      if (created) {
        setTitle('');
        setDueDate('');
        onSuccess();
        onClose();
      } else {
        setError('Could not complete task creation. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Academic Focus Task" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <Input
          label="Task Title"
          placeholder="e.g. Normalization 2NF Practice, C++ Memory Pointers"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Category</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="study">Study Session</option>
              <option value="assignment">Assignment</option>
              <option value="project">Project Work</option>
              <option value="revision">Revision</option>
              <option value="break">Planned Break</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="urgent">⚡ Urgent</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {subjects.length > 0 && (
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Associated Subject</label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No specific subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Duration (min)"
            type="number"
            value={estimatedMinutes}
            onChange={e => setEstimatedMinutes(e.target.value)}
          />
          <Input
            label="Start Time"
            type="time"
            value={scheduledStartTime}
            onChange={e => setScheduledStartTime(e.target.value)}
          />
          <Input
            label="End Time"
            type="time"
            value={scheduledEndTime}
            onChange={e => setScheduledEndTime(e.target.value)}
          />
        </div>

        <Input
          label="Deadline Info (Optional)"
          placeholder="e.g. Due tomorrow at 5 PM"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
        />

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isLoading}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};
