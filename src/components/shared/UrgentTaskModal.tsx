import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { usePlan } from '../../context/PlanContext';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Zap } from 'lucide-react';

export interface UrgentTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UrgentTaskModal: React.FC<UrgentTaskModalProps> = ({ isOpen, onClose }) => {
  const { addUrgentTask } = usePlan();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('60');
  const [subject, setSubject] = useState('DBMS');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await addUrgentTask(title, parseInt(duration, 10));
      onClose();
      // Navigate user directly to Replanning screen to see smart adaptation
      navigate('/replanning');
    } finally {
      setIsSubmitting(false);
      setTitle('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-rose-600">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">Add Urgent Task / Event</span>
        </div>
      }
      description="Adding an urgent task will trigger Helix's deterministic engine to check capacity, detect conflicts, and propose smart replanning."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Task / Project Name"
          placeholder="e.g. Complete Auth Module, Unexpected Exam Prep"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Estimated Effort"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            options={[
              { value: '30', label: '30 Minutes' },
              { value: '45', label: '45 Minutes' },
              { value: '60', label: '1 Hour' },
              { value: '90', label: '1.5 Hours' },
              { value: '120', label: '2 Hours' },
            ]}
          />

          <Select
            label="Subject / Project"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            options={[
              { value: 'DBMS', label: 'DBMS' },
              { value: 'C++', label: 'C++' },
              { value: 'DSA', label: 'DSA' },
              { value: 'React', label: 'React Planner' },
              { value: 'General', label: 'General Project' },
            ]}
          />
        </div>

        <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Helix will automatically balance your buffer hours, protect upcoming deadlines, and provide a before/after replan.
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={isSubmitting}
            leftIcon={<Zap className="w-4 h-4" />}
          >
            Add & Replan
          </Button>
        </div>
      </form>
    </Modal>
  );
};
