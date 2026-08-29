import React, { useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ApiClient, TopicContentResponse, YouTubeSearchResult } from '../services/apiClient';
import { AiService } from '../services/aiService';
import { YouTubeService } from '../services/youtubeService';
import { StudyService } from '../services/studyService';
import { SubjectService } from '../services/subjectService';
import { StudyTimerModal } from '../components/shared/StudyTimerModal';
import { TaskService } from '../services/taskService';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Video,
  CheckCircle,
  HelpCircle,
  PlayCircle,
  ExternalLink,
  Clock,
  BookOpen,
  Pause,
  Play,
  Check,
  CheckCircle2,
} from 'lucide-react';

export const TopicLearningPage: React.FC = () => {
  const { user } = useAuth();
  const { topicId } = useParams<{ topicId: string }>();
  const [activeTab, setActiveTab] = useState<'explain' | 'simple' | 'notes' | 'examples' | 'exam' | 'videos'>('explain');

  const [topicTitle, setTopicTitle] = useState<string>('Module Study Guide');
  const [subjectName, setSubjectName] = useState<string>('Course Material');
  const [content, setContent] = useState<TopicContentResponse | null>(null);
  const [videos, setVideos] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);

  // Live Automatic Study Tracking State
  const [studySeconds, setStudySeconds] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(true);
  const [loggedMinutes, setLoggedMinutes] = useState<number>(0);

  // Live Timer Interval
  useEffect(() => {
    let interval: number | undefined;
    if (isTracking) {
      interval = window.setInterval(() => {
        setStudySeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isTracking]);

  // Sync tracked study time into TaskService periodically or on exit
  useEffect(() => {
    const syncStudyTime = async () => {
      if (studySeconds > 10) {
        const elapsedMins = Math.round(studySeconds / 60);
        if (elapsedMins > loggedMinutes) {
          setLoggedMinutes(elapsedMins);
          try {
            const allTasks = await TaskService.getTasks(user?.id);
            const matchingTask = allTasks.find(
              t => t.title.toLowerCase().includes(topicTitle.toLowerCase()) || (t as any).topicId === topicId
            );
            if (matchingTask) {
              await TaskService.updateTaskStatus(matchingTask.id, 'in_progress', undefined, elapsedMins);
            }
          } catch (e) {
            console.warn('Error syncing study time:', e);
          }
        }
      }
    };

    const interval = window.setInterval(syncStudyTime, 15000);
    return () => {
      window.clearInterval(interval);
      syncStudyTime();
    };
  }, [studySeconds, loggedMinutes, topicTitle, topicId, user?.id]);

  const formatStudyTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinishStudySession = async () => {
    setIsTracking(false);
    const finalMinutes = Math.max(1, Math.round(studySeconds / 60));
    try {
      const allTasks = await TaskService.getTasks(user?.id);
      const matchingTask = allTasks.find(
        t => t.title.toLowerCase().includes(topicTitle.toLowerCase()) || (t as any).topicId === topicId
      );
      if (matchingTask) {
        await TaskService.updateTaskStatus(matchingTask.id, 'completed', 100, finalMinutes);
      }
      alert(`🎉 Great work! Logged ${finalMinutes} minute(s) of study time to your weekly hours & analytics.`);
    } catch (e) {
      console.warn('Error completing task study session:', e);
    }
  };

  useEffect(() => {
    const resolveTopicDetails = async () => {
      if (!topicId) return;

      try {
        const subs = await SubjectService.getSubjects();
        for (const sub of subs) {
          const units = await StudyService.getUnitsBySubject(sub.id);
          for (const unit of units) {
            const found = unit.topics.find(t => t.id === topicId);
            if (found) {
              setTopicTitle(found.title);
              setSubjectName(sub.name);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Error resolving topic details:', e);
      }

      if (topicId && !topicId.startsWith('top_')) {
        setTopicTitle(decodeURIComponent(topicId));
      }
    };

    resolveTopicDetails();
  }, [topicId]);

  const loadAIContent = async () => {
    if (!topicTitle || topicTitle === 'Module Study Guide') return;
    setIsLoading(true);
    try {
      // 1. Generate study content with AiService directly
      const aiData = await AiService.generateTopicStudyContent(topicTitle, subjectName);
      setContent(aiData);

      // 2. Fetch YouTube study recommendations
      try {
        if (YouTubeService.hasApiKey()) {
          const ytResults = await YouTubeService.searchStudyVideos(topicTitle, 4);
          setVideos(ytResults.map(v => ({
            id: v.id,
            title: v.title,
            channelName: v.channelTitle,
            thumbnailUrl: v.thumbnailUrl,
            url: `https://www.youtube.com/watch?v=${v.id}`
          })));
        }
      } catch (ytErr) {
        console.warn('YouTube search fallback:', ytErr);
      }
    } catch (err) {
      console.warn('Error loading AI content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAIContent();
  }, [topicTitle, subjectName]);

  const tabs = [
    { id: 'explain', label: 'Detailed Explanation' },
    { id: 'simple', label: 'Explain Simply (Analogy)' },
    { id: 'notes', label: 'Key Points & Rules' },
    { id: 'examples', label: 'Worked Examples' },
    { id: 'exam', label: 'Exam Focus Points' },
    { id: 'videos', label: 'YouTube Lectures' },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Study Hub', href: '/study' },
          { label: subjectName, href: '/study' },
          { label: topicTitle },
        ]}
        title={topicTitle}
        subtitle={`${subjectName} • Adaptive Study & Topic Intelligence`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Study Session Timer Badge */}
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-900 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-mono text-indigo-700">⏱ {formatStudyTime(studySeconds)}</span>
              <span className="text-[10px] text-indigo-500 font-medium hidden sm:inline">(Tracking Hours)</span>
              
              <button
                type="button"
                onClick={() => setIsTracking(prev => !prev)}
                className="p-1 hover:bg-indigo-100 rounded text-indigo-700 transition-colors cursor-pointer ml-1"
                title={isTracking ? 'Pause timer' : 'Resume timer'}
              >
                {isTracking ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
              leftIcon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={handleFinishStudySession}
            >
              Finish & Log Session
            </Button>

            <NavLink to="/study">
              <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Study
              </Button>
            </NavLink>
            <NavLink to={`/study/quiz/${topicId || 'quiz_1'}`}>
              <Button size="sm" variant="primary" leftIcon={<HelpCircle className="w-4 h-4" />}>
                Take Quiz
              </Button>
            </NavLink>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Topic Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardBody className="space-y-5 text-sm text-slate-700 leading-relaxed min-h-[300px]">
              {isLoading ? (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <Sparkles className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
                  <p>Generating verified academic notes & synthesis with AI...</p>
                </div>
              ) : (
                <>
                  {activeTab === 'explain' && (
                    <div className="space-y-4 animate-in fade-in">
                      <h3 className="text-base font-bold text-slate-900">Foundational Concept</h3>
                      <p className="text-slate-700">
                        {content?.fullExplanation ||
                          'Detailed breakdown covering technical foundations, rules, and mathematical properties.'}
                      </p>
                      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                        <strong className="block text-indigo-950 font-bold">Academic Principle:</strong>
                        <span>Eliminates redundant storage and protects relational consistency during CRUD transactions.</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'simple' && (
                    <div className="space-y-4 animate-in fade-in">
                      <h3 className="text-base font-bold text-slate-900">Intuitive Analogy</h3>
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed font-medium">
                        💡 {content?.simplifiedExplanation || 'Think of this concept like an organized index where every item has a unique, dedicated position.'}
                      </div>
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="space-y-4 animate-in fade-in">
                      <h3 className="text-base font-bold text-slate-900">Key Rules & Core Points</h3>
                      <ul className="space-y-2 text-xs">
                        {(content?.keyPoints || [
                          'Every non-key attribute must be fully functionally dependent on the entire primary key.',
                          'Decomposes composite relations into atomic normalized tables.',
                          'Guarantees lossless join decomposition across foreign references.',
                        ]).map((pt, i) => (
                          <li key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="text-slate-800">{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeTab === 'examples' && (
                    <div className="space-y-4 animate-in fade-in">
                      <h3 className="text-base font-bold text-slate-900">Worked Exam Example</h3>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 space-y-2">
                        {(content?.examples || [
                          'Student_Enroll(StudentID [PK1], CourseID [PK2], CourseFee, Grade)\n→ CourseFee depends only on CourseID (violates 2NF)\n→ Decomposed into: Student_Grade(StudentID, CourseID, Grade) and Course(CourseID, CourseFee)',
                        ]).map((ex, i) => (
                          <pre key={i} className="whitespace-pre-wrap leading-relaxed">{ex}</pre>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'exam' && (
                    <div className="space-y-4 animate-in fade-in">
                      <h3 className="text-base font-bold text-slate-900">Semester Exam Tips</h3>
                      <div className="space-y-2 text-xs">
                        {(content?.examTips || [
                          'Always check if the relation has a single-attribute primary key. If so, it is automatically in 2NF.',
                          'Clearly write the functional dependency notation (A → B) before decomposing tables.',
                        ]).map((tip, i) => (
                          <div key={i} className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-900">
                            ⚠️ {tip}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'videos' && (
                    <div className="space-y-4 animate-in fade-in">
                      <h3 className="text-base font-bold text-slate-900">Educational YouTube Lectures</h3>
                      {videos.length === 0 ? (
                        <p className="text-xs text-slate-400 py-6 text-center">
                          No live YouTube results returned for this query.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {videos.map(v => (
                            <a
                              key={v.id}
                              href={v.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 transition-all block group"
                            >
                              {v.thumbnailUrl && (
                                <img
                                  src={v.thumbnailUrl}
                                  alt={v.title}
                                  className="w-full h-32 object-cover rounded-lg mb-2"
                                />
                              )}
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 line-clamp-2">
                                {v.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-1">{v.channelName}</p>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Col: Topic Practice & Timer (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session Focus</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-center space-y-2">
                <Clock className="w-6 h-6 text-indigo-600 mx-auto" />
                <h4 className="font-bold text-slate-900">Deep Work Timer</h4>
                <p className="text-slate-600">Track actual focus time logged towards this topic.</p>
                <Button size="sm" variant="primary" fullWidth onClick={() => setIsTimerOpen(true)}>
                  Launch Timer
                </Button>
              </div>

              <div className="pt-2">
                <NavLink to={`/study/quiz/${topicId || 'quiz_1'}`} className="block">
                  <Button size="sm" variant="outline" fullWidth leftIcon={<HelpCircle className="w-4 h-4" />}>
                    Test Understanding (Quiz)
                  </Button>
                </NavLink>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <StudyTimerModal
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        taskTitle={topicTitle}
        targetMinutes={45}
      />
    </div>
  );
};
