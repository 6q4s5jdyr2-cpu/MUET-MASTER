
import { Category, MUETQuestion } from './types';

// Individual Presentation - 6 Sets with 4 candidates each
export const INDIVIDUAL_SAMPLE_QUESTIONS: MUETQuestion[] = [
  // Set 1
  { id: 'i-s1-c1', category: Category.SOCIAL, situation: 'Your parents have managed to save some extra money this year and they would like to give you a gift as a reward for being a good student. What gift would you like?', topic: 'Getting cash as a reward', points: [] },
  { id: 'i-s1-c2', category: Category.SOCIAL, situation: 'Your parents have managed to save some extra money this year and they would like to give you a gift as a reward for being a good student. What gift would you like?', topic: 'Going on a holiday trip', points: [] },
  { id: 'i-s1-c3', category: Category.SOCIAL, situation: 'Your parents have managed to save some extra money this year and they would like to give you a gift as a reward for being a good student. What gift would you like?', topic: 'Getting a smartphone', points: [] },
  { id: 'i-s1-c4', category: Category.SOCIAL, situation: 'Your parents have managed to save some extra money this year and they would like to give you a gift as a reward for being a good student. What gift would you like?', topic: 'Getting an expensive bicycle', points: [] },
  
  // Set 2
  { id: 'i-s2-c1', category: Category.CONSUMERISM, situation: 'Nowadays many young people like to set up businesses to earn some extra money. What small business would you like to set up?', topic: 'Doing a delivery business', points: [] },
  { id: 'i-s2-c2', category: Category.CONSUMERISM, situation: 'Nowadays many young people like to set up businesses to earn some extra money. What small business would you like to set up?', topic: 'Offering photography services', points: [] },
  { id: 'i-s2-c3', category: Category.CONSUMERISM, situation: 'Nowadays many young people like to set up businesses to earn some extra money. What small business would you like to set up?', topic: 'Selling clothes online', points: [] },
  { id: 'i-s2-c4', category: Category.CONSUMERISM, situation: 'Nowadays many young people like to set up businesses to earn some extra money. What small business would you like to set up?', topic: 'Being a YouTuber', points: [] },
  
  // Set 3
  { id: 'i-s3-c1', category: Category.HEALTH, situation: 'Quality of life is the general well-being of individuals and societies. Suggest some ways to improve the quality of life among teenagers.', topic: 'Having a creative hobby', points: [] },
  { id: 'i-s3-c2', category: Category.HEALTH, situation: 'Quality of life is the general well-being of individuals and societies. Suggest some ways to improve the quality of life among teenagers.', topic: 'Having a balanced diet', points: [] },
  { id: 'i-s3-c3', category: Category.HEALTH, situation: 'Quality of life is the general well-being of individuals and societies. Suggest some ways to improve the quality of life among teenagers.', topic: 'Managing personal finance', points: [] },
  { id: 'i-s3-c4', category: Category.HEALTH, situation: 'Quality of life is the general well-being of individuals and societies. Suggest some ways to improve the quality of life among teenagers.', topic: 'Maintaining good hygiene', points: [] },

  // Set 4
  { id: 'i-s4-c1', category: Category.ENVIRONMENT, situation: 'Camping is a great way for us to enjoy nature and the environment. How do you prepare for a camping trip?', topic: 'Choosing the location', points: [] },
  { id: 'i-s4-c2', category: Category.ENVIRONMENT, situation: 'Camping is a great way for us to enjoy nature and the environment. How do you prepare for a camping trip?', topic: 'Buying the camping equipment', points: [] },
  { id: 'i-s4-c3', category: Category.ENVIRONMENT, situation: 'Camping is a great way for us to enjoy nature and the environment. How do you prepare for a camping trip?', topic: 'Bringing the food', points: [] },
  { id: 'i-s4-c4', category: Category.ENVIRONMENT, situation: 'Camping is a great way for us to enjoy nature and the environment. How do you prepare for a camping trip?', topic: 'Planning the activities', points: [] },

  // Set 5
  { id: 'i-s5-c1', category: Category.EDUCATION, situation: 'Using YouTube in education offers many benefits. Why do you like using YouTube to learn things?', topic: 'Fun lessons', points: [] },
  { id: 'i-s5-c2', category: Category.EDUCATION, situation: 'Using YouTube in education offers many benefits. Why do you like using YouTube to learn things?', topic: 'Easily accessed videos', points: [] },
  { id: 'i-s5-c3', category: Category.EDUCATION, situation: 'Using YouTube in education offers many benefits. Why do you like using YouTube to learn things?', topic: 'Difficult ideas made easy to understand', points: [] },
  { id: 'i-s5-c4', category: Category.EDUCATION, situation: 'Using YouTube in education offers many benefits. Why do you like using YouTube to learn things?', topic: 'Saving time and money', points: [] },

  // Set 6
  { id: 'i-s6-c1', category: Category.SOCIAL, situation: 'Many foreign students come to Malaysia to study and they may need some advice. What advice would you give them?', topic: 'Learning the Malay language', points: [] },
  { id: 'i-s6-c2', category: Category.SOCIAL, situation: 'Many foreign students come to Malaysia to study and they may need some advice. What advice would you give them?', topic: 'Renting a place in a safe area', points: [] },
  { id: 'i-s6-c3', category: Category.SOCIAL, situation: 'Many foreign students come to Malaysia to study and they may need some advice. What advice would you give them?', topic: 'Making some local friends', points: [] },
  { id: 'i-s6-c4', category: Category.SOCIAL, situation: 'Many foreign students come to Malaysia to study and they may need some advice. What advice would you give them?', topic: 'Being up to date with local news', points: [] }
];

// Group Discussion - 6 Sets
export const GROUP_SAMPLE_QUESTIONS: MUETQuestion[] = [
  {
    id: 'g-s1',
    category: Category.SOCIAL,
    situation: 'Most of us enjoy giving and receiving gifts. The gift industry is doing good business because it has many new interesting features. Discuss the features that have made the gift industry successful.',
    topic: 'Successful features of the gift industry',
    points: ['Delivery options', 'Latest trends', 'Personalised options', 'Unique gifts', 'Online marketing'],
    task: 'Try to decide on the main feature that has made the gift industry highly successful.'
  },
  {
    id: 'g-s2',
    category: Category.CONSUMERISM,
    situation: 'Running a small business is not easy. Having a good business partner with useful knowledge will help make the business successful. Discuss what knowledge a business partner should have.',
    topic: 'Knowledge for a business partner',
    points: ['Money management', 'Information technology', 'Sales and marketing', 'Law', 'Creative design'],
    task: 'Try to decide the most useful type of knowledge a good business partner should have.'
  },
  {
    id: 'g-s3',
    category: Category.SCIENCE,
    situation: 'Science, Technology, Engineering and Mathematics (STEM) subjects are important for development. Discuss how to encourage students to study STEM subjects.',
    topic: 'Encouraging students to study STEM',
    points: ['Hands-on activities', 'STEM competitions', 'Awareness campaigns', 'Scholarships', 'Fun learning'],
    task: 'Try to decide the best way to encourage students to study STEM subjects.'
  },
  {
    id: 'g-s4',
    category: Category.ENVIRONMENT,
    situation: 'Every year, we celebrate Earth Day on April 22nd. It is celebrated to emphasize the importance of protecting our natural environment for future generations. In your group, discuss some ways to encourage people to participate in Earth Day.',
    topic: 'What are ways to encourage people to participate in Earth Day?',
    points: ['Educate people', 'Community clean-up', 'Encourage green living', 'Tree planting', 'Work with school'],
    task: 'At the end of the discussion, try to decide the best way to encourage people to participate in Earth Day.'
  },
  {
    id: 'g-s5',
    category: Category.EDUCATION,
    situation: 'Educational technology has been one way to achieve the educational goals of the nation. There are additional ways to achieve high-quality education. Discuss the additional ways to achieve high-quality education.',
    topic: 'What additional ways can be used to achieve high-quality education?',
    points: ['Revised curriculum', 'Up-to-date facilities', '21st century skills', 'Improved assessment', 'Industry internships'],
    task: 'At the end of the discussion, try to decide the best additional way that can be used to achieve high-quality education.'
  },
  {
    id: 'g-s6',
    category: Category.SOCIAL,
    situation: 'Educational technology has been one way to achieve the educational goals of the nation. There are additional ways to achieve high-quality education. Discuss the additional ways to achieve high-quality education.',
    topic: 'What factors attract international students to Malaysian educational institutions?',
    points: ['Facilities', 'Teaching staff', 'Location', 'Relevant degrees', 'Cost of living'],
    task: 'At the end of the discussion, try to decide the most important factor that attracts international students to Malaysian educational institutions.'
  }
];

export const INITIAL_QUESTIONS = [...INDIVIDUAL_SAMPLE_QUESTIONS, ...GROUP_SAMPLE_QUESTIONS];
