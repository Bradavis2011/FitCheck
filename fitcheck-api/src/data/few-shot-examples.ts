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
  // EXAMPLE 9: Streetwear - Style-Aligned Feedback (suggestions stay in the streetwear lane)
  {
    id: 'streetwear-casual-hangout',
    occasion: 'casual hangout',
    context: {
      occasion: 'hanging with friends',
      weather: 'cool evening',
      setting: 'downtown',
      vibe: 'relaxed, confident',
    },
    outfit: {
      description: 'Oversized graphic hoodie, baggy cargo pants, Air Force 1s, crossbody bag, snapback',
      items: ['graphic hoodie', 'cargo pants', 'Air Force 1s', 'crossbody bag', 'snapback'],
    },
    exemplaryFeedback: {
      overallScore: 7.5,
      criteriaScores: {
        fit: 7,
        color: 8,
        occasion: 8,
        cohesion: 8,
        confidence: 7,
      },
      summary: 'The streetwear foundation is solid—oversized proportions and a graphic statement piece that works.',
      whatsWorking: [
        'The oversized hoodie-to-cargo proportion is intentional and reads correctly—visual weight is distributed well',
        'Monochrome base lets the graphic hoodie be the focal point without competing elements',
        'The crossbody bag is practical and on-trend for the streetwear aesthetic',
      ],
      consider: [
        'The cargos are pooling at the shoe—a slightly tapered cargo or a pinroll at the ankle would clean up the break',
        'The crossbody bag color blends into the hoodie—a contrast tone like olive or tan would add visual interest',
      ],
      quickFixes: [
        'Swap the AF1s for a chunkier silhouette like New Balance 550s to add more dimension at the base',
        'Layer a bomber jacket or vest over the hoodie for a more considered streetwear stack',
        'Try a beanie instead of the snapback to shift the vibe from sporty to elevated street',
        'Add a simple chain or bracelet—one piece of hardware elevates the whole read',
      ],
    },
  },

  // EXAMPLE 10: Edgy/Alt - Style-Aligned Feedback (suggestions stay in the edgy lane)
  {
    id: 'edgy-concert-night',
    occasion: 'concert night out',
    context: {
      occasion: 'concert',
      weather: 'cool night',
      setting: 'music venue',
      vibe: 'bold, edgy',
    },
    outfit: {
      description: 'Black moto jacket, band tee, ripped black skinny jeans, combat boots, silver chain necklace',
      items: ['moto jacket', 'band tee', 'black skinny jeans', 'combat boots', 'chain necklace'],
    },
    exemplaryFeedback: {
      overallScore: 8.2,
      criteriaScores: {
        fit: 8,
        color: 8,
        occasion: 9,
        cohesion: 9,
        confidence: 8,
      },
      summary: 'The all-black palette with leather and hardware reads like you were born for this venue.',
      whatsWorking: [
        'The moto jacket is doing the heavy lifting—it creates structure over the relaxed band tee and anchors the entire look',
        'All-black creates an unbroken silhouette that reads intentional and confident',
        'The silver chain adds the right amount of edge without overdoing it—one focal accessory, correctly placed',
      ],
      consider: [
        'The band tee is slightly long under the jacket—a half-tuck or a cropped fit would create a better waist break',
      ],
      quickFixes: [
        'Add silver rings or a studded bracelet to build on the hardware theme you started with the chain',
        'Swap to a sharper boot silhouette like Chelsea boots for a sleeker version of the same energy',
        'A dark red or burgundy lip (any gender) would add a single warm accent to the monochrome palette',
        'Try a slimmer combat boot to avoid visual heaviness at the base',
      ],
    },
  },

  // EXAMPLE 11: Bohemian - Style-Aligned Feedback (suggestions stay in the boho lane)
  {
    id: 'boho-farmers-market',
    occasion: 'farmers market',
    context: {
      occasion: 'weekend farmers market',
      weather: 'warm morning',
      setting: 'outdoor market',
      vibe: 'relaxed, earthy',
    },
    outfit: {
      description: 'Flowy midi skirt in rust, cream crochet top, brown leather sandals, woven tote bag, layered necklaces',
      items: ['midi skirt', 'crochet top', 'leather sandals', 'woven tote', 'layered necklaces'],
    },
    exemplaryFeedback: {
      overallScore: 8.0,
      criteriaScores: {
        fit: 8,
        color: 9,
        occasion: 9,
        cohesion: 8,
        confidence: 7,
      },
      summary: 'Earth tones and natural textures—this is bohemian done with intention, not costume.',
      whatsWorking: [
        'The rust-and-cream palette is warm, cohesive, and reads beautifully in natural light',
        'Mixing crochet with a flowing skirt creates textural depth—two natural fabrics in conversation',
        'The layered necklaces are the right finishing touch and follow the boho jewelry code: more is more, but keep it delicate',
      ],
      consider: [
        'The sandals are blending in—a sandal with woven or braided detail would echo the crochet top and create more visual story',
      ],
      quickFixes: [
        'Add a wide-brim straw hat to complete the bohemian silhouette and add sun protection',
        'Swap the tote for a fringe or macramé crossbody for a more polished boho look',
        'Layer a lightweight kimono or linen duster for a third texture layer when the breeze picks up',
        'Add a wrist stack—mixed metals and natural materials like wood or shell beads',
      ],
    },
  },

  // EXAMPLE 12: Gym/Athleisure - Style-Aligned Feedback (suggestions stay in the athletic lane)
  {
    id: 'athleisure-gym-session',
    occasion: 'gym workout',
    context: {
      occasion: 'gym session',
      weather: 'indoor',
      setting: 'fitness center',
      vibe: 'motivated, put-together',
    },
    outfit: {
      description: 'Black compression leggings, oversized gray cotton tee, neon green running shoes, Apple Watch, hair in ponytail',
      items: ['compression leggings', 'oversized cotton tee', 'running shoes', 'sports watch'],
    },
    exemplaryFeedback: {
      overallScore: 6.5,
      criteriaScores: {
        fit: 6,
        color: 6,
        occasion: 8,
        cohesion: 6,
        confidence: 7,
      },
      summary: 'Functional and gym-ready—a few athletic-specific upgrades would take this from default to dialed-in.',
      whatsWorking: [
        'The compression leggings are a solid base—functional and flattering for movement',
        'Black-and-gray is a neutral athletic palette that works as a starting point',
      ],
      consider: [
        'The oversized cotton tee is absorbing sweat instead of wicking it—a performance fabric tee or tank would function and look better',
        'The neon shoes fight the neutral palette—a monochrome or tonal shoe would create a cleaner read',
      ],
      quickFixes: [
        'Swap the cotton tee for a fitted or cropped performance top to show the legging waistband and create proportional contrast',
        'Match the shoe to the outfit palette (black, gray, or white) for a more coordinated athletic look',
        'Add a matching sports bra visible at the neckline for a layered athletic set look',
        'A lightweight zip-up or hoodie tied at the waist adds a style layer to basic gym wear',
      ],
    },
  },

  // EXAMPLE 13: Grunge - Style-Aligned Feedback (suggestions stay in the grunge lane)
  {
    id: 'grunge-casual-day',
    occasion: 'casual day out',
    context: {
      occasion: 'record store and coffee',
      weather: 'overcast, cool',
      setting: 'urban',
      vibe: 'effortless, laid-back',
    },
    outfit: {
      description: 'Oversized red flannel, black band tee underneath, ripped light-wash jeans, beat-up Converse, beanie',
      items: ['flannel shirt', 'band tee', 'ripped jeans', 'Converse', 'beanie'],
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
      summary: 'The grunge DNA is solid—flannel over band tee is a classic formula that reads authentic here.',
      whatsWorking: [
        'Flannel over band tee is the grunge uniform done correctly—the layering reads intentional, not lazy',
        'The light-wash ripped jeans add contrast to the darker top half and break up the visual weight',
      ],
      consider: [
        'The Converse are reading worn-out rather than worn-in—there is a line between lived-in and needs-replacing',
        'Everything is slightly oversized with no contrast—one fitted element (cuffed jeans, tucked tee) would add intentionality',
      ],
      quickFixes: [
        'Cuff the jeans to just above the ankle to show the shoe and add a proportional break',
        'Upgrade to Doc Martens or clean Converse—same energy, sharper execution',
        'Layer a chain necklace over the band tee for the one detail that signals effort',
        'Push up the flannel sleeves to 3/4 length—it reads more considered than fully buttoned-down sleeves',
      ],
    },
  },

  // EXAMPLE 14: Clean Girl - Style-Aligned Feedback (suggestions stay in the clean-girl lane)
  {
    id: 'clean-girl-everyday',
    occasion: 'everyday errands',
    context: {
      occasion: 'coffee run and errands',
      weather: 'mild',
      setting: 'city',
      vibe: 'effortless, polished',
    },
    outfit: {
      description: 'White ribbed tank top, high-waisted beige wide-leg trousers, white Air Force 1s, gold hoop earrings, slicked-back bun',
      items: ['ribbed tank', 'wide-leg trousers', 'Air Force 1s', 'gold hoops'],
    },
    exemplaryFeedback: {
      overallScore: 8.0,
      criteriaScores: {
        fit: 8,
        color: 8,
        occasion: 8,
        cohesion: 9,
        confidence: 7,
      },
      summary: 'This is clean-girl executed with precision—the neutral palette and gold accents read polished without trying.',
      whatsWorking: [
        'The white-and-beige palette is tonal perfection—it reads effortless and expensive even if the pieces are affordable',
        'Gold hoops are the signature clean-girl accessory and they anchor the whole look',
        'Wide-leg trouser with a fitted tank creates the right proportional contrast—volume on bottom, streamlined on top',
      ],
      consider: [
        'The AF1s are slightly bulky for the wide-leg trouser silhouette—a slimmer white sneaker or flat would create a cleaner line at the ankle',
      ],
      quickFixes: [
        'Add a structured mini crossbody in tan or cream to continue the tonal story',
        'Layer a thin gold chain necklace with the hoops to complete the jewelry triangle',
        'A pair of minimal sunglasses (thin metal frames) elevates this from everyday to editorial',
        'Swap to white leather mules or ballet flats for a slightly more polished version of the same energy',
      ],
    },
  },

  // EXAMPLE 15: Gorpcore/Outdoor - Style-Aligned Feedback (suggestions stay in the outdoor lane)
  {
    id: 'gorpcore-weekend-hike',
    occasion: 'weekend hike',
    context: {
      occasion: 'day hike with friends',
      weather: 'cool morning, warming up',
      setting: 'trail and post-hike brunch',
      vibe: 'outdoorsy, practical',
    },
    outfit: {
      description: 'Olive fleece half-zip, black hiking pants, Salomon trail runners, beige baseball cap, small backpack',
      items: ['fleece half-zip', 'hiking pants', 'trail runners', 'baseball cap', 'backpack'],
    },
    exemplaryFeedback: {
      overallScore: 7.5,
      criteriaScores: {
        fit: 7,
        color: 8,
        occasion: 9,
        cohesion: 8,
        confidence: 7,
      },
      summary: 'The gorpcore palette is dialed—olive and black with a technical runner reads trail-ready and intentional.',
      whatsWorking: [
        'Olive fleece over black creates a grounded earth-tone palette that reads correctly for the trail and post-hike',
        'Salomon trail runners signal function and fashion simultaneously—the shoe choice is doing heavy lifting',
        'The beige cap breaks up the dark tones and adds a warm accent at the top of the frame',
      ],
      consider: [
        'The hiking pants are reading more generic than technical—a tapered or articulated-knee pant would sharpen the silhouette',
      ],
      quickFixes: [
        'Layer a lightweight shell or vest for the cool morning that can be tied around the waist later',
        'Swap the basic backpack for one with technical details (compression straps, water bottle pocket) to commit to the gorpcore story',
        'Add a Nalgene or Hydroflask in a coordinating color—it is genuinely an accessory in this aesthetic',
        'A pair of sunglasses on a cord or retainer adds the final outdoor-culture detail',
      ],
    },
  },

  // EXAMPLE 16: Dark Academia - Style-Aligned Feedback (suggestions stay in the academic lane)
  {
    id: 'dark-academia-campus',
    occasion: 'campus day',
    context: {
      occasion: 'classes and library',
      weather: 'cool autumn day',
      setting: 'university campus',
      vibe: 'intellectual, put-together',
    },
    outfit: {
      description: 'Brown tweed blazer, cream turtleneck, dark plaid trousers, brown oxford shoes, leather messenger bag',
      items: ['tweed blazer', 'turtleneck', 'plaid trousers', 'oxford shoes', 'leather messenger bag'],
    },
    exemplaryFeedback: {
      overallScore: 8.5,
      criteriaScores: {
        fit: 8,
        color: 9,
        occasion: 9,
        cohesion: 9,
        confidence: 8,
      },
      summary: 'This is dark academia committed and executed—the tweed-and-plaid layering reads like a mood board come to life.',
      whatsWorking: [
        'The brown-cream-plaid tonal palette is rich and autumnal—every piece lives in the same warm color family',
        'Tweed blazer over a turtleneck is the dark academia signature move, and the textures work in conversation',
        'The leather messenger bag completes the scholarly narrative—it is both functional and aesthetic',
      ],
      consider: [
        'The plaid trousers and tweed blazer are both patterned—the outfit is one pattern away from reading costume rather than curated',
      ],
      quickFixes: [
        'Add a simple gold or antique-finish ring for the one accessory detail that signals intentionality',
        'A vintage-style watch or leather-strap timepiece fits the aesthetic perfectly',
        'Carry a hardcover book—unironically, it completes the silhouette in this lane',
        'In warmer weather, swap the turtleneck for a cream button-down with the collar visible above the blazer',
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
  gym: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion.includes('gym') || ex.occasion.includes('workout')),
  outdoor: FEW_SHOT_EXAMPLES.filter(ex => ex.occasion.includes('hike') || ex.occasion.includes('outdoor')),
};

export const EXAMPLES_BY_SCORE_RANGE = {
  high: FEW_SHOT_EXAMPLES.filter(ex => ex.exemplaryFeedback.overallScore >= 8),
  medium: FEW_SHOT_EXAMPLES.filter(ex => ex.exemplaryFeedback.overallScore >= 6 && ex.exemplaryFeedback.overallScore < 8),
  low: FEW_SHOT_EXAMPLES.filter(ex => ex.exemplaryFeedback.overallScore < 6),
};

// Style-lane-aligned examples for reference
export const EXAMPLES_BY_STYLE_LANE = {
  streetwear: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('streetwear')),
  edgy: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('edgy') || ex.id.includes('concert')),
  bohemian: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('boho') || ex.id.includes('farmers')),
  classic: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('business') || ex.id.includes('interview')),
  casual: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('casual') || ex.id.includes('weekend')),
  athletic: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('athleisure') || ex.id.includes('gym')),
  grunge: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('grunge')),
  cleanGirl: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('clean-girl')),
  gorpcore: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('gorpcore') || ex.id.includes('hike')),
  darkAcademia: FEW_SHOT_EXAMPLES.filter(ex => ex.id.includes('dark-academia') || ex.id.includes('campus')),
};
