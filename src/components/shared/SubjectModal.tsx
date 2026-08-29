import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { SubjectService } from '../../services/subjectService';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Plus } from 'lucide-react';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const colorPresets = [
  '#6366F1', // Indigo
  '#0EA5E9', // Sky
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#14B8A6', // Teal
  '#F97316', // Orange
];

export const SubjectModal: React.FC<SubjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState('#6366F1');
  const [targetGrade, setTargetGrade] = useState('A');
  const [totalUnits, setTotalUnits] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a subject name.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const userId = user?.id || 'usr_local_student';
      const created = await SubjectService.createSubject(userId, {
        name: name.trim(),
        code: code.trim(),
        color,
        syllabusCoverage: 0,
        totalUnits: Number(totalUnits) || 5,
        completedUnits: 0,
        targetGrade,
      });

      if (created) {
        setName('');
        setCode('');
        onSuccess();
        onClose();
      } else {
        setError('Could not complete subject creation. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Academic Subject" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <Input
          label="Subject Name"
          placeholder="e.g. Database Management Systems, Data Structures"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Course Code (Optional)"
            placeholder="e.g. CS301"
            value={code}
            onChange={e => setCode(e.target.value)}
          />
          <Input
            label="Total Syllabus Units"
            type="number"
            placeholder="e.g. 5"
            value={totalUnits}
            onChange={e => setTotalUnits(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Color Tag</label>
          <div className="flex items-center gap-2">
            {colorPresets.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all cursor-pointer ${
                  color === c ? 'ring-3 ring-offset-2 ring-indigo-500 scale-110' : 'hover:opacity-80'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
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
            Create Subject
          </Button>
        </div>
      </form>
    </Modal>
  );
};
