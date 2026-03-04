import { create } from 'zustand';
import { FeedbackResponse } from '../lib/mockData';

export interface RevisionSource {
  id: string;
  occasions: string[];
  setting: string | null;
  weather: string | null;
  vibe: string | null;
  concerns: string | null;
}

interface AppState {
  // Onboarding
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;

  // Check flow
  capturedImage: string | null;
  selectedOccasions: string[];
  selectedSetting: string | null;
  selectedWeather: string | null;
  selectedVibes: string[];
  concerns: string;
  eventDate: Date | null;
  isAnalyzing: boolean;
  currentFeedback: FeedbackResponse | null;

  // Revision flow
  revisionSource: RevisionSource | null;
  setRevisionSource: (source: RevisionSource | null) => void;

  // Check flow actions
  setCapturedImage: (image: string | null) => void;
  toggleOccasion: (occasion: string) => void;
  setSelectedSetting: (setting: string | null) => void;
  setSelectedWeather: (weather: string | null) => void;
  toggleVibe: (vibe: string) => void;
  setConcerns: (text: string) => void;
  setEventDate: (date: Date | null) => void;
  startAnalysis: () => void;
  setFeedback: (feedback: FeedbackResponse | null) => void;
  resetCheckFlow: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  hasCompletedOnboarding: false,
  capturedImage: null,
  selectedOccasions: [],
  selectedSetting: null,
  selectedWeather: null,
  selectedVibes: [],
  concerns: '',
  eventDate: null,
  isAnalyzing: false,
  currentFeedback: null,
  revisionSource: null,

  completeOnboarding: () => set({ hasCompletedOnboarding: true }),

  setCapturedImage: (image) => set({ capturedImage: image }),
  toggleOccasion: (occasion) =>
    set((state) => ({
      selectedOccasions: state.selectedOccasions.includes(occasion)
        ? state.selectedOccasions.filter((o) => o !== occasion)
        : [...state.selectedOccasions, occasion],
    })),
  setSelectedSetting: (setting) => set({ selectedSetting: setting }),
  setSelectedWeather: (weather) => set({ selectedWeather: weather }),
  toggleVibe: (vibe) =>
    set((state) => ({
      selectedVibes: state.selectedVibes.includes(vibe)
        ? state.selectedVibes.filter((v) => v !== vibe)
        : [...state.selectedVibes, vibe],
    })),
  setConcerns: (text) => set({ concerns: text }),
  setEventDate: (date) => set({ eventDate: date }),
  startAnalysis: () => set({ isAnalyzing: true }),
  setFeedback: (feedback) => set({ currentFeedback: feedback, isAnalyzing: false }),
  setRevisionSource: (source) => set({ revisionSource: source }),

  resetCheckFlow: () =>
    set({
      capturedImage: null,
      selectedOccasions: [],
      selectedSetting: null,
      selectedWeather: null,
      selectedVibes: [],
      concerns: '',
      eventDate: null,
      currentFeedback: null,
      isAnalyzing: false,
      revisionSource: null,
    }),
}));
