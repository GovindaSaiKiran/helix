import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PlanProvider } from './context/PlanContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppLayout } from './components/layout/AppLayout';

// All 16 Page Route Components
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { TodayPage } from './pages/TodayPage';
import { WeekPage } from './pages/WeekPage';
import { WorkPage } from './pages/WorkPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { StudyHubPage } from './pages/StudyHubPage';
import { TopicLearningPage } from './pages/TopicLearningPage';
import { QuizPage } from './pages/QuizPage';
import { QuizResultPage } from './pages/QuizResultPage';
import { PlanningAgentPage } from './pages/PlanningAgentPage';
import { ReplanningPage } from './pages/ReplanningPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <PlanProvider>
        <NotificationProvider>
          <BrowserRouter>
            <Routes>
              {/* Public & Auth Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Authenticated Dashboard & Core App Routes inside AppLayout */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/today" element={<TodayPage />} />
                <Route path="/week" element={<WeekPage />} />
                <Route path="/work" element={<WorkPage />} />
                <Route path="/work/:id" element={<ProjectDetailPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/study" element={<StudyHubPage />} />
                <Route path="/study/learn/:topicId" element={<TopicLearningPage />} />
                <Route path="/study/topic/:topicId" element={<TopicLearningPage />} />
                <Route path="/study/quiz/:quizId" element={<QuizPage />} />
                <Route path="/study/quiz/result" element={<QuizResultPage />} />
                <Route path="/planning-agent" element={<PlanningAgentPage />} />
                <Route path="/replanning" element={<Navigate to="/week" replace />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </NotificationProvider>
      </PlanProvider>
    </AuthProvider>
  );
};

export default App;
