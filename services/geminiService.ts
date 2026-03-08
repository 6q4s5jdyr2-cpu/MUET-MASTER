
import { GoogleGenAI, Type } from "@google/genai";
import { MUETFeedback, MUETQuestion, Category } from '../types';

export const generateMUETCards = async (isGroup: boolean): Promise<MUETQuestion[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = isGroup 
      ? `Generate 10 unique MUET Speaking Part 2 (Group Discussion) sets. Each set must have:
         1. A realistic situational context.
         2. A discussion topic/question.
         3. 5 distinct discussion points.
         4. A final task instruction.
         Categories: Health, Education, Science, Environment, Social, Consumerism.`
      : `Generate 10 unique MUET Speaking Part 1 (Individual Presentation) sets. Each set must have:
         1. A realistic situational context.
         2. A "Talk about" specific task topic.
         3. Points should be an empty array for Part 1.
         Categories: Health, Education, Science, Environment, Social, Consumerism.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: { type: Type.STRING, description: 'One of: ' + Object.values(Category).join(', ') },
              situation: { type: Type.STRING },
              topic: { type: Type.STRING },
              points: { type: Type.ARRAY, items: { type: Type.STRING } },
              task: { type: Type.STRING }
            },
            required: ['id', 'category', 'situation', 'topic', 'points']
          }
        }
      }
    });

    return JSON.parse(response.text || '[]') as MUETQuestion[];
  } catch (error) {
    console.error("Error generating cards:", error);
    return [];
  }
};

export const analyzeAudioResponse = async (base64Audio: string, mimeType: string, question: string): Promise<MUETFeedback> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            data: base64Audio,
            mimeType: mimeType
          }
        },
        {
          text: `Evaluate the candidate's speech on the topic: "${question}". If the audio is silent or contains no intelligible English speech, you MUST return scores of 0 and Band N/A.`
        }
      ],
      config: {
        systemInstruction: `### ROLE
You are a senior MUET (Malaysian University English Test) Speaking Examiner. You analyze student audio recordings for both fluency and content.

### CRITICAL: SILENCE DETECTION
If the audio provided is silent, contains only background noise, or has no intelligible English speech:
1. Set "band" to "N/A".
2. Set "aggregate_score" and "rank_score" to 0.
3. Set "raw_transcript" and "annotated_transcript" to "No speech detected."
4. In "weaknesses", state "No speech was detected in the recording."
Do NOT hallucinate a response or provide a grade if the user didn't speak.

### SCORING CRITERIA (IF SPEECH IS DETECTED)
1. Task Fulfillment: Relevance to the prompt.
2. Language: Grammar, vocabulary selection, and pronunciation.
3. Organization: Logic, use of cohesive devices, and flow.

### RESPONSE FORMAT
Return a valid JSON object matching the requested schema.
The "annotated_transcript" should be a high-fidelity transcript of EXACTLY what the user said. 
Insert [TICK] immediately after excellent vocabulary or logic.
Insert [CROSS] immediately after grammatical errors or excessive fillers.

Rank Score (0-100): Percentile rank.
Aggregate Score (0-90): Official component score.`,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            evaluation: {
              type: Type.OBJECT,
              properties: {
                band: { type: Type.STRING },
                aggregate_score: { type: Type.NUMBER },
                rank_score: { type: Type.NUMBER },
                cefr_level: { type: Type.STRING }
              },
              required: ['band', 'aggregate_score', 'rank_score', 'cefr_level']
            },
            feedback: {
              type: Type.OBJECT,
              properties: {
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvement_tip: { type: Type.STRING }
              },
              required: ['strengths', 'weaknesses', 'improvement_tip']
            },
            raw_transcript: { type: Type.STRING },
            annotated_transcript: { type: Type.STRING }
          },
          required: ['evaluation', 'feedback', 'raw_transcript', 'annotated_transcript']
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    const result = JSON.parse(response.text) as MUETFeedback;
    
    // Safety check for hallucinated success when no transcript exists
    if (!result.raw_transcript || result.raw_transcript.toLowerCase().includes("no speech detected") || result.raw_transcript.length < 5) {
      if (result.evaluation.aggregate_score > 10) {
         result.evaluation.band = "N/A";
         result.evaluation.aggregate_score = 0;
         result.evaluation.rank_score = 0;
         result.feedback.strengths = ["N/A"];
         result.feedback.weaknesses = ["No intelligible speech was recorded."];
      }
    }

    return result;
  } catch (error) {
    console.error("Error analyzing audio:", error);
    throw error;
  }
};
