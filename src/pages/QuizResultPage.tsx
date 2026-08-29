import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Sparkles, BookOpen } from 'lucide-react';
import { usePlan } from '../context/PlanContext';

export const QuizResultPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addUrgentTask } = usePlan();

  const state = location.state as {
    topicTitle?: string;
    scorePercent?: number;
    correctCount?: number;
    total?: number;
    questions?: any[];
    userAnswers?: Record<number, number>;
  } | null;

  const topicTitle = state?.topicTitle || 'Academic Topic';
  const scorePercent = state?.scorePercent !== undefined ? state.scorePercent : 85;
  const correctCount = state?.correctCount !== undefined ? state.correctCount : 3;
  const total = state?.total || 4;
  const isPassed = scorePercent >= 70;

  const handleAddRevisionBlock = async () => {
    await addUrgentTask(`Revision: ${topicTitle}`, 30);
    navigate('/today');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Quiz Completed! 🎉"
        subtitle={`Topic: ${topicTitle} • Automated mastery analysis and schedule update`}
      />

      {/* Main Result Score Card */}
      <Card padding="lg" className="text-center border-slate-200 shadow-md">
        <div
          className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-4 text-3xl font-extrabold mb-4 ${
            isPassed
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : 'bg-amber-50 border-amber-100 text-amber-700'
          }`}
        >
          {correctCount}/{total}
        </div>

        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {scorePercent}% Score
        </h2>

        <div className="mt-2">
          <Badge variant={isPassed ? 'success' : 'warning'} dot>
            {isPassed ? 'Topic Mastered (>= 70%)' : 'Needs Revision Practice'}
          </Badge>
        </div>

        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-3">
          {isPassed
            ? 'Excellent work! You demonstrated strong conceptual understanding of the core rules and constraints.'
            : 'Good effort! Some core definitions or constraints need additional review before semester exams.'}
        </p>

        {/* What's Next Smart Adaptation Card */}
        <div className="max-w-xl mx-auto mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-left flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-indigo-900">Recommended Action</h4>
              <p className="text-xs text-indigo-700 mt-0.5">
                {isPassed
                  ? 'Proceed to next syllabus unit or maintain buffer for upcoming projects.'
                  : 'Add a 30-min focused revision block into today’s schedule to reinforce weak areas.'}
              </p>
            </div>
          </div>
          {!isPassed && (
            <Button size="sm" variant="primary" onClick={handleAddRevisionBlock} className="shrink-0 text-xs">
              + Add Revision
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mt-8 pt-6 border-t border-slate-100">
          <NavLink to="/study">
            <Button variant="outline" size="sm">
              Back to Study Hub
            </Button>
          </NavLink>
          <NavLink to="/today">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              View Today's Plan
            </Button>
          </NavLink>
        </div>
      </Card>
    </div>
  );
};
