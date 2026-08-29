import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, GraduationCap, Check, ArrowRight, BookOpen, Clock, Zap, Plus, X, Sun, Moon, Sunset } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { AvailabilityService } from '../services/availabilityService';
import { DayPreference, EnergyPeak } from '../types';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.name || '');
  const [course, setCourse] = useState(user?.course || '');
  const [stream, setStream] = useState(user?.stream || '');
  const [year, setYear] = useState(user?.year || '');
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [enrolledSubjects, setEnrolledSubjects] = useState<string[]>(
    user?.enrolledSubjects && user.enrolledSubjects.length > 0
      ? user.enrolledSubjects
      : ['DBMS', 'DSA', 'Operating Systems', 'Mathematics']
  );
  const [energyProfile, setEnergyProfile] = useState<EnergyPeak>('evening');
  const [dailyHours, setDailyHours] = useState('4');
  const [targetGoal, setTargetGoal] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSubjectInput.trim()) return;
    const trimmed = customSubjectInput.trim();
    if (!enrolledSubjects.includes(trimmed)) {
      setEnrolledSubjects([...enrolledSubjects, trimmed]);
    }
    setCustomSubjectInput('');
  };

  const removeSubject = (sub: string) => {
    setEnrolledSubjects(enrolledSubjects.filter(s => s !== sub));
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const parsedHours = Math.max(1, Math.min(16, Number(dailyHours) || 4));

      // Determine hour blocks based on selected energy profile
      let weekdayBlocks: number[] = [];
      if (energyProfile === 'morning') weekdayBlocks = [8, 9, 10, 11].slice(0, parsedHours);
      else if (energyProfile === 'afternoon') weekdayBlocks = [13, 14, 15, 16].slice(0, parsedHours);
      else if (energyProfile === 'night') weekdayBlocks = [0, 1, 2, 3].slice(0, parsedHours);
      else weekdayBlocks = [18, 19, 20, 21].slice(0, parsedHours);

      const days: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[] = [
        'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
      ];

      const generatedDayPreferences: DayPreference[] = days.map(d => ({
        dayOfWeek: d,
        isEnabled: true,
        availableHours: ['Sat', 'Sun'].includes(d) ? Math.min(12, parsedHours + 2) : parsedHours,
        energyProfile,
        selectedHourBlocks: ['Sat', 'Sun'].includes(d) ? [9, 10, 11, 14, 15, 16] : weekdayBlocks,
        timeSlots: [
          {
            id: `slot_${d.toLowerCase()}_1`,
            startTime: energyProfile === 'morning' ? '09:00' : '18:00',
            endTime: energyProfile === 'morning' ? '13:00' : '22:00',
            label: 'Onboarding Focus Session',
          }
        ]
      }));

      await AvailabilityService.saveAllPreferences(user?.id, generatedDayPreferences);

      await updateProfile({
        name: name.trim() || user?.name || 'Student',
        course: course.trim() || 'B.Tech',
        stream: stream.trim() || 'Computer Science',
        year: year.trim() || '2nd Year',
        enrolledSubjects,
        dayPreferences: generatedDayPreferences,
      });

      navigate('/dashboard');
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { num: 1, label: 'Degree & Major' },
    { num: 2, label: 'Subjects' },
    { num: 3, label: 'Energy Profile' },
    { num: 4, label: 'Study Goals' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Helix</span>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          Skip to Dashboard →
        </button>
      </div>

      {/* Main Stepper Card */}
      <div className="max-w-2xl w-full mx-auto">
        {/* Stepper Indicator */}
        <div className="flex items-center justify-between mb-8 px-4 sm:px-8">
          {steps.map(s => (
            <div key={s.num} className="flex flex-col items-center gap-1.5 relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s.num === step
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-xs'
                    : s.num < step
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s.num < step ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className="text-[11px] font-semibold text-slate-600">{s.label}</span>
            </div>
          ))}
        </div>

        <Card className="p-6 sm:p-8">
          {/* Step 1: Degree & Program */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Academic Profile</h3>
                  <p className="text-xs text-slate-500">Tell Helix what degree and branch you are currently studying.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <Input
                  label="Your Full Name"
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />

                <Input
                  label="Degree / Degree Program"
                  placeholder="e.g. B.Tech / B.S. / M.S."
                  value={course}
                  onChange={e => setCourse(e.target.value)}
                />

                <Input
                  label="Branch / Major / Stream"
                  placeholder="e.g. Computer Science / Electrical / Mechanical"
                  value={stream}
                  onChange={e => setStream(e.target.value)}
                />

                <Input
                  label="Academic Year / Semester"
                  placeholder="e.g. 2nd Year, 4th Semester"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setStep(2)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continue to Subjects
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Enrolled Subjects */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Add Your Subjects</h3>
                  <p className="text-xs text-slate-500">Enter the courses you are studying this semester.</p>
                </div>
              </div>

              {/* Add Subject Input Form */}
              <form onSubmit={handleAddSubject} className="flex gap-2">
                <Input
                  placeholder="Type subject name (e.g. DBMS, Algorithms, Calculus) and press Add"
                  value={customSubjectInput}
                  onChange={e => setCustomSubjectInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="secondary" leftIcon={<Plus className="w-4 h-4" />}>
                  Add
                </Button>
              </form>

              {/* Added Subjects Chips */}
              <div className="min-h-[100px] p-4 rounded-xl bg-slate-50 border border-slate-200">
                {enrolledSubjects.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No subjects added yet. Type your subject name above and click "Add".
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {enrolledSubjects.map(sub => (
                      <span
                        key={sub}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-indigo-200 text-indigo-700 shadow-2xs"
                      >
                        {sub}
                        <button
                          type="button"
                          onClick={() => removeSubject(sub)}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setStep(3)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continue to Energy Profile
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Energy Profile & Capacity */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Energy & Availability</h3>
                  <p className="text-xs text-slate-500">Helix schedules deep work when your cognitive focus is highest.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">When is your peak focus time?</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'morning', label: 'Morning', icon: Sun, desc: '6 AM - 12 PM' },
                    { id: 'afternoon', label: 'Afternoon', icon: Sunset, desc: '12 PM - 6 PM' },
                    { id: 'evening', label: 'Evening', icon: Moon, desc: '6 PM - 12 AM' },
                  ].map(e => {
                    const Icon = e.icon;
                    const isSelected = energyProfile === e.id;
                    return (
                      <div
                        key={e.id}
                        onClick={() => setEnergyProfile(e.id as any)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <h4 className="text-xs font-bold text-slate-900">{e.label}</h4>
                        <p className="text-[11px] text-slate-500">{e.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <Input
                  label="Target Daily Study Capacity (Hours)"
                  type="number"
                  placeholder="e.g. 4"
                  value={dailyHours}
                  onChange={e => setDailyHours(e.target.value)}
                />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setStep(4)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continue to Goals
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Academic Goals & Finish */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Academic Goal & Finish</h3>
                  <p className="text-xs text-slate-500">Define your primary objective for this semester.</p>
                </div>
              </div>

              <Input
                label="Semester Goal / Target GPA"
                placeholder="e.g. Maintain 9.0 GPA, finish compiler project on time"
                value={targetGoal}
                onChange={e => setTargetGoal(e.target.value)}
              />

              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <p className="font-bold">✨ Ready to begin with clean data!</p>
                <p className="text-slate-600">
                  Your profile, subjects, and study availability are saved directly to your private database with PostgreSQL Row-Level Security.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleComplete}
                  isLoading={isSaving}
                  rightIcon={<Check className="w-4 h-4" />}
                >
                  Complete Setup & Open Dashboard
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="text-center text-xs text-slate-400 py-2">
        Helix Intelligent Academic Engine • Supabase Auth & PostgreSQL
      </div>
    </div>
  );
};
