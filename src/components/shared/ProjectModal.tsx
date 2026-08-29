import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ProjectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import { Plus } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'project' | 'assignment' | 'goal' | 'exam_prep'>('project');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedEffortHours, setEstimatedEffortHours] = useState('10');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a project or assignment title.');
      return;
    }

    if (!user) {
      setError('You must be signed in to create projects.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const created = await ProjectService.createProject(user.id, {
        title: title.trim(),
        category,
        priority,
        status: 'pending',
        progress: 0,
        dueDate: dueDate || 'No deadline',
        estimatedEffortHours: Number(estimatedEffortHours) || 10,
        remainingEffortHours: Number(estimatedEffortHours) || 10,
        dependencies: [],
        modules: [
          { id: `m_${Date.now()}_1`, name: 'Initial Planning & Setup', progress: 0, status: 'pending', estimatedHours: 2 },
          { id: `m_${Date.now()}_2`, name: 'Core Implementation', progress: 0, status: 'pending', estimatedHours: Math.max(1, (Number(estimatedEffortHours) || 10) - 4) },
          { id: `m_${Date.now()}_3`, name: 'Review & Submission', progress: 0, status: 'pending', estimatedHours: 2 },
        ],
        notes,
      });

      if (created) {
        setTitle('');
        setDueDate('');
        setNotes('');
        onSuccess();
        onClose();
      } else {
        setError('Failed to save project in database.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Academic Project / Milestone" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <Input
          label="Project Title"
          placeholder="e.g. Compiler Construction Mini-Project, ML Term Paper"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="project">Course Project</option>
              <option value="assignment">Major Assignment</option>
              <option value="goal">Long-term Goal</option>
              <option value="exam_prep">Exam Prep Milestone</option>
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Estimated Total Effort (Hours)"
            type="number"
            value={estimatedEffortHours}
            onChange={e => setEstimatedEffortHours(e.target.value)}
          />
          <Input
            label="Target Due Date"
            placeholder="e.g. 15 Oct 2026 / In 2 weeks"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Project Notes / Deliverables</label>
          <textarea
            rows={3}
            placeholder="Key deliverables, required tools, reference materials..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

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
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
};
