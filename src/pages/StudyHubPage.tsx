import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ProgressBar } from '../components/common/ProgressBar';
import { ItemStatusBadge } from '../components/common/StatusBadge';
import { TimelineItem } from '../components/common/TimelineItem';
import { StudyService } from '../services/studyService';
import { SubjectService } from '../services/subjectService';
import { TaskService } from '../services/taskService';
import { Subject, SyllabusUnit, StudyMaterial, Task, ScheduleSlot } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { SubjectModal } from '../components/shared/SubjectModal';
import { AiAnalysisModal } from '../components/study/AiAnalysisModal';
import { McqPracticeView } from '../components/study/McqPracticeView';
import { AiService } from '../services/aiService';
import { McqService } from '../services/mcqService';
import { PdfParser } from '../utils/pdfParser';
import { YouTubeService, YouTubeVideo } from '../services/youtubeService';
import { BookOpen, FileText, Plus, ArrowRight, CheckCircle2, Sparkles, Upload, Trash2, FolderPlus, ListTodo, Video, Search, PlayCircle } from 'lucide-react';

export const StudyHubPage: React.FC = () => {
  const { user } = useAuth();
  const { completeTask, startTask, pauseTask, removeTask } = usePlan();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [units, setUnits] = useState<SyllabusUnit[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'syllabus' | 'materials' | 'tasks' | 'videos'>('syllabus');
  const [isLoading, setIsLoading] = useState(true);

  // YouTube Video Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  // AI Analysis State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [materialToAnalyze, setMaterialToAnalyze] = useState<StudyMaterial | null>(null);
  const [fileToAnalyze, setFileToAnalyze] = useState<File | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const subs = await SubjectService.getSubjects(user?.id);
      setSubjects(subs);
      if (subs.length > 0) {
        const activeId = selectedSubjectId || subs[0].id;
        setSelectedSubjectId(activeId);
        const [u, m, t] = await Promise.all([
          StudyService.getUnitsBySubject(activeId),
          StudyService.getMaterials(user?.id, activeId),
          TaskService.getTasks(user?.id)
        ]);
        setUnits(u);
        setMaterials(m);
        setTasks(t.filter(task => task.subjectId === activeId));
      } else {
        setUnits([]);
        setMaterials([]);
        setTasks([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, selectedSubjectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // In a real app, upload file to a storage bucket and get URL.
    // For this prototype, we mock the upload and store it locally
    const newMaterial: StudyMaterial = {
      id: crypto.randomUUID(),
      subjectId: selectedSubjectId,
      title: file.name,
      fileType: 'pdf',
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      uploadedAt: new Date().toISOString(),
      analysisStatus: 'pending'
    };
    
    setMaterials([...materials, newMaterial]);
    setFileToAnalyze(file);
    setMaterialToAnalyze(newMaterial);
    setIsAiModalOpen(true); // Auto-open analysis modal after upload
  };

  const handleAnalyzeClick = (mat: StudyMaterial) => {
    setMaterialToAnalyze(mat);
    setIsAiModalOpen(true);
  };

  const handlePerformAnalysis = async (apiKey: string) => {
    if (!materialToAnalyze || !user || !fileToAnalyze) return;

    // Set material to analyzing
    setMaterials(materials.map(m => m.id === materialToAnalyze.id ? { ...m, analysisStatus: 'analyzing' } : m));

    try {
      // 1. Parse PDF
      const pdfText = await PdfParser.extractText(fileToAnalyze);
      
      // 2. Call AI Service to get modules & MCQs
      const [roadmap, mcqs] = await Promise.all([
        AiService.generateRoadmap(pdfText, materialToAnalyze.id),
        AiService.generateMCQs(pdfText, materialToAnalyze.id, selectedSubjectId)
      ]);
      
      // 3. Inject modules as Tasks and Syllabus Topics
      await StudyService.createUnitWithTopics(user.id, selectedSubjectId, {
        unitNumber: units.length + 1,
        title: materialToAnalyze.title.replace('.pdf', '') + ' Roadmap',
        topics: roadmap.map(m => ({ title: m.title, estimatedMinutes: m.estimatedMinutes }))
      });

      for (const module of roadmap) {
        await TaskService.createTask(user.id, {
          title: module.title,
          description: module.description,
          subjectId: selectedSubjectId,
          type: 'study',
          priority: 'high',
          estimatedMinutes: module.estimatedMinutes,
          scheduledDate: new Date().toISOString().split('T')[0],
          scheduledStartTime: '10:00',
          scheduledEndTime: '11:00'
        });
      }

      // 4. Save MCQs
      McqService.saveMCQs(mcqs);

      // 5. Update status
      setMaterials(materials.map(m => m.id === materialToAnalyze.id ? { ...m, analysisStatus: 'completed' } : m));
      alert(`Success! Generated ${roadmap.length} modules and ${mcqs.length} practice questions.`);
      loadData();
    } catch (err: any) {
      console.error(err);
      setMaterials(materials.map(m => m.id === materialToAnalyze.id ? { ...m, analysisStatus: 'failed' } : m));
      throw err;
    }
  };

  const handleSearchVideos = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearchingVideos(true);
    setVideoError(null);
    try {
      const results = await YouTubeService.searchStudyVideos(searchQuery);
      setVideos(results);
    } catch (err: any) {
      setVideoError(err.message);
    } finally {
      setIsSearchingVideos(false);
    }
  };

  const handleDeleteSubject = async (subId: string, subName: string) => {
    if (window.confirm(`Are you sure you want to remove "${subName}" from your enrolled subjects?`)) {
      await SubjectService.deleteSubject(subId);
      const remaining = subjects.filter(s => s.id !== subId);
      setSubjects(remaining);
      if (selectedSubjectId === subId) {
        setSelectedSubjectId(remaining.length > 0 ? remaining[0].id : '');
      }
      loadData();
    }
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Hub"
        subtitle="Manage your university syllabus, topic hierarchies, and lecture notes."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsSubjectModalOpen(true)}
            >
              Add Subject
            </Button>
            {units.length > 0 && units[0]?.topics[0] && (
              <NavLink to={`/study/learn/${units[0].topics[0].id}`}>
                <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Continue Learning
                </Button>
              </NavLink>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['syllabus', 'materials', 'tasks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {subjects.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-lg mx-auto mt-6">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No subjects yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Add your university courses to begin tracking syllabus progress, uploading materials, and generating AI topic summaries.
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setIsSubjectModalOpen(true)}>
            + Add Your First Subject
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Col: Subjects List (4 cols) */}
          <div className="md:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Enrolled Subjects ({subjects.length})
              </h3>
              <button
                onClick={() => setIsSubjectModalOpen(true)}
                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2">
              {subjects.map(sub => {
                const isSelected = sub.id === selectedSubjectId;
                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubjectId(sub.id)}
                    className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 pr-6 truncate">{sub.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-indigo-600">{sub.syllabusCoverage}%</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubject(sub.id, sub.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-600 p-1 rounded-md hover:bg-red-50 text-slate-400 transition-opacity cursor-pointer"
                          title="Remove subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <ProgressBar value={sub.syllabusCoverage} size="xs" color="primary" />
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                      <span>{sub.code || 'Course'}</span>
                      <span>Target: {sub.targetGrade || 'A'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center/Right Col: Syllabus Units & Topics (8 cols) */}
          <div className="md:col-span-8 space-y-4">
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              {(['syllabus', 'materials', 'tasks', 'videos'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === 'videos' && selectedSubject) {
                      setSearchQuery(selectedSubject.name);
                    }
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'syllabus' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedSubject?.name || 'Subject'} Syllabus</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Unit-level topic decomposition and mastery tracking.
                    </p>
                  </div>
                <div className="flex items-center gap-2">
                  {selectedSubject && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      leftIcon={<Trash2 className="w-3 h-3" />}
                      onClick={() => handleDeleteSubject(selectedSubject.id, selectedSubject.name)}
                    >
                      Remove Subject
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardBody>
                {units.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <FolderPlus className="w-8 h-8 text-slate-300 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">No syllabus units created yet</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Upload your course syllabus PDF in the Materials tab to automatically generate syllabus topics using AI!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {units.map(unit => (
                      <div key={unit.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Unit Header */}
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {unit.unitNumber}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{unit.title}</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs font-bold text-indigo-600">{unit.progress}%</div>
                              <div className="text-[10px] text-slate-500">Mastery</div>
                            </div>
                            <ProgressBar value={unit.progress} size="sm" className="w-24" color="primary" />
                          </div>
                        </div>

                        {/* Topics List */}
                        {unit.topics.length === 0 ? (
                          <div className="p-4 text-center text-[11px] text-slate-500">
                            No topics added yet.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {unit.topics.map(topic => (
                              <NavLink
                                key={topic.id}
                                to={`/study/topic/${topic.id}`}
                                className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-1.5 h-1.5 rounded-full ${topic.status === 'completed' ? 'bg-green-500' : topic.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                                  <div>
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                      {topic.title}
                                    </p>
                                    {topic.description && (
                                      <p className="text-[11px] text-slate-500 truncate max-w-md">
                                        {topic.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                    {topic.estimatedMinutes}m
                                  </span>
                                  <ItemStatusBadge status={topic.status} />
                                </div>
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
            )}

            {activeTab === 'materials' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Study Materials</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Upload PDFs and analyze them with AI for roadmaps and MCQs.
                      </p>
                    </div>
                    <div>
                      <input
                        type="file"
                        id="pdf-upload"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <label htmlFor="pdf-upload">
                        <Button
                          size="xs"
                          variant="primary"
                          leftIcon={<Upload className="w-3 h-3" />}
                          onClick={() => document.getElementById('pdf-upload')?.click()}
                        >
                          Upload PDF
                        </Button>
                      </label>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {materials.length === 0 ? (
                      <div className="py-12 text-center space-y-3">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                        <h4 className="text-xs font-bold text-slate-700">No materials uploaded</h4>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Upload PDFs to automatically generate study roadmaps and practice questions.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {materials.map(mat => (
                          <div key={mat.id} className="p-3 border border-slate-200 rounded-xl bg-white hover:shadow-xs transition-shadow">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-900 truncate">{mat.title}</h4>
                                <p className="text-[11px] text-slate-500">{mat.fileSize} • Uploaded {new Date(mat.uploadedAt).toLocaleDateString()}</p>
                                
                                <div className="mt-3 flex items-center gap-2">
                                  {mat.analysisStatus === 'completed' ? (
                                    <>
                                      <Button size="xs" variant="outline" className="flex-1 text-[10px] text-green-600 border-green-200 bg-green-50 cursor-default">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Analyzed
                                      </Button>
                                      <Button 
                                        size="xs" 
                                        variant="primary" 
                                        className="flex-1 text-[10px]"
                                        onClick={() => setMaterialToAnalyze(mat)} 
                                      >
                                        Practice MCQs
                                      </Button>
                                    </>
                                  ) : (
                                    <Button 
                                      size="xs" 
                                      variant="outline" 
                                      className="w-full text-[10px]"
                                      onClick={() => handleAnalyzeClick(mat)}
                                    >
                                      <Sparkles className="w-3 h-3 mr-1 text-indigo-600" />
                                      {mat.analysisStatus === 'analyzing' ? 'Analyzing...' : 'Analyze PDF'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>

                {materialToAnalyze && materialToAnalyze.analysisStatus === 'completed' && (
                  <McqPracticeView materialId={materialToAnalyze.id} />
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Subject Tasks</h3>
                </div>
                {tasks.length === 0 ? (
                  <Card className="py-12 text-center space-y-3">
                    <ListTodo className="w-8 h-8 text-slate-300 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">No tasks for this subject</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Generate tasks from PDFs or add them from the Work page.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {tasks.map(task => (
                      <TimelineItem
                        key={task.id}
                        slot={{
                          id: task.id,
                          title: task.title,
                          timeSlot: task.scheduledDate || 'Unscheduled',
                          startTime: task.scheduledStartTime || '',
                          endTime: task.scheduledEndTime || '',
                          durationMinutes: task.estimatedMinutes,
                          category: 'study',
                          priority: task.priority,
                          progress: task.progress,
                          status: task.status,
                          dueInfo: task.dueDate ? `Due: ${task.dueDate}` : undefined
                        }}
                        onComplete={(id, elapsed) => completeTask(id, elapsed)}
                        onStart={(id) => startTask(id)}
                        onPause={(id, elapsed) => pauseTask(id, elapsed)}
                        onDelete={(id) => removeTask(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'videos' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Study Videos</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Search for educational tutorials and lectures on YouTube.
                    </p>
                  </CardHeader>
                  <CardBody>
                    <form onSubmit={handleSearchVideos} className="flex gap-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search for a topic..."
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                      <Button type="submit" variant="primary" disabled={isSearchingVideos}>
                        {isSearchingVideos ? 'Searching...' : 'Search'}
                      </Button>
                    </form>

                    {videoError && (
                      <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200 mb-4">
                        {videoError}
                      </div>
                    )}

                    {videos.length === 0 && !isSearchingVideos && !videoError ? (
                      <div className="py-12 text-center space-y-3">
                        <Video className="w-8 h-8 text-slate-300 mx-auto" />
                        <h4 className="text-xs font-bold text-slate-700">Search for study material</h4>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Enter a topic above to find relevant educational videos from YouTube.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {videos.map(video => (
                          <a
                            key={video.id}
                            href={`https://www.youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block rounded-xl overflow-hidden border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all"
                          >
                            <div className="relative aspect-video bg-slate-100 overflow-hidden">
                              <img 
                                src={video.thumbnailUrl} 
                                alt={video.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <PlayCircle className="w-12 h-12 text-white/90 drop-shadow-lg" />
                              </div>
                            </div>
                            <div className="p-3">
                              <h4 className="text-sm font-bold text-slate-900 line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors" dangerouslySetInnerHTML={{__html: video.title}} />
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-slate-500 truncate pr-2">{video.channelTitle}</p>
                                <Video className="w-4 h-4 text-red-500 shrink-0" />
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subject Modal */}
      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSuccess={loadData}
      />

      {/* AI Analysis Modal */}
      <AiAnalysisModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onAnalyze={handlePerformAnalysis}
        title={`Analyze ${materialToAnalyze?.title || 'Document'}`}
      />
    </div>
  );
};
