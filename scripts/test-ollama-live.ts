// Live verification script for Ollama open-weight model integration (qwen2.5-coder:3b)
// Tests diagnostic ping and a real HELIX study content generation workflow.

import { OllamaAdapter } from '../server/ai/adapters/ollamaAdapter.js';
import { extractAndParseJson, validateTopicContent } from '../server/ai/validator.js';

async function main() {
  console.log('================================================================');
  console.log('HELIX Live Open-Weight Model Verification (Ollama + qwen2.5-coder:3b)');
  console.log('================================================================');

  const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5-coder:3b');

  // Step 1: Live Diagnostic Probe
  console.log('\n[1/2] Testing live connection and diagnostic ping...');
  const diagnostic = await adapter.testConnection();
  console.log('Diagnostic result:', JSON.stringify(diagnostic, null, 2));

  if (!diagnostic.success) {
    console.error('Diagnostic test failed:', diagnostic.error);
    process.exit(1);
  }

  // Step 2: Real End-to-End HELIX Workflow: Topic Study Guide Generation
  console.log('\n[2/2] Executing live HELIX workflow: Topic Study Guide generation...');
  const prompt = `You are a university professor and academic tutor. Create complete, high-quality study content for the academic topic:
Topic: "Deadlock Detection & Prevention"
Course/Subject: "Operating Systems"

Return ONLY a valid JSON object matching this schema without markdown code fences:
{
  "topicTitle": "Deadlock Detection & Prevention",
  "subjectName": "Operating Systems",
  "keyPoints": [
    "Key definition 1",
    "Key definition 2",
    "Key definition 3"
  ],
  "simplifiedExplanation": "Intuitive everyday metaphor explaining deadlocks simply.",
  "fullExplanation": "Rigorous academic breakdown covering the 4 Coffman conditions and prevention strategies.",
  "examples": [
    "Concrete resource allocation graph or semaphore deadlock example."
  ],
  "examTips": [
    "Crucial exam tip for university finals."
  ]
}`;

  const startTime = Date.now();
  const result = await adapter.generateText(prompt, {
    responseFormat: 'json',
    temperature: 0.2,
    timeoutMs: 60000,
  });

  const durationMs = Date.now() - startTime;
  console.log(`\nModel inference completed in ${durationMs}ms`);
  console.log(`Tokens evaluated: ${result.usage?.promptTokens || 0} prompt, ${result.usage?.completionTokens || 0} completion`);
  console.log('\nRaw output preview:\n', result.text.slice(0, 400), '...\n');

  // Validate output against HELIX schema
  const parsed = extractAndParseJson(result.text);
  const validated = validateTopicContent(parsed, 'Deadlock Detection & Prevention');

  console.log('----------------------------------------------------------------');
  console.log('Validated Topic Study Guide:');
  console.log('Topic Title:', validated.topicTitle);
  console.log('Simplified Explanation:', validated.simplifiedExplanation);
  console.log('Key Points:', validated.keyPoints);
  console.log('Exam Tips:', validated.examTips);
  console.log('----------------------------------------------------------------');
  console.log('Live workflow verification: SUCCESS!');
}

main().catch((err) => {
  console.error('Live verification failed:', err);
  process.exit(1);
});
