import React, { useState, useEffect } from 'react';
import { AvailabilityService } from '../../services/availabilityService';
import { DayPreference, EnergyPeak } from '../../types';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import {
  X,
  CheckCircle2,
  Clock,
  Sun,
  Sunset,
  Moon,
  Zap,
  Copy,
  Calendar,
  Sparkles,
  RotateCcw
} from 'lucide-react';

const DAYS_OF_WEEK: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

const HOUR_LABELS: { [hour: number]: string } = {
  0: '12 AM', 1: '1 AM', 2: '2 AM', 3: '3 AM', 4: '4 AM', 5: '5 AM',
  6: '6 AM', 7: '7 AM', 8: '8 AM', 9: '9 AM', 10: '10 AM', 11: '11 AM',
  12: '12 PM', 13: '1 PM', 14: '2 PM', 15: '3 PM', 16: '4 PM', 17: '5 PM',
  18: '6 PM', 19: '7 PM', 20: '8 PM', 21: '9 PM', 22: '10 PM', 23: '11 PM',
};

interface WeeklyAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  userId?: string;
}

export const WeeklyAvailabilityModal: React.FC<WeeklyAvailabilityModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  userId,
}) => {
  const [preferences, setPreferences] = useState<DayPreference[]>([]);
  const [activeDay, setActiveDay] = useState<DayPreference['dayOfWeek']>('Mon');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = AvailabilityService.getStoredPreferences();
      setPreferences(stored);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDayPref = preferences.find(p => p.dayOfWeek === activeDay) || {
    dayOfWeek: activeDay,
    isEnabled: true,
    availableHours: 4,
    energyProfile: 'evening' as EnergyPeak,
    selectedHourBlocks: [18, 19, 20, 21],
  };

  const updateCurrentDay = (updater: (prev: DayPreference) => DayPreference) => {
    setPreferences(prev =>
      prev.map(p => (p.dayOfWeek === activeDay ? updater(p) : p))
    );
  };

  const toggleHourBlock = (hour: number) => {
    updateCurrentDay(prev => {
      const exists = prev.selectedHourBlocks.includes(hour);
      const updatedBlocks = exists
        ? prev.selectedHourBlocks.filter(h => h !== hour)
        : [...prev.selectedHourBlocks, hour].sort((a, b) => a - b);

      return {
        ...prev,
        selectedHourBlocks: updatedBlocks,
        availableHours: updatedBlocks.length,
      };
    });
  };

  const applyPresetHours = (hours: number) => {
    let presetBlocks: number[] = [];
    if (hours === 2) presetBlocks = [18, 19];
    else if (hours === 4) presetBlocks = [18, 19, 20, 21];
    else if (hours === 6) presetBlocks = [9, 10, 11, 18, 19, 20];
    else if (hours === 8) presetBlocks = [9, 10, 11, 14, 15, 18, 19, 20];

    updateCurrentDay(prev => ({
      ...prev,
      availableHours: presetBlocks.length,
      selectedHourBlocks: presetBlocks,
    }));
  };

  const copyToAllWeekdays = () => {
    const activeBlocks = [...currentDayPref.selectedHourBlocks];
    const activeEnergy = currentDayPref.energyProfile;
    const activeHours = currentDayPref.availableHours;

    setPreferences(prev =>
      prev.map(p => {
        if (p.dayOfWeek !== 'Sat' && p.dayOfWeek !== 'Sun') {
          return {
            ...p,
            isEnabled: true,
            availableHours: activeHours,
            selectedHourBlocks: [...activeBlocks],
            energyProfile: activeEnergy,
          };
        }
        return p;
      })
    );
  };

  const totalWeeklyCapacity = preferences.reduce(
    (sum, p) => sum + (p.isEnabled ? p.availableHours : 0),
    0
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await AvailabilityService.saveAllPreferences(userId, preferences);
      setIsSaved(true);
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 600);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">
                7-Day Hourly Availability & Time Capacity Matrix
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select available study hours (00:00 to 23:00) for each day of the week to calculate deterministic planner capacity.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Total Capacity Bar */}
          <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-950 block">Weekly Study Capacity</span>
              <span className="text-xl font-extrabold text-indigo-600">
                {totalWeeklyCapacity} Hours / Week
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                leftIcon={<Copy className="w-3 h-3" />}
                onClick={copyToAllWeekdays}
              >
                Copy {activeDay} to Weekdays (Mon-Fri)
              </Button>
            </div>
          </div>

          {/* 7 Days Selector Bar */}
          <div className="grid grid-cols-7 gap-2">
            {DAYS_OF_WEEK.map(day => {
              const pref = preferences.find(p => p.dayOfWeek === day) || {
                dayOfWeek: day,
                isEnabled: true,
                availableHours: 4,
                energyProfile: 'evening' as EnergyPeak,
              };
              const isSelected = activeDay === day;

              return (
                <div
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/30 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800 block mb-1">{day}</span>
                  <span className="text-sm font-extrabold text-indigo-600 block">
                    {pref.isEnabled ? `${pref.availableHours}h` : 'Rest'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium capitalize block truncate">
                    {pref.isEnabled ? pref.energyProfile : 'Off'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active Day 24-Hour Matrix */}
          <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {activeDay} Availability ({currentDayPref.availableHours} Hours Selected)
                </h3>
                <p className="text-xs text-slate-500">
                  Click any hour slot to toggle on/off for {activeDay}.
                </p>
              </div>

              {/* Day On/Off Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Active Study Day</span>
                <input
                  type="checkbox"
                  checked={currentDayPref.isEnabled}
                  onChange={e =>
                    updateCurrentDay(prev => ({
                      ...prev,
                      isEnabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {currentDayPref.isEnabled ? (
              <div className="space-y-4">
                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-xs font-semibold text-slate-400 mr-1">Quick Presets:</span>
                  {[
                    { label: '2h Light', hours: 2 },
                    { label: '4h Standard', hours: 4 },
                    { label: '6h Deep Focus', hours: 6 },
                    { label: '8h Intensive', hours: 8 },
                    { label: 'Clear All', hours: 0 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPresetHours(p.hours)}
                      className="px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* 24 Hour Slots Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const isSelected = currentDayPref.selectedHourBlocks?.includes(hour);

                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => toggleHourBlock(hour)}
                        className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[56px] ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[10px] opacity-85">{HOUR_LABELS[hour]}</span>
                        <span className="text-xs font-bold mt-1">
                          {isSelected ? '✓ On' : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Cognitive Peak Selection for the Day */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    Peak Energy Alignment for {activeDay}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'morning', label: 'Morning (6 AM - 12 PM)', icon: Sun },
                      { id: 'afternoon', label: 'Afternoon (12 PM - 6 PM)', icon: Sunset },
                      { id: 'evening', label: 'Evening (6 PM - 12 AM)', icon: Moon },
                      { id: 'night', label: 'Night (12 AM - 6 AM)', icon: Zap },
                    ].map(e => {
                      const Icon = e.icon;
                      const isSelected = currentDayPref.energyProfile === e.id;
                      return (
                        <div
                          key={e.id}
                          onClick={() =>
                            updateCurrentDay(prev => ({
                              ...prev,
                              energyProfile: e.id as EnergyPeak,
                            }))
                          }
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer text-center ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <p className="text-[11px] font-bold text-slate-800">{e.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                {activeDay} is currently set as a Rest / Off day. Check &quot;Active Study Day&quot; above to add available hours.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            {isSaved && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Availability Saved!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving...' : 'Save 7-Day Availability'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
