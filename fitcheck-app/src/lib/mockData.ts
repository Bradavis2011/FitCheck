// Matched to Lovable mockup: src/lib/mockData.ts

export const occasions = ['Work', 'Casual', 'Date Night', 'Event', 'Interview', 'Other'] as const;
export const settings = ['Indoor', 'Outdoor', 'Both'] as const;
export const weather = ['Hot', 'Warm', 'Cool', 'Cold'] as const;
export const vibes = ['Professional', 'Trendy', 'Classic', 'Relaxed', 'Elegant', 'Sexy'] as const;
export const styles = ['Classic', 'Trendy', 'Minimalist', 'Bohemian', 'Edgy', 'Romantic'] as const;

export const loadingMessages = [
  'Analyzing your look...',
  'Checking color harmony...',
  'Evaluating silhouette...',
  'Assessing style elements...',
  'Almost ready...',
];

export const followUpSuggestions = [
  'What shoes would work?',
  'How can I dress this up?',
  'What accessories should I add?',
  'Is this too casual?',
];

export type FeedbackItem = {
  point: string;
  detail: string;
};

export type QuickFix = {
  suggestion: string;
  impact: string;
};

export type FeedbackResponse = {
  summary: string;
  occasionMatch: {
    score: number;
    notes: string;
  };
  whatsWorking: FeedbackItem[];
  consider: FeedbackItem[];
  quickFixes: QuickFix[];
};

export type OutfitCheck = {
  id: string;
  imageUrl: string;
  occasion: string;
  score: number;
  date: string;
  isFavorite: boolean;
  feedback: FeedbackResponse;
};

export const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};
