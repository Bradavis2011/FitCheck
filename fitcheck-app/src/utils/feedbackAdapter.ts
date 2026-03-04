import type { RevisionNote } from '../services/api.service';

export interface NormalizedFeedback {
  overallScore: number;
  whatsRight: string[];
  couldImprove: string[];
  takeItFurther: string[];
  editorialSummary: string;
  styleDNA?: any;
  revisionNotes?: RevisionNote[];
}

export function normalizeFeedback(raw: any): NormalizedFeedback {
  // v3.0 format: has whatsRight array
  if (Array.isArray(raw?.whatsRight)) {
    return {
      overallScore: raw.overallScore ?? 0,
      whatsRight: raw.whatsRight ?? [],
      couldImprove: raw.couldImprove ?? [],
      takeItFurther: raw.takeItFurther ?? [],
      editorialSummary: raw.editorialSummary ?? '',
      styleDNA: raw.styleDNA,
      revisionNotes: Array.isArray(raw.revisionNotes) ? raw.revisionNotes : undefined,
    };
  }
  // v1/v2 legacy format: has whatsWorking
  return {
    overallScore: raw?.overallScore ?? 0,
    whatsRight: (raw?.whatsWorking ?? []).map((w: any) =>
      typeof w === 'string' ? w : [w.point, w.detail].filter(Boolean).join(' — ')
    ),
    couldImprove: [
      ...(raw?.consider ?? []).map((c: any) =>
        typeof c === 'string' ? c : [c.point, c.detail].filter(Boolean).join(' — ')
      ),
      ...(raw?.quickFixes ?? []).map((f: any) =>
        typeof f === 'string' ? f : f.suggestion ?? ''
      ),
    ],
    takeItFurther: [],
    editorialSummary: raw?.summary ?? '',
    styleDNA: raw?.styleDNA,
  };
}
