import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '../common/Card';
import { Button } from '../common/Button';
import { AiService } from '../../services/aiService';
import { Sparkles, Key, Loader2 } from 'lucide-react';

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
  title = "AI Analysis"
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey('');
      setError(null);
      setIsAnalyzing(false);
      
      const hasKey = AiService.hasApiKey();
      if (hasKey) {
        // Automatically proceed if key exists in local storage or .env
        handleAnalyze('env-or-local-key');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = async (keyToUse: string) => {
    if (!keyToUse.trim()) {
      setError("API Key is required.");
      return;
    }

    if (keyToUse !== 'env-or-local-key') {
      AiService.setApiKey(keyToUse);
    }
    
    setIsAnalyzing(true);
    setError(null);

    try {
      await onAnalyze(keyToUse);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to analyze document.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4 text-indigo-600">
          <Sparkles className="w-6 h-6" />
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>

        {isAnalyzing ? (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Analyzing Document...</p>
            <p className="text-xs text-slate-500">Extracting roadmap and generating practice questions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Enter your Gemini API Key or Groq API Key to power the analysis. Your key is stored securely in your browser's local storage.
            </p>
            
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy... or gsk_..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleAnalyze(apiKey)}>
                Analyze Content
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
