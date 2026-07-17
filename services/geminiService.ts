
import { GoogleGenAI, Type } from "@google/genai";

const getGeminiClient = (): GoogleGenAI => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
  return new GoogleGenAI({
    ...(apiKey ? { apiKey } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const generateContentWithRetry = async (ai: GoogleGenAI, params: any, retries = 6, delay = 1000): Promise<any> => {
  const activeParams = { ...params };
  const modelsPool = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];

  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(activeParams);
    } catch (error: any) {
      console.error(`Gemini call failed (attempt ${i + 1}/${retries} using model ${activeParams.model}):`, error);
      
      let isTransient = false;
      const status = error?.status;
      const code = error?.code || error?.statusCode;
      const errStr = typeof error === 'object' ? JSON.stringify(error).toLowerCase() : String(error).toLowerCase();

      if (
        status === 'UNAVAILABLE' || 
        status === 'RESOURCE_EXHAUSTED' ||
        status === 'INTERNAL' ||
        code === 503 || 
        code === 429 ||
        code === 500 ||
        code === 504
      ) {
        isTransient = true;
      } else if (
        errStr.includes("503") || 
        errStr.includes("429") ||
        errStr.includes("500") ||
        errStr.includes("504") ||
        errStr.includes("unavailable") || 
        errStr.includes("resource_exhausted") ||
        errStr.includes("internal") ||
        errStr.includes("high demand") || 
        errStr.includes("temporary") ||
        errStr.includes("rate limit") ||
        errStr.includes("quota") ||
        errStr.includes("exhausted") ||
        errStr.includes("limit")
      ) {
        isTransient = true;
      }
      
      if (isTransient) {
        const currentModel = activeParams.model;
        let nextModel = currentModel;
        const currentIndex = modelsPool.indexOf(currentModel);

        if (currentIndex !== -1) {
          nextModel = modelsPool[(currentIndex + 1) % modelsPool.length];
        } else {
          nextModel = 'gemini-2.5-flash';
        }

        console.warn(`Falling back from ${currentModel} to ${nextModel} due to transient error or quota limit.`);
        activeParams.model = nextModel;
        
        if (i < retries - 1) {
          const waitTime = delay * Math.pow(1.5, i) + Math.random() * 500;
          console.warn(`Transient Gemini error encountered. Retrying in ${Math.round(waitTime)}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      throw error;
    }
  }
};
import { MUETFeedback, MUETQuestion, Category, MUETWritingFeedback } from '../types';

export const generateMUETCards = async (type: 'SPEAKING_PART1' | 'SPEAKING_PART2' | 'WRITING_TASK1' | 'WRITING_TASK2', model?: string, language?: string): Promise<MUETQuestion[]> => {
  try {
    const ai = getGeminiClient();
    const targetModel = model || 'gemini-2.5-flash';
    let prompt = '';
    
    if (type === 'SPEAKING_PART2') {
      prompt = `Generate 10 unique MUET Speaking Part 2 (Group Discussion) sets. Each set must have:
         1. A realistic situational context.
         2. A discussion topic/question.
         3. 5 distinct discussion points.
         4. A final task instruction.
         Categories: Health, Education, Science, Environment, Social, Consumerism.`;
    } else if (type === 'SPEAKING_PART1') {
      prompt = `Generate 10 unique MUET Speaking Part 1 (Individual Presentation) sets. Each set must have:
         1. A realistic situational context.
         2. A "Talk about" specific task topic.
         3. Points should be an empty array for Part 1.
         Categories: Health, Education, Science, Environment, Social, Consumerism.`;
    } else if (type === 'WRITING_TASK1') {
      prompt = `Generate 5 unique MUET Writing Task 1 (Guided Writing) sets. Each set must have:
         1. A realistic situation/context (e.g. email or letter).
         2. A specific writing topic/instruction.
         3. Points should be an empty array.
         4. Task should say "Write at least 100 words."
         Categories: Health, Education, Science, Environment, Social, Consumerism.`;
    } else {
      prompt = `Generate 5 unique MUET Writing Task 2 (Extended Writing) sets. Each set must have:
         1. A realistic situational context.
         2. An essay question (discursive, argumentative, or problem-solution).
         3. Points should be an empty array.
         4. Task should say "Write at least 250 words."
         Categories: Health, Education, Science, Environment, Social, Consumerism.`;
    }

    const response = await generateContentWithRetry(ai, {
      model: targetModel,
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
              task: { type: Type.STRING },
              email: { 
                type: Type.OBJECT,
                properties: {
                  from: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  message: { type: Type.STRING },
                  notes: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            required: ['id', 'category', 'situation', 'topic', 'points']
          }
        }
      }
    });

    return JSON.parse(response.text || '[]') as MUETQuestion[];
  } catch (error) {
    console.error("Error generating cards:", error);
    throw error;
  }
};

export const evaluateWritingResponse = async (essay: string, taskType: 'TASK1' | 'TASK2', topic: string, model?: string, language?: string): Promise<MUETWritingFeedback> => {
  try {
    const ai = getGeminiClient();
    const targetModel = model || 'gemini-2.5-flash';
    const languageInstruction = language === 'bilingual'
      ? `\n\n### LANGUAGE OF FEEDBACK
You MUST provide all feedback comments, strengths, weaknesses, and improvement tips in a BILINGUAL format (English accompanied by Malay translation in parentheses, or mixing both standard English and Malay/BM to help candidates who are still weak in English understand their mistakes clearly). For example: "Excellent grammar usage (Penggunaan tatabahasa yang sangat baik)." or "Try to use more academic vocabulary (Cuba gunakan lebih banyak perbendaharaan kata akademik)."`
      : `\n\n### LANGUAGE OF FEEDBACK
Provide all feedback comments, strengths, weaknesses, and improvement tips strictly in English. Do not use Malay.`;
    
    const prompt = taskType === 'TASK1' 
      ? `Evaluate the following MUET Writing Task 1 (Guided Writing - email/letter) based on the topic: "${topic}". The essay should be between 100-135 words.\n\nEssay:\n${essay}`
      : `Evaluate the following MUET Writing Task 2 (Extended Writing - essay) based on the topic: "${topic}". The essay should be at least 250 words.\n\nEssay:\n${essay}`;

    const response = await generateContentWithRetry(ai, {
      model: targetModel,
      contents: prompt,
      config: {
        systemInstruction: `### ROLE
You are a senior MUET (Malaysian University English Test) Writing Examiner. You analyze student essays for task fulfillment, language, and organization.

### SCORING CRITERIA
1. Task Fulfillment: Relevance, format, and word count. Task 1 expects a letter/email (100-135 words). Task 2 expects a full essay (minimum 250 words).
2. Language and Organization: Grammar, vocabulary selection, cohesion, sentence structure, and overall flow.${languageInstruction}

### RESPONSE FORMAT
Return a valid JSON object matching the requested schema.
The "annotated_essay" should be the original essay with annotations.
Insert [TICK] immediately after excellent vocabulary or logic.
Insert [CROSS|suggested correction] immediately after grammatical errors or poor phrasing.

Score: Score out of 90 (aggregate).`,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            evaluation: {
              type: Type.OBJECT,
              properties: {
                band: { type: Type.STRING },
                score: { type: Type.NUMBER },
                cefr_level: { type: Type.STRING }
              },
              required: ['band', 'score', 'cefr_level']
            },
            feedback: {
              type: Type.OBJECT,
              properties: {
                task_fulfilment: { type: Type.STRING },
                language_and_organization: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvement_tip: { type: Type.STRING }
              },
              required: ['task_fulfilment', 'language_and_organization', 'strengths', 'weaknesses', 'improvement_tip']
            },
            annotated_essay: { type: Type.STRING }
          },
          required: ['evaluation', 'feedback', 'annotated_essay']
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(response.text) as any;
  } catch (error) {
    console.error("Error analyzing writing:", error);
    throw error;
  }
};

export const analyzeAudioResponse = async (base64Audio: string, mimeType: string, question: string, durationSpoken: number, timeLimit: number, model?: string, language?: string): Promise<MUETFeedback> => {
  try {
    const cleanMimeType = mimeType.split(';')[0];
    const ai = getGeminiClient();
    const targetModel = model || 'gemini-2.5-flash';
    const languageInstruction = language === 'bilingual'
      ? `\n\n### LANGUAGE OF FEEDBACK
You MUST provide all feedback comments, strengths, weaknesses, and improvement tips in a BILINGUAL format (English accompanied by Malay translation in parentheses, or mixing both standard English and Malay/BM to help candidates who are still weak in English understand their mistakes clearly).`
      : `\n\n### LANGUAGE OF FEEDBACK
Provide all feedback comments, strengths, weaknesses, and improvement tips strictly in English. Do not use Malay.`;
    
    let timePenaltyInstruction = "";
    if (durationSpoken > timeLimit) {
      const overtime = Math.round(durationSpoken - timeLimit);
      timePenaltyInstruction = `\n### OVERTIME PENALTY\nThe candidate spoke for ${Math.round(durationSpoken)} seconds, which is ${overtime} seconds OVER the time limit of ${timeLimit} seconds. You MUST significantly penalize their "aggregate_score" and "rank_score", lower their Band if appropriate, and explicitly mention this time limit violation in their "weaknesses".`;
    }
 
    const response = await generateContentWithRetry(ai, {
      model: targetModel,
      contents: [
        {
          inlineData: {
            data: base64Audio,
            mimeType: cleanMimeType
          }
        },
        {
          text: `Evaluate the candidate's speech on the topic: "${question}". The candidate may speak in Malaysian English or use standard Malay loan words/code-switching. Do not harshly penalize local inflections if they maintain communicative competence. If the audio is silent or contains no intelligible speech, you MUST return scores of 0 and Band N/A.${timePenaltyInstruction}`
        }
      ],
      config: {
        systemInstruction: `### ROLE
You are a senior MUET (Malaysian University English Test) Speaking Examiner. You analyze student audio recordings for both fluency and content. ${languageInstruction}

### TRANSCRIBING MALAYSIAN ENGLISH & MALAY WORDS
1. You must accurately transcribe what the candidate says, including local Malaysian inflections, manglish, or Malay loan words (e.g., "lah", "kampung", "got", "boleh"). 
2. Do not "autocorrect" their Malaysian accent into standard American/British English if they used strong local phrasing. Capture exactly what was said.

### CRITICAL: SILENCE DETECTION
Listen to the ENTIRE audio file. If the audio is completely silent from start to finish, contains ONLY background noise, or has absolutely zero human speech:
1. Set "band" to "N/A".
2. Set "aggregate_score" and "rank_score" to 0.
3. Set "raw_transcript" and "annotated_transcript" to "No speech detected."
4. In "weaknesses", state "No speech was detected in the recording."
Do NOT hallucinate a response or provide a grade if the user didn't speak. However, if you hear ANY human speech, you must transcribe it.

### SCORING CRITERIA (IF SPEECH IS DETECTED)
1. Task Fulfillment: Relevance to the prompt.
2. Language: Grammar, vocabulary selection, and pronunciation.
3. Organization: Logic, use of cohesive devices, and flow.

### RESPONSE FORMAT
Return a valid JSON object matching the requested schema.
The "annotated_transcript" should be a high-fidelity transcript of EXACTLY what the user said. 
Insert [TICK] immediately after excellent vocabulary or logic.
Insert [CROSS|suggested correction] immediately after grammatical errors or excessive fillers (e.g., "he go [CROSS|he goes] there"). If there is no exact suggestion, just use [CROSS].

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
    if (!result.raw_transcript || result.raw_transcript.toLowerCase().includes("no speech detected") || result.raw_transcript.trim().length === 0) {
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

export const evaluateSimulatedTextResponse = async (textResponse: string, question: string, durationSpoken: number, timeLimit: number, model?: string, language?: string): Promise<MUETFeedback> => {
  try {
    const ai = getGeminiClient();
    const targetModel = model || 'gemini-2.5-flash';
    const languageInstruction = language === 'bilingual'
      ? `\n\n### LANGUAGE OF FEEDBACK
You MUST provide all feedback comments, strengths, weaknesses, and improvement tips in a BILINGUAL format (English accompanied by Malay translation in parentheses, or mixing both standard English and Malay/BM to help candidates who are still weak in English understand their mistakes clearly).`
      : `\n\n### LANGUAGE OF FEEDBACK
Provide all feedback comments, strengths, weaknesses, and improvement tips strictly in English. Do not use Malay.`;
    
    let timePenaltyInstruction = "";
    if (durationSpoken > timeLimit) {
      const overtime = Math.round(durationSpoken - timeLimit);
      timePenaltyInstruction = `\n### OVERTIME PENALTY\nThe candidate spoke for ${Math.round(durationSpoken)} seconds, which is ${overtime} seconds OVER the time limit of ${timeLimit} seconds. You MUST significantly penalize their "aggregate_score" and "rank_score", lower their Band if appropriate, and explicitly mention this time limit violation in their "weaknesses".`;
    }

    const response = await generateContentWithRetry(ai, {
      model: targetModel,
      contents: [
        {
          text: `Evaluate the candidate's spoken response on the topic: "${question}". Since the candidate's microphone was blocked, they typed the exact transcript of what they would have spoken: "${textResponse}". Evaluate this text as if it was a speech transcript. Rate their language, vocabulary, grammar, and organization under MUET standards. ${timePenaltyInstruction}`
        }
      ],
      config: {
        systemInstruction: `### ROLE
You are a senior MUET (Malaysian University English Test) Speaking Examiner. You analyze student response transcripts for both content, structure, and language proficiency. ${languageInstruction}

### SCORING CRITERIA
1. Task Fulfillment: Relevance to the prompt.
2. Language: Grammar, vocabulary selection, and logic.
3. Organization: Cohesive devices, structural flow, and transition words.

### RESPONSE FORMAT
Return a valid JSON object matching the requested schema.
The "annotated_transcript" should be the user's input text with senior examiner annotations:
Insert [TICK] immediately after excellent vocabulary or logic.
Insert [CROSS|suggested correction] immediately after grammatical errors or weak phrasing (e.g., "he go [CROSS|he goes] there").

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

    return JSON.parse(response.text) as MUETFeedback;
  } catch (error) {
    console.error("Error analyzing simulated text:", error);
    throw error;
  }
};
