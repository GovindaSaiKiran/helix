import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ServerlessResponse extends ServerResponse {
  status?: (code: number) => ServerlessResponse;
  json?: (body: any) => void;
  send?: (body: any) => void;
}

interface ServerlessRequest extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[]>;
  method?: string;
  url?: string;
}

/**
 * Serverless API Handler for POST /api/ai/generate
 * Securely uses server-side GEMINI_API_KEY or GROQ_API_KEY without exposing keys to client bundle.
 */
export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    const body = JSON.stringify({ error: 'Method Not Allowed. Use POST.' });
    if (typeof res.json === 'function') {
      res.json({ error: 'Method Not Allowed. Use POST.' });
    } else {
      res.end(body);
    }
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    } else if (!body) {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        });
      });
    }

    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== 'string') {
      res.statusCode = 400;
      const err = { error: 'Prompt is required.' };
      if (typeof res.json === 'function') res.json(err);
      else res.end(JSON.stringify(err));
      return;
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Try Groq first if key configured
    if (groqKey) {
      const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
      for (const model of models) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: 'You are an expert AI educational assistant. Output strictly valid JSON without markdown formatting or code fences when requested.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2,
            }),
          });

          if (groqRes.ok) {
            const data: any = await groqRes.json();
            const text = data.choices?.[0]?.message?.content;
            if (text) {
              res.statusCode = 200;
              const payload = { text };
              if (typeof res.json === 'function') res.json(payload);
              else res.end(JSON.stringify(payload));
              return;
            }
          }
        } catch (e) {
          console.warn(`[Groq ${model} notice]:`, e);
        }
      }
    }

    // 2. Try Gemini
    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        res.statusCode = 200;
        const payload = { text };
        if (typeof res.json === 'function') res.json(payload);
        else res.end(JSON.stringify(payload));
        return;
      } catch (geminiErr: any) {
        console.warn('[Gemini 1.5 Flash error, trying 1.5 Pro]:', geminiErr);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        res.statusCode = 200;
        const payload = { text };
        if (typeof res.json === 'function') res.json(payload);
        else res.end(JSON.stringify(payload));
        return;
      }
    }

    // Fallback: If no server keys configured
    res.statusCode = 503;
    const noKeyPayload = {
      error: 'AI API Key is not configured on the server environment. Please add GEMINI_API_KEY or GROQ_API_KEY in Vercel settings.',
    };
    if (typeof res.json === 'function') res.json(noKeyPayload);
    else res.end(JSON.stringify(noKeyPayload));
  } catch (err: any) {
    console.error('[API /api/ai/generate error]:', err);
    res.statusCode = 500;
    const errPayload = { error: err.message || 'Internal AI generation error' };
    if (typeof res.json === 'function') res.json(errPayload);
    else res.end(JSON.stringify(errPayload));
  }
}
