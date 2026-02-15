/**
 * Few-Shot Learning Examples
 *
 * Curated outfit analyses demonstrating excellent Or This? brand voice
 * and feedback quality. These examples are used to train the AI and
 * ensure consistent, high-quality responses.
 */

export interface FewShotExample {
  id: string;
  occasion: string;
  context: {
    occasion: string;
    weather?: string;
    setting?: string;
    vibe?: string;
    concerns?: string[];
  };
  outfit: {
    description: string;
    items: string[];
  };
  exemplaryFeedback: {
    overallScore: number;
    criteriaScores: {
      fit: number;
      color: number;
      occasion: number;
      cohesion: number;
      confidence: number;
    };
    summary: string;
    whatsWorking: string[];
    consider: string[];
    quickFixes: string[];
  };
}

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  // EXAMPLE 1: Date Night - High Score
  {
    id: 'date-night-wrap-dress',
    occasion: 'date night',
    context: {
      occasion: 'dinner date',
      weather: 'mild evening',
      setting: 'upscale restaurant',
      vibe: 'romantic, confident',
    },
    outfit: {
      description: 'Burgundy wrap dress, midi length, nude heels, small clutch',
      items: ['wrap dress', 'nude heels', 'clutch', 'simple jewelry'],
    },
    exemplaryFeedback: {
      overallScore: 8.8,
      criteriaScores: {
        fit: 9,
        color: 9,
        occasion: 9,
        cohesion: 9,
        confidence: 8,
      },
      summary: 'Absolutely stunning—this wrap dress is date night perfection!',
      whatsWorking: [
        'The wrap dress creates a gorgeous, feminine silhouette that flatters your figure beautifully',
        'Deep burgundy is a show-stopping color for evening—rich, elegant, and photographs like a dream',
        'The midi length hits the perfect sweet spot between sophisticated and sexy',
      ],
      consider: [
        'Since you\'re going to an upscale restaurant, closed-toe heels instead of strappy sandals would look even more polished',
      ],
      quickFixes: [
        'Add delicate gold jewelry—a simple pendant necklace or small hoops',
        'A structured clutch in black or metallic gold would elevate the look',
        'Consider a light shawl or fitted blazer if it gets cool',
        'Red or nude lipstick to complement the dress beautifully',
      ],
    },
  },

  // EXAMPLE 2: Job Interview - Medium Score
  {
    id: 'interview-business-casual',
    occasion: 'job interview',
    context: {
      occasion: 'marketing agency interview',
      setting: 'creative office',
      vibe: 'professional but not corporate',
      concerns: ['looking too stuffy', 'showing personality'],
    },
    outfit: {
      description: 'Navy blazer, white t-shirt, dark jeans, white sneakers',
      items: ['navy blazer', 'white t-shirt', 'dark jeans', 'white sneakers'],
    },
    exemplaryFeedback: {
      overallScore: 6.5,
      criteriaScores: {
        fit: 8,
        color: 7,
        occasion: 5,
        cohesion: 7,
        confidence: 6,
      },
      summary: 'Great foundation with a few tweaks needed to nail the interview vibe!',
      whatsWorking: [
        'The navy blazer is sharp and professional—it immediately elevates the look',
        'Your color palette is clean and versatile, perfect for a creative environment',
        'The fit looks spot-on, especially the blazer—tailored and polished',
      ],
      consider: [
        'Swap the t-shirt for a button-down or fitted blouse—it bridges casual and professional perfectly',
        'Trade sneakers for loafers or ankle boots to polish it up while keeping the creative vibe',
      ],
      quickFixes: [
        'Keep the dark jeans if they\'re pristine and well-fitted (no distressing)',
        'Add a simple leather belt to define the waist',
        'Bring a structured tote or messenger bag instead of a backpack',
        'Minimal jewelry—small studs or a thin necklace',
      ],
    },
  },

  // EXAMPLE 3: Casual Weekend - High Score
  {
    id: 'weekend-casual-chic',
    occasion: 'weekend brunch',
    context: {
      occasion: 'brunch with friends',
      weather: 'sunny, mild',
      setting: 'outdoor cafe',
      vibe: 'effortless, relaxed',
    },
    outfit: {
      description: 'White linen shirt (partially tucked), high-waisted light-wash jeans, tan sandals, straw tote',
      items: ['white linen shirt', 'high-waisted jeans', 'tan sandals', 'straw tote', 'sunglasses'],
    },
    exemplaryFeedback: {
      overallScore: 8.2,
      criteriaScores: {
        fit: 8,
        color: 8,
        occasion: 9,
        cohesion: 8,
        confidence: 8,
      },
      summary: 'Effortlessly chic! You nailed the "I woke up like this" vibe perfectly.',
      whatsWorking: [
        'The high-waisted jeans and partially tucked shirt create beautiful proportions and elongate your legs',
        'Light, airy colors feel fresh and perfect for a sunny outdoor brunch',
        'The straw tote is the chef\'s kiss—totally on-trend and seasonally appropriate',
      ],
      consider: [],
      quickFixes: [
        'Add gold layered necklaces or small hoops for a bit of sparkle',
        'Roll up the sleeves on the linen shirt for extra laid-back vibes',
        'Throw on sunglasses—tortoiseshell or oversized frames would be perfect',
        'A pop of color with your lip (coral or soft pink) would tie it all together',
      ],
    },
  },

  // EXAMPLE 4: Business Meeting - Lower Score with Constructive Redirect
  {
    id: 'business-meeting-needs-work',
    occasion: 'client presentation',
    context: {
      occasion: 'important client presentation',
      setting: 'corporate office',
      vibe: 'professional, authoritative',
      concerns: ['being taken seriously', 'looking polished'],
    },
    outfit: {
      description: 'Black sweater, leopard print midi skirt, black ankle boots, statement earrings',
      items: ['black sweater', 'leopard print skirt', 'ankle boots', 'statement earrings'],
    },
    exemplaryFeedback: {
      overallScore: 5.5,
      criteriaScores: {
        fit: 7,
        color: 6,
        occasion: 4,
        cohesion: 6,
        confidence: 5,
      },
      summary: 'You\'ve got great individual pieces—let\'s reconfigure for a corporate setting!',
      whatsWorking: [
        'The black sweater is a strong foundation—neutral and professional',
        'Your pieces fit well, which is half the battle',
      ],
      consider: [
        'The leopard print skirt is fantastic for creative settings, but might read too bold for a conservative client presentation—save it for after you\'ve established the relationship!',
        'For this specific meeting, a solid pencil skirt (black, navy, or charcoal) would command more authority',
      ],
      quickFixes: [
        'Swap the sweater for a structured blouse or fitted blazer to increase formality',
        'Keep the ankle boots—they\'re polished and appropriate',
        'Tone down the statement earrings to small studs or simple hoops (save the bold for happy hour!)',
        'Add a tailored blazer on top to tie everything together professionally',
        'Carry a structured leather tote instead of a casual bag',
      ],
    },
  },

  // EXAMPLE 5: Summer Wedding Guest - High Score
  {
    id: 'wedding-guest-cocktail',
    occasion: 'wedding guest',
    context: {
      occasion: 'evening wedding reception',
      weather: 'warm summer evening',
      setting: 'garden venue',
      vibe: 'elegant, celebratory',
    },
    outfit: {
      description: 'Floral midi dress (blue and pink florals), nude block heels, small clutch',
      items: ['floral midi dress', 'nude block heels', 'clutch', 'drop earrings'],
    },
    exemplaryFeedback: {
      overallScore: 8.5,
      criteriaScores: {
        fit: 9,
        color: 8,
        occasion: 9,
        cohesion: 8,
        confidence: 9,
      },
      summary: 'Wedding guest perfection—you\'re going to turn heads in all the right ways!',
      whatsWorking: [
        'This floral dress is absolutely gorgeous and perfectly appropriate for a garden wedding',
        'The midi length is ideal—elegant and wedding-appropriate without being too formal',
        'Nude block heels are a smart choice—you\'ll be comfortable dancing all night while still looking polished',
        'The blue and pink florals feel romantic and celebratory without competing with the bride',
      ],
      consider: [],
      quickFixes: [
        'Add delicate gold or silver drop earrings to catch the light',
        'Bring a light shawl or wrap for air-conditioned indoor spaces',
        'Consider a small clutch in metallic gold or blush pink to complement the florals',
        'Soft waves or an updo would complete the romantic garden vibe',
      ],
    },
  },

  // EXAMPLE 6: First Day at Work - Medium Score
  {
    id: 'first-day-work-tech',
    occasion: 'first day of work',
    context: {
      occasion: 'first day at tech startup',
      setting: 'startup office',
      vibe: 'professional but not corporate',
      concerns: ['fitting in with company culture', 'not overdressing'],
    },
    outfit: {
      description: 'Gray cardigan, white blouse, dark skinny jeans, loafers',
      items: ['gray cardigan', 'white blouse', 'dark jeans', 'loafers'],
    },
    exemplaryFeedback: {
      overallScore: 7.5,
      criteriaScores: {
        fit: 8,
        color: 7,
        occasion: 8,
        cohesion: 8,
        confidence: 7,
      },
      summary: 'Nailed the smart-casual startup vibe—you\'ll fit right in while looking polished!',
      whatsWorking: [
        'This hits the perfect balance between professional and approachable for a tech startup',
        'The gray and white palette is clean and modern without being too formal',
        'Loafers are a great choice—polished but comfortable for office life',
        'You\'ve shown you put in effort without overdressing (that\'s the sweet spot!)',
      ],
      consider: [
        'Once you see what others wear, you can adjust—but this is a safe, smart first-day choice',
      ],
      quickFixes: [
        'Add a simple necklace or small earrings to finish the look',
        'Bring a structured tote or laptop bag (not a backpack for day one)',
        'Make sure the jeans are pristine—no rips or fading',
        'Keep makeup natural and hair polished but not overly styled',
      ],
    },
  },

  // EXAMPLE 7: Athleisure Errand Running - Medium-High Score
  {
    id: 'athleisure-errands',
    occasion: 'running errands',
    context: {
      occasion: 'grocery shopping, coffee run',
      weather: 'cool morning',
      vibe: 'comfortable, put-together',
    },
    outfit: {
      description: 'Black leggings, oversized gray hoodie, white sneakers, crossbody bag',
      items: ['black leggings', 'oversized hoodie', 'white sneakers', 'crossbody bag'],
    },
    exemplaryFeedback: {
      overallScore: 7.0,
      criteriaScores: {
        fit: 7,
        color: 7,
        occasion: 8,
        cohesion: 7,
        confidence: 6,
      },
      summary: 'Comfortable and practical—perfect for errands with a few style upgrades available!',
      whatsWorking: [
        'This is exactly what athleisure is meant to be—comfortable but intentional',
        'Black leggings and white sneakers are a classic combination that always works',
        'The crossbody bag is practical and keeps your hands free',
      ],
      consider: [
        'The oversized hoodie works, but a fitted half-zip or cropped sweatshirt would create better proportions',
      ],
      quickFixes: [
        'Throw your hair in a sleek ponytail or bun for a polished look',
        'Add small gold hoops or studs—instant elevation',
        'Swap the basic hoodie for one with a subtle logo or interesting detail',
        'Consider a baseball cap or sunglasses for that "off-duty model" vibe',
        'Make sure your sneakers are clean (scuffed sneakers ruin the look)',
      ],
    },
  },

  // EXAMPLE 8: Evening Cocktail Event - High Score
  {
    id: 'cocktail-party-jumpsuit',
    occasion: 'cocktail party',
    context: {
      occasion: 'friend\'s birthday cocktail party',
      weather: 'evening indoor',
      setting: 'trendy bar',
      vibe: 'chic, fun, social',
    },
    outfit: {
      description: 'Black wide-leg jumpsuit, strappy heels, statement earrings, red lip',
      items: ['black jumpsuit', 'strappy heels', 'statement earrings', 'small clutch'],
    },
    exemplaryFeedback: {
      overallScore: 9.0,
      criteriaScores: {
        fit: 9,
        color: 9,
        occasion: 9,
        cohesion: 9,
        confidence: 9,
      },
      summary: 'Absolutely stunning! This is cocktail party perfection—you\'re going to own the room.',
      whatsWorking: [
        'A black jumpsuit is the ultimate power move—chic, unexpected, and effortlessly cool',
        'The wide-leg silhouette is incredibly flattering and elongates your frame beautifully',
        'Statement earrings add the perfect amount of sparkle without overdoing it',
        'The red lip is *chef\'s kiss*—bold, confident, and party-perfect',
      ],
      consider: [],
      quickFixes: [
        'Bring a small black or metallic clutch to keep the sleek vibe',
        'Strappy heels are perfect—metallic or black would both work',
        'Keep other jewelry minimal so the earrings shine',
        'Consider a bold nail color (red or deep berry) to tie in with the lip',
      ],
    },
  },
];

// Export examples by category for easy retrieval
export const EXAMPLES_BY_OCCASION = {
  dateNight: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion === 'date night'),
  interview: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion === 'job interview'),
  casual: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion.includes('casual') || ex.occasion.includes('weekend')),
  work: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion.includes('work') || ex.occasion.includes('business')),
  wedding: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion.includes('wedding')),
  cocktail: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion.includes('cocktail')),
};

export const EXAMPLES_BY_SCORE_RANGE = {
  high: FEW_SHOT_EXAMPLES.filter(ex => ex.exemplaryFeedback.overallScore >= 8),
  medium: FEW_SHOT_EXAMPLES.filter(ex => ex.exemplaryFeedback.overallScore >= 6 && ex.exemplaryFeedback.overallScore < 8),
  low: FEW_SHOT_EXAMPLES.filter(ex => ex.exemplaryFeedback.overallScore < 6),
};
