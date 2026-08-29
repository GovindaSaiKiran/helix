import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { AvailabilityService, defaultDayPreferences } from '../services/availabilityService';
import { firebaseMessaging, NotificationPermissionStatus } from '../services/firebaseMessaging';
import { DayPreference, EnergyPeak, AppTheme } from '../types';
import {
  Bell,
  Smartphone,
  Check,
  User,
  Shield,
  Moon,
  Globe,
  Sun,
  Sunset,
  LogOut,
  Sparkles,
  Database,
  Eye,
  Clock,
  Zap,
  Calendar,
  Copy,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  X,
  Plus,
  Trash2,
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

export const SettingsPage: React.FC = () => {
  const { user, updateProfile, logout, theme, setTheme } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'notifications' | 'appearance' | 'account'>('profile');

  // Profile Form States
  const [name, setName] = useState(user?.name || '');
  const [course, setCourse] = useState(user?.course || '');
  const [stream, setStream] = useState(user?.stream || '');
  const [year, setYear] = useState(user?.year || '');
  const [enrolledSubjects, setEnrolledSubjects] = useState<string[]>(user?.enrolledSubjects || []);
  const [newSubjectInput, setNewSubjectInput] = useState('');

  // Notification Preferences
  const [inAppEnabled, setInAppEnabled] = useState(user?.notificationPreferences?.inApp ?? true);
  const [fcmEnabled, setFcmEnabled] = useState(user?.notificationPreferences?.fcmPush ?? true);
  const [reminderTimings, setReminderTimings] = useState<string[]>(
    user?.reminderTimings || ['10_min', '30_min', 'at_start']
  );

  // Appearance & Eye Comfort
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(theme || user?.theme || 'light');
  const [eyeWarmth, setEyeWarmth] = useState<number>(user?.eyeComfortWarmth ?? 50);

  // Day-Wise 24h Preferences State
  const [dayPreferences, setDayPreferences] = useState<DayPreference[]>(() =>
    AvailabilityService.getStoredPreferences()
  );
  const [activeDay, setActiveDay] = useState<DayPreference['dayOfWeek']>('Mon');
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('12:00');
  const [newSlotLabel, setNewSlotLabel] = useState('Focus Session');

  const [isSaved, setIsSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('Settings saved successfully!');
  const [isSaving, setIsSaving] = useState(false);

  // Reactive synchronization with AuthContext user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setCourse(user.course || '');
      setStream(user.stream || '');
      setYear(user.year || '');
      setEnrolledSubjects(user.enrolledSubjects || []);
      if (user.notificationPreferences) {
        setInAppEnabled(user.notificationPreferences.inApp ?? true);
        setFcmEnabled(user.notificationPreferences.fcmPush ?? true);
      }
      if (user.reminderTimings) {
        setReminderTimings(user.reminderTimings);
      }
      if (user.theme) {
        setSelectedTheme(user.theme);
      }
      if (user.eyeComfortWarmth !== undefined) {
        setEyeWarmth(user.eyeComfortWarmth);
      }
    }
  }, [user]);

  // Load preferences from service
  useEffect(() => {
    AvailabilityService.getPreferences(user?.id).then(prefs => {
      if (prefs && prefs.length > 0) {
        setDayPreferences(prefs);
      }
    });
  }, [user?.id]);

  // Browser Push Notifications (FCM) State
  const [browserPushStatus, setBrowserPushStatus] = useState<
    'enabled' | 'disabled' | 'denied' | 'default' | 'unsupported'
  >('default');
  const [isRegisteringPush, setIsRegisteringPush] = useState<boolean>(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState<boolean>(false);
  const [testPushFeedback, setTestPushFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const checkBrowserPushStatus = async () => {
    if (!user) return;
    const isSupported = await firebaseMessaging.isMessagingSupported();
    if (!isSupported) {
      setBrowserPushStatus('unsupported');
      return;
    }
    const permission = await firebaseMessaging.getPermissionStatus();
    if (permission === 'denied') {
      setBrowserPushStatus('denied');
      return;
    }
    const isRegistered = await firebaseMessaging.isEnabledForUser(user.id);
    if (isRegistered) {
      setBrowserPushStatus('enabled');
    } else {
      setBrowserPushStatus(permission === 'granted' ? 'disabled' : 'default');
    }
  };

  useEffect(() => {
    if (activeTab === 'notifications') {
      checkBrowserPushStatus();
    }
  }, [activeTab, user?.id]);

  const handleEnablePush = async () => {
    if (!user) return;
    setIsRegisteringPush(true);
    setTestPushFeedback(null);
    try {
      const result = await firebaseMessaging.enableNotifications(user.id);
      if (result.success) {
        setBrowserPushStatus('enabled');
        setFcmEnabled(true);
        setTestPushFeedback({
          type: 'success',
          message: 'Browser push notifications successfully registered and enabled!',
        });
      } else {
        const perm = await firebaseMessaging.getPermissionStatus();
        if (perm === 'denied') {
          setBrowserPushStatus('denied');
        }
        setTestPushFeedback({
          type: 'error',
          message: result.error || 'Failed to enable browser notifications.',
        });
      }
    } finally {
      setIsRegisteringPush(false);
    }
  };

  const handleDisablePush = async () => {
    if (!user) return;
    setIsRegisteringPush(true);
    setTestPushFeedback(null);
    try {
      const result = await firebaseMessaging.disableNotifications(user.id);
      if (result.success) {
        setBrowserPushStatus('disabled');
        setFcmEnabled(false);
        setTestPushFeedback({
          type: 'success',
          message: 'Browser push notifications disabled for this device.',
        });
      }
    } finally {
      setIsRegisteringPush(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!user) return;
    setIsSendingTestPush(true);
    setTestPushFeedback(null);
    try {
      const result = await firebaseMessaging.sendTestNotification(user.id);
      if (result.success) {
        setTestPushFeedback({
          type: 'success',
          message: result.message || 'Test push notification sent successfully!',
        });
      } else {
        setTestPushFeedback({
          type: 'error',
          message: result.error || 'Failed to dispatch test notification.',
        });
      }
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const showSaveNotice = (msg: string) => {
    setSaveMessage(msg);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const toggleTiming = (timing: string) => {
    if (reminderTimings.includes(timing)) {
      setReminderTimings(reminderTimings.filter(t => t !== timing));
    } else {
      setReminderTimings([...reminderTimings, timing]);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        name,
        course,
        stream,
        year,
        enrolledSubjects,
      });
      showSaveNotice('Profile credentials saved and updated successfully!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        reminderTimings: reminderTimings as any,
        notificationPreferences: {
          inApp: inAppEnabled,
          fcmPush: fcmEnabled,
        },
      });
      showSaveNotice('Notification schedule & channels updated successfully!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = async (t: AppTheme) => {
    setSelectedTheme(t);
    await setTheme(t);
  };

  const handleSaveAppearance = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        theme: selectedTheme,
        eyeComfortWarmth: eyeWarmth,
      });
      await setTheme(selectedTheme);
      showSaveNotice('Appearance & Eye Comfort settings saved successfully!');
    } finally {
      setIsSaving(false);
    }
  };

  // Preference Manipulation Helpers
  const currentDayPref = dayPreferences.find(d => d.dayOfWeek === activeDay) || dayPreferences[0];

  const updateCurrentDay = (updater: (prev: DayPreference) => DayPreference) => {
    setDayPreferences(prev =>
      prev.map(d => (d.dayOfWeek === activeDay ? updater(d) : d))
    );
  };

  const toggleHourBlock = (hour: number) => {
    updateCurrentDay(prev => {
      const exists = prev.selectedHourBlocks.includes(hour);
      const updatedHours = exists
        ? prev.selectedHourBlocks.filter(h => h !== hour)
        : [...prev.selectedHourBlocks, hour].sort((a, b) => a - b);
      return {
        ...prev,
        selectedHourBlocks: updatedHours,
        availableHours: updatedHours.length,
      };
    });
  };

  const applyPresetHours = (hoursCount: number) => {
    let newHours: number[] = [];
    if (hoursCount === 2) newHours = [18, 19];
    else if (hoursCount === 4) newHours = [18, 19, 20, 21];
    else if (hoursCount === 6) newHours = [9, 10, 11, 14, 15, 16];
    else if (hoursCount === 8) newHours = [9, 10, 11, 12, 14, 15, 16, 17];
    else if (hoursCount === 0) newHours = [];

    updateCurrentDay(prev => ({
      ...prev,
      selectedHourBlocks: newHours,
      availableHours: newHours.length,
      isEnabled: hoursCount > 0,
    }));
  };

  const handleAddCustomTimeWindow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotStart || !newSlotEnd) return;
    const newSlot = {
      id: `slot_${Date.now()}`,
      startTime: newSlotStart,
      endTime: newSlotEnd,
      label: newSlotLabel.trim() || 'Focus Session',
    };
    updateCurrentDay(prev => ({
      ...prev,
      timeSlots: [...(prev.timeSlots || []), newSlot],
    }));
    setNewSlotLabel('Focus Session');
  };

  const removeTimeSlot = (slotId: string) => {
    updateCurrentDay(prev => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).filter(s => s.id !== slotId),
    }));
  };

  const copyCurrentDayToWeekdays = () => {
    const current = currentDayPref;
    const weekdays: DayPreference['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    setDayPreferences(prev =>
      prev.map(d =>
        weekdays.includes(d.dayOfWeek)
          ? {
              ...current,
              dayOfWeek: d.dayOfWeek,
            }
          : d
      )
    );
    showSaveNotice(`Copied ${activeDay}'s schedule across all Monday–Friday weekdays!`);
  };

  const copyCurrentDayToEntireWeek = () => {
    const current = currentDayPref;
    setDayPreferences(prev =>
      prev.map(d => ({
        ...current,
        dayOfWeek: d.dayOfWeek,
      }))
    );
    showSaveNotice(`Applied ${activeDay}'s 24h schedule to all 7 days of the week!`);
  };

  const resetAllPreferencesToDefault = () => {
    setDayPreferences([...defaultDayPreferences]);
    showSaveNotice('Reset all 7 days to recommended academic schedule defaults.');
  };

  const handleSaveAllPreferences = async () => {
    setIsSaving(true);
    try {
      await AvailabilityService.saveAllPreferences(user?.id, dayPreferences);
      await updateProfile({ dayPreferences });
      showSaveNotice('Weekly 24h study preferences & energy windows saved successfully!');
    } finally {
      setIsSaving(false);
    }
  };

  const totalWeeklyHours = dayPreferences.reduce(
    (sum, d) => sum + (d.isEnabled ? d.availableHours : 0),
    0
  );

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Moon },
    { id: 'account', label: 'Account', icon: Shield },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your academic credentials, 24h day-wise preferences, eye comfort, and notifications."
      />

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {isSaved && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* =========================================================================
          Profile Tab
          ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-4xl">
          <div className="md:col-span-8">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Academic Profile</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your real educational credentials used across timetable calculations.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label="Student Full Name"
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  helperText="Email is managed through authenticated session"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Degree / Course"
                    placeholder="e.g. B.Tech, B.S., M.S."
                    value={course}
                    onChange={e => setCourse(e.target.value)}
                  />
                  <Input
                    label="Branch / Major / Stream"
                    placeholder="e.g. Computer Science"
                    value={stream}
                    onChange={e => setStream(e.target.value)}
                  />
                </div>
                <Input
                  label="Academic Year / Semester"
                  placeholder="e.g. 2nd Year, 4th Semester"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                />

                {/* Enrolled Subjects Management */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      Enrolled Subjects ({enrolledSubjects.length})
                    </label>
                    <span className="text-[11px] text-slate-400">Add or remove subjects anytime</span>
                  </div>

                  {enrolledSubjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 mb-3">
                      {enrolledSubjects.map(sub => (
                        <span
                          key={sub}
                          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-indigo-200 text-indigo-700 shadow-2xs hover:border-indigo-300 transition-colors"
                        >
                          <BookOpen className="w-3 h-3 text-indigo-500" />
                          {sub}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = enrolledSubjects.filter(s => s !== sub);
                              setEnrolledSubjects(updated);
                            }}
                            className="ml-1 text-slate-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors cursor-pointer"
                            title={`Remove ${sub}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center mb-3">
                      <p className="text-xs text-slate-500">No subjects enrolled yet. Add your university courses below.</p>
                    </div>
                  )}

                  {/* Add New Subject Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Operating Systems, Computer Networks..."
                      value={newSubjectInput}
                      onChange={e => setNewSubjectInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = newSubjectInput.trim();
                          if (val && !enrolledSubjects.includes(val)) {
                            setEnrolledSubjects([...enrolledSubjects, val]);
                            setNewSubjectInput('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        const val = newSubjectInput.trim();
                        if (val && !enrolledSubjects.includes(val)) {
                          setEnrolledSubjects([...enrolledSubjects, val]);
                          setNewSubjectInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveProfile}
                    isLoading={isSaving}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Save Profile Changes
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="md:col-span-4 space-y-4">
            <Card className="p-5 bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100">
              <div className="flex items-center gap-2.5 mb-3 text-indigo-700">
                <Database className="w-4 h-4" />
                <h4 className="text-xs font-bold">Persistence Status</h4>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                All profile updates are securely stored in your personal database and synchronized instantly across your study timetable.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* =========================================================================
          Preferences Tab (Day-Wise 24h Schedule & Energy Windows)
          ========================================================================= */}
      {activeTab === 'preferences' && (
        <div className="space-y-6 max-w-5xl">
          {/* Header Summary Card */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Day-Wise 24-Hour Availability Planner</span>
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">Weekly Study Capacity: {totalWeeklyHours.toFixed(1)} hrs</h3>
              <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                Configure your available study hours for each of the 24 hours across every day of the week. The adaptive engine allocates deep focus sessions strictly within these selected hours.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={resetAllPreferencesToDefault}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset Defaults
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAllPreferences}
                isLoading={isSaving}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Save Weekly Preferences
              </Button>
            </div>
          </div>

          {/* 7-Day Day Selector Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {DAYS_OF_WEEK.map(day => {
              const pref = dayPreferences.find(d => d.dayOfWeek === day) || defaultDayPreferences[0];
              const isSelected = activeDay === day;
              const EnergyIcon =
                pref.energyProfile === 'morning'
                  ? Sun
                  : pref.energyProfile === 'afternoon'
                  ? Sunset
                  : pref.energyProfile === 'night'
                  ? Zap
                  : Moon;

              return (
                <div
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-center relative ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/30 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800">{day}</span>
                    <EnergyIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="text-base font-extrabold text-indigo-600">
                    {pref.isEnabled ? `${pref.availableHours}h` : 'Rest'}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium capitalize">
                    {pref.isEnabled ? pref.energyProfile : 'Day Off'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active Day Configuration Panel */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {activeDay} Schedule ({currentDayPref.availableHours} Hours Selected)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    {currentDayPref.isEnabled ? 'Active Day' : 'Rest Day'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick your available hours from the 24-hour matrix or customize exact study blocks.
                </p>
              </div>

              {/* Day Enabled Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Study on {activeDay}</span>
                <input
                  type="checkbox"
                  checked={currentDayPref.isEnabled}
                  onChange={e =>
                    updateCurrentDay(prev => ({
                      ...prev,
                      isEnabled: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {currentDayPref.isEnabled ? (
              <div className="space-y-6 pt-6">
                {/* 24-Hour Interactive Grid Matrix */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">24-Hour Time Availability Matrix</h4>
                      <p className="text-[11px] text-slate-500">
                        Click any hour block to toggle study availability (00:00 to 23:00).
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-400 mr-1">Presets:</span>
                      {[
                        { label: '2h Light', hours: 2 },
                        { label: '4h Standard', hours: 4 },
                        { label: '6h Intensive', hours: 6 },
                        { label: '8h Marathon', hours: 8 },
                        { label: 'Clear', hours: 0 },
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyPresetHours(p.hours)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 24 Hour Slots Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const isSelected = currentDayPref.selectedHourBlocks.includes(hour);

                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => toggleHourBlock(hour)}
                          className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[58px] ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-[10px] opacity-80">{HOUR_LABELS[hour]}</span>
                          <span className="text-[11px] font-bold mt-1">
                            {isSelected ? '✓ On' : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cognitive Peak Energy Window */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">
                    Cognitive Peak Energy Window for {activeDay}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'morning', label: 'Morning Peak', desc: '6 AM - 12 PM', icon: Sun },
                      { id: 'afternoon', label: 'Afternoon Peak', desc: '12 PM - 6 PM', icon: Sunset },
                      { id: 'evening', label: 'Evening Peak', desc: '6 PM - 12 AM', icon: Moon },
                      { id: 'night', label: 'Night Owl Peak', desc: '12 AM - 6 AM', icon: Zap },
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
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer text-center ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 mx-auto mb-1.5 ${
                              isSelected ? 'text-indigo-600' : 'text-slate-400'
                            }`}
                          />
                          <h5 className="text-xs font-bold text-slate-900">{e.label}</h5>
                          <p className="text-[11px] text-slate-500">{e.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Time Windows / Focus Blocks */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Dedicated Focus Windows</h4>
                  <form onSubmit={handleAddCustomTimeWindow} className="flex flex-wrap items-end gap-3 mb-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Start Time</label>
                      <input
                        type="time"
                        value={newSlotStart}
                        onChange={e => setNewSlotStart(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">End Time</label>
                      <input
                        type="time"
                        value={newSlotEnd}
                        onChange={e => setNewSlotEnd(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                      />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Session Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Deep Coding Slot"
                        value={newSlotLabel}
                        onChange={e => setNewSlotLabel(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                      />
                    </div>
                    <Button type="submit" size="sm" variant="secondary">
                      + Add Window
                    </Button>
                  </form>

                  {/* Active Slots list */}
                  <div className="flex flex-wrap gap-2">
                    {(currentDayPref.timeSlots || []).map(slot => (
                      <div
                        key={slot.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-900 text-xs font-semibold"
                      >
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          {slot.startTime} – {slot.endTime} • {slot.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(slot.id)}
                          className="text-slate-400 hover:text-red-500 cursor-pointer ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyCurrentDayToWeekdays}
                      leftIcon={<Copy className="w-3.5 h-3.5" />}
                    >
                      Apply to Mon–Fri Weekdays
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyCurrentDayToEntireWeek}
                      leftIcon={<Calendar className="w-3.5 h-3.5" />}
                    >
                      Apply to All 7 Days
                    </Button>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveAllPreferences}
                    isLoading={isSaving}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Save Preferences
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Moon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <h4 className="text-sm font-bold text-slate-600">{activeDay} is set as a Rest Day</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  The planner will not schedule mandatory assignments or study sessions on this day.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() =>
                    updateCurrentDay(prev => ({
                      ...prev,
                      isEnabled: true,
                      availableHours: 4,
                      selectedHourBlocks: [18, 19, 20, 21],
                    }))
                  }
                >
                  Enable Study Hours for {activeDay}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* =========================================================================
          Notifications Tab
          ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-6">
            {/* Firebase Cloud Messaging Web Push Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Browser Push Notifications</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Receive real-time study reminders and focus alerts on this device via Firebase Cloud Messaging.
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardBody className="space-y-5">
                {/* Status Indicator Bar */}
                <div className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border-slate-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">Registration Status:</span>
                      {browserPushStatus === 'enabled' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
                        </span>
                      )}
                      {browserPushStatus === 'disabled' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                          ○ Disabled
                        </span>
                      )}
                      {browserPushStatus === 'default' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Permission Not Granted
                        </span>
                      )}
                      {browserPushStatus === 'denied' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Permission Blocked
                        </span>
                      )}
                      {browserPushStatus === 'unsupported' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
                          Browser Unsupported
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {browserPushStatus === 'enabled' && 'This browser is registered with Firebase Cloud Messaging and linked to your student account.'}
                      {browserPushStatus === 'disabled' && 'Notifications are currently deactivated on this browser device.'}
                      {browserPushStatus === 'default' && 'Click enable to allow browser notification permissions for HELIX.'}
                      {browserPushStatus === 'denied' && 'Notifications are blocked in your browser. Please allow notifications from your browser site settings.'}
                      {browserPushStatus === 'unsupported' && 'Your browser does not support the Web Push Notification API.'}
                    </p>
                  </div>

                  {/* Enable / Disable Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {browserPushStatus === 'enabled' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDisablePush}
                        isLoading={isRegisteringPush}
                        className="text-slate-600 border-slate-300 hover:bg-slate-100 cursor-pointer"
                      >
                        Disable Notifications
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleEnablePush}
                        isLoading={isRegisteringPush}
                        disabled={browserPushStatus === 'unsupported'}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                        leftIcon={<Bell className="w-4 h-4" />}
                      >
                        Enable Browser Notifications
                      </Button>
                    )}
                  </div>
                </div>

                {/* Send Test Notification Action */}
                {browserPushStatus === 'enabled' && (
                  <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Verify Device Delivery</h5>
                      <p className="text-[11px] text-slate-500">
                        Dispatch a verified test push notification to confirm background delivery to this device.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleSendTestPush}
                      isLoading={isSendingTestPush}
                      leftIcon={<Zap className="w-3.5 h-3.5 text-indigo-600" />}
                    >
                      Send Test Notification
                    </Button>
                  </div>
                )}

                {/* Test Push Result Feedback */}
                {testPushFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      testPushFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testPushFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{testPushFeedback.message}</span>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* In-App Delivery Card */}
            <Card>
              <CardHeader>
                <CardTitle>In-App Delivery</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Control in-app alerts and notifications center banners.</p>
              </CardHeader>
              <CardBody>
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">In-App Notification Banners</h4>
                      <p className="text-[11px] text-slate-500">Display alerts inside the top bar and notification center</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={inAppEnabled}
                    onChange={e => setInAppEnabled(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Right Column: Reminder Timing Schedule */}
          <div className="md:col-span-5 space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Reminder Schedule</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">When should Helix notify you before focus blocks?</p>
                </div>
              </CardHeader>
              <CardBody className="space-y-2.5">
                {[
                  { id: '10_min', label: '10 minutes before session' },
                  { id: '30_min', label: '30 minutes before session' },
                  { id: 'at_start', label: 'Right at start time' },
                  { id: '1_hour', label: '1 hour before session' },
                ].map(timing => {
                  const isSelected = reminderTimings.includes(timing.id);
                  return (
                    <button
                      key={timing.id}
                      type="button"
                      onClick={() => toggleTiming(timing.id)}
                      className={`w-full p-3 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/50 border-indigo-300 text-indigo-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <span>{timing.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  );
                })}
              </CardBody>
            </Card>

            <Button fullWidth size="md" variant="primary" onClick={handleSaveNotifications} isLoading={isSaving}>
              Save Notification Settings
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          Appearance Tab (Light, Dark, Eye Comfort Warm Light Mode)
          ========================================================================= */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Interface Appearance & Eye Protection</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your visual theme. Eye Comfort mode reflects warm soothing light to eliminate blue light strain.
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* 3 Appearance Modes Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Light Mode */}
                <div
                  onClick={() => handleThemeChange('light')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-center relative ${
                    selectedTheme === 'light'
                      ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <Sun className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Light Mode</h4>
                  <p className="text-[11px] text-slate-500 mt-1">High-contrast, crisp daylight interface</p>
                  {selectedTheme === 'light' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 mt-2.5">
                      <Check className="w-3 h-3" /> Active Theme
                    </span>
                  )}
                </div>

                {/* Dark Mode */}
                <div
                  onClick={() => handleThemeChange('dark')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-center relative ${
                    selectedTheme === 'dark'
                      ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <Moon className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Dark Mode</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Deep navy background for low light focus</p>
                  {selectedTheme === 'dark' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 mt-2.5">
                      <Check className="w-3 h-3" /> Active Theme
                    </span>
                  )}
                </div>

                {/* Eye Comfort Mode */}
                <div
                  onClick={() => handleThemeChange('eye-comfort')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-center relative ${
                    selectedTheme === 'eye-comfort'
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Eye Comfort</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Warm light reflection & blue light protect</p>
                  {selectedTheme === 'eye-comfort' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 mt-2.5">
                      <Check className="w-3 h-3" /> Active Theme
                    </span>
                  )}
                </div>
              </div>

              {/* Eye Comfort Warm Light Details Banner */}
              {selectedTheme === 'eye-comfort' && (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-900">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h5 className="text-xs font-bold">Warm Light Eye Protection Active</h5>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Eye Comfort shifts screen color temperature away from harsh 450nm blue wavelengths into a soft, warm amber glow. This relaxes ocular muscles and prevents circadian disruption during late night studying.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Blue Light Reduced</span>
                      <strong className="text-xs text-amber-700 font-bold">~65% Less Glare</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Light Reflection</span>
                      <strong className="text-xs text-amber-700 font-bold">Warm Amber Sepia</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Eye Fatigue</span>
                      <strong className="text-xs text-emerald-700 font-bold">Significantly Lower</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button size="sm" variant="primary" onClick={handleSaveAppearance} isLoading={isSaving}>
                  Save Appearance Preferences
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* =========================================================================
          Account Tab
          ========================================================================= */}
      {activeTab === 'account' && (
        <div className="space-y-6 max-w-3xl">
          {/* User Account Overview Card */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-indigo-500/20">
                  {(name || user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{name || user?.name || 'Helix Student'}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{user?.email || 'student@helix.edu'}</p>
                  <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                    {course || 'Computer Science'} {year ? `• Year ${year}` : ''}
                  </p>
                </div>
              </div>

              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm('Are you sure you want to sign out of your Helix account?')) {
                    logout();
                  }
                }}
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Sign Out
              </Button>
            </div>

            {/* Account Details & Security Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-700 text-xs font-bold">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Security & Authentication</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Protected via Supabase Auth with Row Level Security (RLS) & local offline cache.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-700 text-xs font-bold">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Data Synchronization</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Local offline storage active with auto-cloud persistence.
                </p>
              </div>
            </div>
          </Card>

          {/* Account Reference Card */}
          <Card className="p-6 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Session & Device Information</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Current active student profile and local database status.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Session Status</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated & Online
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Enrolled Subjects</span>
                <span className="font-bold text-slate-800">{enrolledSubjects.length} Active Courses</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Theme Setting</span>
                <span className="font-bold text-indigo-600 capitalize">{selectedTheme} Mode</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
