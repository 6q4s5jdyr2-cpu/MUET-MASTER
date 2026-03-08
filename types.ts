
export enum Category {
  HEALTH = 'Health & Lifestyle',
  EDUCATION = 'Education & Career',
  SCIENCE = 'Science & Technology',
  ENVIRONMENT = 'Environment',
  SOCIAL = 'Social Issues & Community',
  CONSUMERISM = 'Consumerism & Finance'
}

export interface MUETQuestion {
  id: string;
  category: Category;
  situation: string;
  topic: string;
  points: string[];
  task?: string;
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

export type View = 'HOME' | 'INDIVIDUAL' | 'GROUP' | 'PRACTICE' | 'RESULT';
