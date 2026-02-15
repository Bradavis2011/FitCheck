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

export const sampleFeedback: FeedbackResponse = {
  summary: 'Great outfit choice! The color coordination is on point and the fit looks sharp.',
  occasionMatch: {
    score: 8,
    notes: 'Perfect for the occasion',
  },
  whatsWorking: [
    { point: 'Color Coordination', detail: 'The navy and white combination is classic and appropriate.' },
    { point: 'Fit', detail: 'Well-tailored pieces that complement your frame.' },
  ],
  consider: [
    { point: 'Accessories', detail: 'A watch or subtle bracelet could elevate the look.' },
  ],
  quickFixes: [
    { suggestion: 'Roll your sleeves once', impact: 'Adds a relaxed yet polished touch' },
    { suggestion: 'Tuck in the front of your shirt', impact: 'Creates a more intentional silhouette' },
  ],
};

export const sampleOutfits: OutfitCheck[] = [
  {
    id: '1',
    imageUrl: '',
    occasion: 'Work',
    score: 8.5,
    date: new Date().toISOString(),
    isFavorite: true,
    feedback: sampleFeedback,
  },
  {
    id: '2',
    imageUrl: '',
    occasion: 'Casual',
    score: 7.2,
    date: new Date(Date.now() - 86400000).toISOString(),
    isFavorite: false,
    feedback: sampleFeedback,
  },
  {
    id: '3',
    imageUrl: '',
    occasion: 'Date Night',
    score: 9.1,
    date: new Date(Date.now() - 172800000).toISOString(),
    isFavorite: true,
    feedback: sampleFeedback,
  },
];

export const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};
