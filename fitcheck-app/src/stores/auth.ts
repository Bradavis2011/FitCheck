import { create } from 'zustand';
import { FeedbackResponse, OutfitCheck } from '../lib/mockData';

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

  // Outfits
  outfits: OutfitCheck[];

  // Check flow actions
  setCapturedImage: (image: string | null) => void;
  toggleOccasion: (occasion: string) => void;
  setSelectedSetting: (setting: string | null) => void;
  setSelectedWeather: (weather: string | null) => void;
  toggleVibe: (vibe: string) => void;
  setConcerns: (text: string) => void;
  setEventDate: (date: Date | null) => void;
  startAnalysis: () => void;
  setFeedback: (feedback: FeedbackResponse) => void;
  resetCheckFlow: () => void;

  // Outfit actions
  addOutfit: (outfit: OutfitCheck) => void;
  toggleFavorite: (outfitId: string) => void;
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
  outfits: [],

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
    }),

  addOutfit: (outfit) =>
    set((state) => ({ outfits: [outfit, ...state.outfits] })),
  toggleFavorite: (outfitId) =>
    set((state) => ({
      outfits: state.outfits.map((o) =>
        o.id === outfitId ? { ...o, isFavorite: !o.isFavorite } : o
      ),
    })),
}));
