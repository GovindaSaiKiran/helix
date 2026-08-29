import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Clock, ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export const QuizPage: React.FC = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [topicTitle, setTopicTitle] = useState('Database Normalization (2NF)');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      setIsLoading(true);
      try {
        const title = topicId ? decodeURIComponent(topicId) : 'Database Normalization';
        setTopicTitle(title);
        const data = await ApiClient.generateQuiz(title, 'DBMS');
        setQuestions(data.questions || []);
      } catch (err) {
        console.warn('Error fetching quiz:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuiz();
  }, [topicId]);

  const currentQ = questions[currentQuestionIndex];
  const selectedOption = userAnswers[currentQuestionIndex] !== undefined ? userAnswers[currentQuestionIndex] : null;

  const handleSelectOption = (index: number) => {
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: index }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    try {
      let correctCount = 0;
      questions.forEach((q, idx) => {
        if (userAnswers[idx] === q.correctOptionIndex) {
          correctCount++;
        }
      });

      const total = questions.length || 1;
      const scorePercent = Math.round((correctCount / total) * 100);

      // Save to Supabase if user logged in
      if (user) {
        try {
          await supabase.from('quiz_results').insert({
            user_id: user.id,
            topic_id: topicId || null,
            score_percent: scorePercent,
            total_questions: total,
            correct_answers: correctCount,
            passed: scorePercent >= 70,
            feedback: scorePercent >= 70 ? 'Topic mastered! Strong foundation.' : 'Needs revision on key rules.',
          });
        } catch (dbErr) {
          console.warn('Error saving quiz result to DB:', dbErr);
        }
      }

      navigate('/study/quiz/result', {
        state: {
          topicTitle,
          scorePercent,
          correctCount,
          total,
          questions,
          userAnswers,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-slate-400 space-y-2">
        <Sparkles className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
        <p>Generating interactive quiz questions with verified options...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className="py-16 text-center space-y-4 max-w-lg mx-auto mt-12">
        <h3 className="text-base font-bold text-slate-800">Quiz Unavailable</h3>
        <p className="text-xs text-slate-500">Could not generate questions for this topic at this moment.</p>
        <Button size="sm" variant="primary" onClick={() => navigate(-1)}>
          Return to Topic
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        breadcrumbs={[
          { label: 'Study Hub', href: '/study' },
          { label: topicTitle, href: `/study/learn/${topicId || ''}` },
          { label: 'Mastery Quiz' },
        ]}
        title={`${topicTitle} Quiz`}
        subtitle={`Question ${currentQuestionIndex + 1} of ${questions.length}`}
        actions={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Untimed Practice</span>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900 leading-relaxed">
            {currentQ?.question}
          </CardTitle>
        </CardHeader>

        <CardBody className="space-y-3 pt-4">
          {currentQ?.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const letter = String.fromCharCode(65 + idx);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {letter}
                </span>
                <span className="text-sm">{opt}</span>
              </button>
            );
          })}

          <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Previous
            </Button>

            {currentQuestionIndex < questions.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Next Question
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSubmitQuiz}
                isLoading={isSubmitting}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Submit & Grade Quiz
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
