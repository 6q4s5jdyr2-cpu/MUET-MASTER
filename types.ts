
export enum Category {
  HEALTH = 'Health & Lifestyle',
  EDUCATION = 'Education & Career',
  SCIENCE = 'Science & Technology',
  ENVIRONMENT = 'Environment',
  SOCIAL = 'Social Issues & Community',
  CONSUMERISM = 'Consumerism & Finance'
}

export interface EmailPrompt {
  from: string;
  subject: string;
  message: string;
  notes: string[];
}

export interface MUETQuestion {
  id: string;
  category: Category;
  situation: string;
  topic: string;
  points: string[];
  task?: string;
  email?: EmailPrompt;
}

export interface MUETFeedback {
  evaluation: {
    band: string;
    aggregate_score: number;
    rank_score: number;
    cefr_level: string;
  };
  feedback: {
    strengths: string[];
    weaknesses: string[];
    improvement_tip: string;
  };
  raw_transcript: string;
  annotated_transcript: string;
}

export interface MUETWritingFeedback {
  evaluation: {
    band: string;
    score: number;
    cefr_level: string;
  };
  feedback: {
    task_fulfilment: string;
    language_and_organization: string;
    strengths: string[];
    weaknesses: string[];
    improvement_tip: string;
  };
  annotated_essay: string;
}

export type View = 'HOME' | 'INDIVIDUAL' | 'GROUP' | 'WRITING_TASK1' | 'WRITING_TASK2' | 'PRACTICE' | 'RESULT' | 'WRITING_PRACTICE' | 'WRITING_RESULT';
export type WritingTaskType = 'TASK1' | 'TASK2';
