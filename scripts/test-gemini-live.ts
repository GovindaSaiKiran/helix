// Test script to verify Gemini live connection
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
import { GeminiAdapter } from '../server/ai/adapters/geminiAdapter.js';

async function testGemini() {
  console.log('Testing Gemini live adapter...');
  const key = process.env.GEMINI_API_KEY;
  const model = 'gemini-1.5-flash';
  console.log('Configured Gemini model:', model);

  const adapter = new GeminiAdapter(key, model);
  const diag = await adapter.testConnection();
  console.log('Gemini Diagnostic:', JSON.stringify(diag, null, 2));
}

testGemini().catch(console.error);
