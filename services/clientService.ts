import type { MUETQuestion, MUETWritingFeedback, MUETFeedback } from '../types';

export const generateMUETCards = async (type: 'SPEAKING_PART1' | 'SPEAKING_PART2' | 'WRITING_TASK1' | 'WRITING_TASK2', model?: string, language?: string): Promise<MUETQuestion[]> => {
  const response = await fetch('/api/generateMUETCards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, model, language })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const evaluateWritingResponse = async (essay: string, taskType: 'TASK1' | 'TASK2', topic: string, model?: string, language?: string): Promise<MUETWritingFeedback> => {
  const response = await fetch('/api/evaluateWriting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ essay, taskType, topic, model, language })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const analyzeAudioResponse = async (base64Audio: string, mimeType: string, question: string, durationSpoken: number, timeLimit: number, model?: string, language?: string): Promise<MUETFeedback> => {
  const response = await fetch('/api/analyzeAudio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Audio, mimeType, question, durationSpoken, timeLimit, model, language })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const evaluateSimulatedTextResponse = async (textResponse: string, question: string, durationSpoken: number, timeLimit: number, model?: string, language?: string): Promise<MUETFeedback> => {
  const response = await fetch('/api/evaluateSimulatedText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textResponse, question, durationSpoken, timeLimit, model, language })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
