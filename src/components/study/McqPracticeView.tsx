import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '../common/Card';
import { Button } from '../common/Button';
import { MCQQuestion, MCQResult } from '../../types';
import { McqService } from '../../services/mcqService';
import { CheckCircle2, XCircle, ArrowRight, Brain } from 'lucide-react';

interface McqPracticeViewProps {
  materialId: string;
}

export const McqPracticeView: React.FC<McqPracticeViewProps> = ({ materialId }) => {
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<string, MCQResult>>({});
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const loaded = McqService.getMCQs(materialId);
    setQuestions(loaded);
    
    const loadedResults = McqService.getResults(materialId);
    const resultMap: Record<string, MCQResult> = {};
    loadedResults.forEach(r => resultMap[r.questionId] = r);
    setResults(resultMap);
  }, [materialId]);

  if (questions.length === 0) {
    return null;
  }

  const question = questions[currentIndex];
  const currentResult = results[question.id];
  const isAnswered = !!currentResult;

  const handleSelect = (optionId: string) => {
    if (isAnswered) return;

    const isCorrect = optionId === question.correctOptionId;
    const result: MCQResult = {
      questionId: question.id,
      selectedOptionId: optionId,
      isCorrect
    };

    const updated = { ...results, [question.id]: result };
    setResults(updated);
    McqService.saveResult(result);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const correctCount = Object.values(results).filter(r => r.isCorrect).length;
  const progress = (Object.keys(results).length / questions.length) * 100;

  return (
    <Card className="border-indigo-100 shadow-sm overflow-hidden">
      <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800">Practice Quiz</h3>
        </div>
        <div className="text-xs font-bold text-slate-500">
          Score: <span className="text-indigo-600">{correctCount}</span> / {questions.length}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="h-1 bg-slate-100">
        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <CardBody className="p-6">
        <p className="text-sm font-bold text-slate-500 mb-2">Question {currentIndex + 1} of {questions.length}</p>
        <h4 className="text-base font-medium text-slate-900 mb-6 leading-relaxed">
          {question.questionText}
        </h4>

        <div className="space-y-3">
          {question.options.map(opt => {
            let stateClass = "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30";
            if (isAnswered) {
              if (opt.id === question.correctOptionId) {
                stateClass = "border-green-500 bg-green-50 ring-1 ring-green-500";
              } else if (opt.id === currentResult.selectedOptionId && !currentResult.isCorrect) {
                stateClass = "border-red-400 bg-red-50";
              } else {
                stateClass = "border-slate-100 opacity-50";
              }
            }

            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                disabled={isAnswered}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${stateClass}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{opt.text}</span>
                  {isAnswered && opt.id === question.correctOptionId && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {isAnswered && opt.id === currentResult.selectedOptionId && !currentResult.isCorrect && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {showExplanation && (
          <div className={`mt-6 p-4 rounded-xl text-sm ${currentResult.isCorrect ? 'bg-green-50/50 border border-green-100' : 'bg-red-50/50 border border-red-100'}`}>
            <p className="font-bold mb-1">{currentResult.isCorrect ? 'Correct!' : 'Incorrect'}</p>
            <p className="text-slate-700 leading-relaxed">{question.explanation}</p>
            
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant={currentResult.isCorrect ? 'primary' : 'outline'} onClick={handleNext}>
                {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                {currentIndex < questions.length - 1 && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
