import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { AiService } from '../../services/aiService';
import { Sparkles, Key, Loader2, AlertCircle, X } from 'lucide-react';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (apiKey: string) => Promise<void>;
  title?: string;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  isOpen,
  onClose,
  onAnalyze,
  title = "AI Syllabus & Material Analysis"
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey('');
      setError(null);
      
      // Auto-start analysis immediately via backend AI service
      handleAnalyze('server-backend');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = async (keyToUse: string) => {
    if (keyToUse !== 'server-backend' && keyToUse.trim()) {
      AiService.setApiKey(keyToUse.trim());
    }
    
    setIsAnalyzing(true);
    setError(null);

    try {
      await onAnalyze(keyToUse);
      onClose();
    } catch (err: any) {
      console.warn('[AiAnalysisModal] Analysis error:', err);
      setError(err.message || "Failed to analyze document. You can optionally provide a Gemini or Groq API Key below.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200/90 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-500">Autonomous Curriculum & Question Generation</p>
            </div>
          </div>

          {!isAnalyzing && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isAnalyzing ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Analyzing Study Material...</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Extracting syllabus roadmap modules and generating verified practice quiz questions.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="space-y-1">
                  <p className="font-bold">Analysis Notice</p>
                  <p className="text-[11px] leading-relaxed">{error}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                You can optionally configure a personal Gemini or Groq API Key to override default rate limits.
              </p>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Optional Personal API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy... (Gemini) or gsk_... (Groq)"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-bold"
                onClick={() => handleAnalyze(apiKey || 'server-backend')}
              >
                Retry Analysis
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
