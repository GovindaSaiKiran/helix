// Test script to verify Groq live connection with configured GROQ_MODEL
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
import { GroqAdapter } from '../server/ai/adapters/groqAdapter.js';

async function testGroq() {
  console.log('Testing Groq live adapter...');
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  console.log('Configured Groq model:', model);

  const adapter = new GroqAdapter(key, model);
  const diag = await adapter.testConnection();
  console.log('Groq Diagnostic:', JSON.stringify(diag, null, 2));
}

testGroq().catch(console.error);
