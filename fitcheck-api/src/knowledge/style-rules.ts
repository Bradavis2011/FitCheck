/**
 * Style Knowledge Base
 *
 * Comprehensive style rules, color theory, and fashion guidelines
 * to inform AI analysis and ensure accurate, helpful feedback.
 */

export const COLOR_THEORY = {
  // Complementary color pairs (opposite on color wheel)
  complementary: [
    { primary: 'red', complement: 'green', vibe: 'bold, energetic' },
    { primary: 'blue', complement: 'orange', vibe: 'vibrant, cheerful' },
    { primary: 'yellow', complement: 'purple', vibe: 'creative, striking' },
    { primary: 'teal', complement: 'coral', vibe: 'fresh, modern' },
  ],

  // Analogous colors (next to each other on color wheel)
  analogous: [
    { colors: ['blue', 'blue-green', 'green'], vibe: 'calm, harmonious' },
    { colors: ['red', 'red-orange', 'orange'], vibe: 'warm, energetic' },
    { colors: ['yellow', 'yellow-green', 'green'], vibe: 'fresh, natural' },
    { colors: ['purple', 'red-purple', 'red'], vibe: 'rich, luxurious' },
  ],

  // Neutral colors (go with everything)
  neutrals: {
    classic: ['black', 'white', 'gray', 'navy', 'beige', 'cream', 'taupe'],
    warm: ['camel', 'tan', 'brown', 'ivory', 'cream'],
    cool: ['charcoal', 'slate', 'pewter', 'dove gray'],
  },

  // Seasonal color palettes
  seasons: {
    spring: {
      undertone: 'warm',
      characteristics: 'light, clear, warm colors',
      bestColors: ['coral', 'peach', 'turquoise', 'warm pink', 'golden yellow', 'light green'],
      avoid: ['black', 'stark white', 'cool grays'],
    },
    summer: {
      undertone: 'cool',
      characteristics: 'soft, muted, cool colors',
      bestColors: ['lavender', 'soft pink', 'powder blue', 'rose', 'periwinkle', 'soft white'],
      avoid: ['orange', 'warm browns', 'bright warm colors'],
    },
    autumn: {
      undertone: 'warm',
      characteristics: 'rich, warm, earthy colors',
      bestColors: ['rust', 'olive', 'burgundy', 'mustard', 'terracotta', 'forest green'],
      avoid: ['bright pink', 'cool blues', 'icy colors'],
    },
    winter: {
      undertone: 'cool',
      characteristics: 'clear, bright, cool colors',
      bestColors: ['emerald', 'royal blue', 'true red', 'black', 'pure white', 'fuchsia'],
      avoid: ['orange', 'peach', 'warm beiges'],
    },
  },

  // Safe color combinations
  safeFormulas: [
    'Neutral + Neutral (e.g., black & white, navy & cream)',
    'Neutral + Accent Color (e.g., gray suit + burgundy blouse)',
    'Monochromatic (different shades of same color)',
    'Analogous colors (e.g., blue shirt, teal pants, green accessories)',
    'Neutral + Complementary Accent (e.g., navy suit + orange tie)',
  ],
};

export const FIT_GUIDELINES = {
  shoulders: {
    perfect: 'Shoulder seam aligns with natural shoulder line (where shoulder meets arm)',
    tooTight: 'Fabric pulling across shoulders, restricted movement',
    tooBig: 'Seam extends past natural shoulder, excess fabric',
    tip: 'This is the most important fit point - tailoring cannot fix shoulders easily',
  },

  sleeves: {
    perfect: 'Long sleeves end at wrist bone when arms at sides; short sleeves hit mid-bicep',
    tooLong: 'Fabric bunching at wrists, covering hands',
    tooShort: 'Wrists exposed when arms at sides',
    blazerTip: 'Shirt cuffs should show 0.25-0.5 inches below blazer sleeves',
  },

  chest: {
    perfect: 'Comfortable to move, no pulling when buttoned, no excess fabric',
    tooTight: 'X-shaped pulling across buttons, fabric straining',
    tooBig: 'Billowing fabric, gaping when moving',
    buttonTip: 'Should be able to fit a flat hand inside buttoned jacket',
  },

  waist: {
    perfect: 'Skims body without clinging, allows comfortable sitting',
    tooTight: 'Visible bulges, uncomfortable sitting, fabric pulling',
    tooBig: 'Bunching fabric, needs belt to stay up',
    tip: 'Tailoring the waist is easy and makes a huge difference',
  },

  pants: {
    waist: 'Should sit comfortably without belt for support; belt is decorative',
    length: {
      noBreak: 'Hem hits top of shoe—modern, sleek look',
      slightBreak: 'One small fold at ankle—classic look',
      fullBreak: 'Fabric pools slightly—traditional, less modern',
    },
    rise: {
      low: 'Sits on hips—casual, modern',
      mid: 'At natural waist—versatile, flattering',
      high: 'Above waist—vintage, elongating',
    },
    tip: 'Hem should never drag on the ground or bunch excessively',
  },

  dresses: {
    bodice: 'Should fit smoothly without gaping or pulling',
    waist: 'Waistline should hit at natural waist (most flattering)',
    skirt: 'Should skim hips without clinging or excess fabric',
    length: {
      mini: 'Above mid-thigh—casual, youthful',
      knee: 'At or just above/below knee—universal, professional',
      midi: 'Mid-calf—modern, elegant',
      maxi: 'Ankle or floor-length—formal, bohemian',
    },
  },
};

export const BODY_TYPE_GUIDELINES = {
  // Note: Focus on garment characteristics, not body "fixes"
  hourglass: {
    emphasize: ['defined waist', 'fitted styles', 'wrap dresses', 'belted looks'],
    works: ['bodycon dresses', 'high-waisted pants', 'peplum tops', 'V-necks'],
    avoid: ['shapeless/boxy cuts', 'drop-waist styles'],
  },

  pear: {
    emphasize: ['shoulders and neckline', 'upper body details', 'structured tops'],
    works: ['A-line skirts', 'wide-leg pants', 'boat necks', 'statement sleeves'],
    avoid: ['tapered/skinny pants alone', 'hip pockets', 'horizontal stripes on bottom'],
  },

  apple: {
    emphasize: ['legs', 'neckline', 'vertical lines'],
    works: ['empire waist', 'V-necks', 'straight-leg pants', 'open jackets'],
    avoid: ['clingy fabrics at midsection', 'wide belts', 'boxy tops'],
  },

  rectangle: {
    emphasize: ['creating curves', 'defining waist', 'adding dimension'],
    works: ['peplum tops', 'ruffles', 'belted dresses', 'layering'],
    avoid: ['straight shift dresses', 'shapeless cuts'],
  },

  invertedTriangle: {
    emphasize: ['lower body', 'legs', 'softening shoulders'],
    works: ['bootcut pants', 'A-line skirts', 'V-necks', 'flared dresses'],
    avoid: ['shoulder pads', 'boat necks', 'cap sleeves'],
  },
};

export const OCCASION_GUIDELINES = {
  interview: {
    corporate: {
      appropriate: ['suit (matching jacket & pants/skirt)', 'conservative colors', 'closed-toe shoes'],
      colors: ['navy', 'charcoal', 'black', 'gray', 'white', 'light blue'],
      avoid: ['jeans', 'sneakers', 'loud patterns', 'excessive jewelry', 'revealing cuts'],
      tip: 'When in doubt, be more formal—better overdressed than under',
    },
    creative: {
      appropriate: ['smart casual', 'blazer + nice jeans', 'personality-showing pieces'],
      colors: ['more flexibility', 'can add pops of color'],
      avoid: ['too casual (athletic wear)', 'sloppy', 'overly revealing'],
      tip: 'Show your style but keep it polished—you want to fit the culture',
    },
    startup: {
      appropriate: ['business casual', 'clean jeans', 'button-down or blouse'],
      avoid: ['too formal (you will look out of touch)', 'too casual (still an interview)'],
      tip: 'Research the company culture—check their website/social media',
    },
  },

  dateNight: {
    dinner: {
      works: ['cocktail dress', 'dressy separates', 'heels or dressy flats'],
      vibe: 'polished but not trying too hard',
      avoid: ['too casual', 'overly revealing', 'uncomfortable (you want to enjoy yourself)'],
      tip: 'Wear something that makes YOU feel confident and attractive',
    },
    casual: {
      works: ['nice jeans + elevated top', 'casual dress', 'comfortable shoes you can walk in'],
      vibe: 'effortless, approachable',
      avoid: ['gym clothes', 'sloppy', 'too dressy (creates weird imbalance)'],
    },
  },

  wedding: {
    guest: {
      appropriate: ['cocktail dress', 'formal jumpsuit', 'suit', 'dressy separates'],
      colors: {
        avoid: ['white', 'cream', 'ivory', 'champagne (too close to white)'],
        safe: ['jewel tones', 'pastels', 'prints', 'metallics'],
      },
      formality: {
        blackTie: 'Floor-length gown or very formal cocktail dress',
        formalAttire: 'Cocktail dress or formal suit',
        cocktailAttire: 'Knee-length dress or dressy separates',
        semiFormal: 'Cocktail dress or nice suit',
        casual: 'Sundress or dressy separates (still polished)',
      },
      tip: 'Check the invitation for dress code and venue (beach vs. ballroom)',
    },
  },

  work: {
    corporate: {
      appropriate: ['suit', 'dress pants + blouse', 'pencil skirt + blazer', 'sheath dress'],
      colors: ['conservative—navy, black, gray, white, muted colors'],
      avoid: ['casual fabrics', 'revealing cuts', 'loud patterns'],
    },
    businessCasual: {
      appropriate: ['khakis', 'dress pants', 'blouse', 'cardigan', 'loafers'],
      avoid: ['jeans (unless explicitly allowed)', 'sneakers', 't-shirts'],
      tip: 'When starting a new job, observe what others wear first',
    },
    creative: {
      appropriate: ['jeans', 'casual shirts', 'sneakers', 'personal style'],
      avoid: ['looking sloppy', 'offensive graphics', 'gym clothes'],
      tip: 'You have freedom, but stay professional',
    },
  },

  casual: {
    weekend: {
      works: ['jeans', 't-shirts', 'sneakers', 'comfortable clothes'],
      tip: 'Casual does not mean sloppy - fit still matters',
    },
    brunch: {
      works: ['casual dress', 'nice jeans + blouse', 'jumpsuit'],
      vibe: 'polished casual',
    },
  },
};

export const STYLE_AESTHETICS: Record<string, {
  characteristics: string[];
  pieces: string[];
  colors: string[];
  icons?: string[];
  upgradePaths: string[];
}> = {
  // ─── CASUAL & STREET ──────────────────────────────────────────
  streetwear: {
    characteristics: ['urban', 'comfortable', 'sneakers', 'logos', 'oversized'],
    pieces: ['hoodies', 'sneakers', 'joggers', 'oversized fits', 'caps', 'crossbody bags'],
    colors: ['varied', 'bold colors', 'black', 'graphic prints'],
    upgradePaths: ['upgrade sneakers', 'better hoodie/brand', 'bomber or varsity jacket layering', 'tonal color blocking', 'crossbody bag or cap'],
  },

  'hip-hop': {
    characteristics: ['bold', 'logo-driven', 'jewelry-heavy', 'oversized', 'statement'],
    pieces: ['designer outerwear', 'chains', 'bucket hats', 'high-end sneakers', 'oversized tees'],
    colors: ['black', 'white', 'bold primaries', 'metallics'],
    upgradePaths: ['bolder jewelry (chains, rings)', 'designer or logo outerwear', 'coordinated colorways', 'high-end sneakers', 'bucket hats'],
  },

  skater: {
    characteristics: ['relaxed', 'functional', 'graphic tees', 'worn-in', 'casual'],
    pieces: ['graphic tees', 'Dickies pants', 'Vans/Nike SB', 'flannels', 'beanies', 'trucker caps'],
    colors: ['earth tones', 'black', 'navy', 'muted tones'],
    upgradePaths: ['Dickies or chinos over joggers', 'clean graphic tee', 'Vans or Nike SB upgrade', 'layered flannels', 'wrist accessories'],
  },

  normcore: {
    characteristics: ['anti-fashion', 'plain basics', 'unbranded', 'comfortable', 'intentionally generic'],
    pieces: ['plain tees', 'straight-leg jeans', 'white sneakers', 'simple outerwear', 'dad caps'],
    colors: ['gray', 'white', 'navy', 'beige', 'muted tones'],
    upgradePaths: ['better-fitting basics', 'premium plain tees', 'clean white sneakers', 'tonal layering', 'invisible quality (fabric weight)'],
  },

  y2k: {
    characteristics: ['nostalgic 2000s', 'low-rise', 'playful', 'butterfly motifs', 'shiny fabrics'],
    pieces: ['baby tees', 'low-rise jeans', 'platform shoes', 'tinted sunglasses', 'mini bags', 'rhinestone accessories'],
    colors: ['pastel pink', 'baby blue', 'silver', 'neon accents'],
    upgradePaths: ['low-rise fits', 'butterfly/rhinestone accessories', 'baby tees', 'tinted sunglasses', 'mini bags', 'platform shoes'],
  },

  loungewear: {
    characteristics: ['comfortable', 'at-home', 'soft fabrics', 'relaxed fit', 'matching sets'],
    pieces: ['matching sweat sets', 'joggers', 'oversized tees', 'slides', 'slippers'],
    colors: ['neutrals', 'pastels', 'heather gray', 'cream', 'soft tones'],
    upgradePaths: ['matching sets over mismatched', 'upgrade to cashmere or modal', 'clean slides or mules', 'minimal jewelry', 'structured bag'],
  },

  // ─── ATHLETIC & OUTDOOR ───────────────────────────────────────
  sporty: {
    characteristics: ['athletic', 'performance-inspired', 'clean lines', 'functional'],
    pieces: ['athletic sneakers', 'track pants', 'performance tops', 'sports watches', 'running shoes'],
    colors: ['black', 'white', 'neon accents', 'gray'],
    upgradePaths: ['technical fabrics', 'monochrome or color-blocked sets', 'clean sneakers', 'fitted proportions', 'performance accessories'],
  },

  athleisure: {
    characteristics: ['gym-to-street', 'fitted', 'technical fabrics', 'polished athletic'],
    pieces: ['leggings', 'sports bras', 'bomber jackets', 'clean sneakers', 'crossbody bags', 'matching sets'],
    colors: ['black', 'neutrals', 'earth tones', 'muted pastels'],
    upgradePaths: ['matching brand sets', 'technical fabric upgrade', 'monochrome coordination', 'structured outerwear layer', 'clean minimalist sneakers'],
  },

  gorpcore: {
    characteristics: ['outdoor-inspired', 'technical', 'earth tones', 'functional', 'hiking-chic'],
    pieces: ['hiking boots', 'technical shells', 'fleece layers', 'utility vests', 'trail runners', 'Nalgene accessories'],
    colors: ['olive', 'tan', 'forest green', 'burnt orange', 'stone'],
    upgradePaths: ['quality hiking boots or trail runners', 'earth-tone layering', 'technical shells (Gore-Tex)', 'utility vests', 'fleece layering'],
  },

  'military-inspired': {
    characteristics: ['structured', 'utility', 'tactical', 'olive/khaki palette'],
    pieces: ['field jackets', 'cargo pants', 'combat boots', 'dog tags', 'utility belts'],
    colors: ['olive', 'khaki', 'camo', 'black', 'tan'],
    upgradePaths: ['quality field jacket', 'combat or tactical boots', 'minimal metal jewelry', 'structured silhouette', 'muted earth palette'],
  },

  // ─── POLISHED & PROFESSIONAL ──────────────────────────────────
  classic: {
    characteristics: ['timeless', 'clean lines', 'quality over trends', 'neutral colors'],
    pieces: ['white button-down', 'trench coat', 'loafers', 'structured bag', 'simple jewelry'],
    colors: ['navy', 'black', 'white', 'camel', 'gray'],
    icons: ['Audrey Hepburn', 'Grace Kelly'],
    upgradePaths: ['better knitwear', 'structured bags', 'polished leather goods', 'layering with blazers and cardigans'],
  },

  preppy: {
    characteristics: ['polished', 'collegiate', 'classic patterns', 'nautical'],
    pieces: ['polo shirts', 'cable knits', 'blazers', 'loafers', 'pearls'],
    colors: ['navy', 'white', 'red', 'pink', 'green'],
    upgradePaths: ['better knitwear', 'quality loafers', 'pattern mixing within family', 'structured accessories'],
  },

  'business-professional': {
    characteristics: ['corporate', 'tailored', 'conservative', 'authoritative'],
    pieces: ['suits', 'dress shirts', 'leather shoes', 'structured bags', 'ties', 'cufflinks'],
    colors: ['navy', 'charcoal', 'black', 'white', 'light blue'],
    upgradePaths: ['sharper tailoring', 'quality leather shoes/belt', 'crisp shirt fabrics', 'monochrome suiting', 'subtle cufflinks or watch'],
  },

  'old-money': {
    characteristics: ['understated wealth', 'heritage brands', 'no logos', 'quality fabrics'],
    pieces: ['cashmere sweaters', 'loafers', 'pearl jewelry', 'tennis whites', 'blazers', 'driving shoes'],
    colors: ['navy', 'cream', 'forest green', 'burgundy', 'camel'],
    upgradePaths: ['quiet logos or none', 'cashmere and wool', 'loafers and driving shoes', 'pearl or gold jewelry', 'muted earth tones and navy'],
  },

  'quiet-luxury': {
    characteristics: ['no visible branding', 'premium fabrics', 'perfect fit', 'understated'],
    pieces: ['cashmere knits', 'tailored trousers', 'quality leather goods', 'simple gold jewelry'],
    colors: ['camel', 'cream', 'gray', 'black', 'stone', 'ecru'],
    upgradePaths: ['invest in fabric over brand', 'understated palette', 'perfect tailoring', 'no visible logos', 'one quality leather good'],
  },

  scandinavian: {
    characteristics: ['clean lines', 'functional', 'muted palette', 'architectural'],
    pieces: ['structured coats', 'quality basics', 'minimal sneakers', 'clean-line bags'],
    colors: ['white', 'gray', 'black', 'camel', 'muted blue'],
    upgradePaths: ['clean lines', 'functional fabrics', 'muted palette with white', 'quality basics', 'architectural silhouettes'],
  },

  // ─── ALTERNATIVE & SUBCULTURE ─────────────────────────────────
  edgy: {
    characteristics: ['bold', 'leather', 'black', 'unconventional', 'attitude'],
    pieces: ['moto jacket', 'combat boots', 'dark denim', 'statement pieces'],
    colors: ['black', 'charcoal', 'burgundy', 'dark green'],
    upgradePaths: ['higher-quality leather', 'hardware jewelry', 'sharper boot silhouette', 'moto or biker-inspired layering'],
  },

  grunge: {
    characteristics: ['90s-inspired', 'layered', 'worn-in', 'anti-establishment'],
    pieces: ['flannel shirts', 'band tees', 'ripped jeans', 'combat boots', 'beanies'],
    colors: ['black', 'red plaid', 'dark wash', 'muted earth tones'],
    upgradePaths: ['quality flannels', 'vintage band tees', 'worn-in denim', 'Doc Martens', 'layered necklaces', 'messy-but-intentional aesthetic'],
  },

  goth: {
    characteristics: ['dark', 'dramatic', 'Victorian references', 'black-dominant'],
    pieces: ['velvet pieces', 'platform boots', 'corset details', 'mesh layers', 'silver jewelry'],
    colors: ['black', 'deep purple', 'burgundy', 'blood red'],
    upgradePaths: ['richer black fabrics (velvet, mesh, lace)', 'silver or oxidized jewelry', 'platform boots', 'corset details', 'Victorian references'],
  },

  punk: {
    characteristics: ['DIY', 'anti-fashion', 'studded', 'rebellious', 'loud'],
    pieces: ['studded leather jacket', 'band tees', 'tartan', 'chunky boots', 'safety pins', 'patches'],
    colors: ['black', 'red', 'tartan patterns', 'neon accents'],
    upgradePaths: ['studded leather', 'DIY patches and pins', 'tartan accents', 'chunky boots', 'safety-pin jewelry', 'torn denim as detail'],
  },

  techwear: {
    characteristics: ['futuristic', 'functional', 'monochrome', 'utility', 'waterproof'],
    pieces: ['technical shells', 'utility harnesses', 'tapered cargos', 'futuristic sneakers', 'sling bags'],
    colors: ['black', 'charcoal', 'dark gray', 'neon accents'],
    upgradePaths: ['technical shells and waterproof fabrics', 'utility harnesses', 'tapered cargo joggers', 'monochrome black', 'functional bag systems'],
  },

  'workwear-utilitarian': {
    characteristics: ['durable', 'functional', 'raw materials', 'heritage', 'worn-in'],
    pieces: ['chore coats', 'duck canvas pants', 'work boots', 'utility belts', 'denim jackets'],
    colors: ['tan', 'indigo', 'olive', 'brown', 'raw denim'],
    upgradePaths: ['Carhartt/Dickies quality', 'durable fabrics (duck canvas, heavy twill)', 'functional boots', 'earth-tone palette', 'clean but worn-in'],
  },

  // ─── FEMININE & TRENDING ──────────────────────────────────────
  romantic: {
    characteristics: ['soft', 'feminine', 'flowing fabrics', 'details'],
    pieces: ['floral dresses', 'ruffles', 'lace', 'soft cardigans', 'delicate jewelry'],
    colors: ['blush', 'soft pink', 'cream', 'lavender', 'pastels'],
    upgradePaths: ['softer fabrics', 'delicate jewelry', 'floral and lace details', 'blush and pastel palette', 'feminine silhouettes'],
  },

  coquette: {
    characteristics: ['ribbons', 'bows', 'ballet-inspired', 'dainty', 'hyper-feminine'],
    pieces: ['ballet flats', 'ribbon accessories', 'lace trims', 'Mary Janes', 'delicate jewelry', 'sheer fabrics'],
    colors: ['soft pink', 'white', 'cream', 'baby blue', 'lavender'],
    upgradePaths: ['ribbon and bow details', 'ballet flats', 'soft pink palette', 'lace trims', 'delicate jewelry', 'Mary Janes'],
  },

  'soft-girl': {
    characteristics: ['pastel', 'cute', 'fuzzy textures', 'cloud-like', 'youthful'],
    pieces: ['pastel cardigans', 'platform sneakers', 'fuzzy bags', 'gold minimal jewelry', 'hair clips'],
    colors: ['pastel pink', 'lilac', 'baby blue', 'peach', 'cream'],
    upgradePaths: ['pastel color blocking', 'gold minimal jewelry', 'fuzzy textures', 'platform sneakers', 'cloud-like silhouettes'],
  },

  'clean-girl': {
    characteristics: ['effortless', 'polished basics', 'minimal makeup energy', 'gold accents'],
    pieces: ['gold hoops', 'slicked bun', 'quality basics', 'fresh white sneakers', 'structured mini bag'],
    colors: ['neutrals', 'white', 'beige', 'camel', 'black'],
    upgradePaths: ['slicked hair energy', 'gold hoops', 'neutral palette', 'quality basics', 'fresh white sneakers', 'structured mini bag'],
  },

  'mob-wife': {
    characteristics: ['power dressing', 'fur', 'leopard print', 'gold', 'dramatic'],
    pieces: ['faux-fur coats', 'leopard print', 'chunky gold jewelry', 'oversized sunglasses', 'leather gloves', 'red lipstick'],
    colors: ['black', 'leopard', 'gold', 'red', 'cream'],
    upgradePaths: ['fur or faux-fur coats', 'leopard print accent', 'gold chunky jewelry', 'all-black base', 'red lip', 'oversized sunglasses'],
  },

  cottagecore: {
    characteristics: ['pastoral', 'romantic rural', 'handmade feel', 'natural fabrics'],
    pieces: ['prairie dresses', 'puff sleeves', 'floral prints', 'straw hats', 'woven baskets', 'linen fabrics'],
    colors: ['cream', 'sage green', 'dusty rose', 'butter yellow', 'earth tones'],
    upgradePaths: ['prairie dresses', 'puff sleeves', 'floral prints', 'straw hats', 'woven baskets', 'linen fabrics', 'Peter Pan collars'],
  },

  festival: {
    characteristics: ['expressive', 'body-positive', 'layered accessories', 'bold', 'carefree'],
    pieces: ['fringe', 'crochet tops', 'body chains', 'cowboy boots', 'platform sandals', 'statement sunglasses'],
    colors: ['metallics', 'neon', 'earth tones', 'tie-dye', 'bold prints'],
    upgradePaths: ['fringe details', 'crochet', 'body chains', 'cowboy boots or platforms', 'layered jewelry', 'statement sunglasses'],
  },

  glamorous: {
    characteristics: ['show-stopping', 'luxurious', 'red carpet energy', 'sparkle'],
    pieces: ['sequin pieces', 'statement heels', 'bold lip color', 'structured clutch', 'statement jewelry'],
    colors: ['gold', 'silver', 'black', 'red', 'jewel tones'],
    upgradePaths: ['sequins or metallic fabrics', 'statement heels', 'bold lip color', 'structured clutch', 'one show-stopping piece'],
  },

  // ─── AESTHETIC & ACADEMIC ─────────────────────────────────────
  'dark-academia': {
    characteristics: ['intellectual', 'autumnal', 'layered', 'tweed and corduroy', 'bookish'],
    pieces: ['tweed blazers', 'turtlenecks', 'plaid trousers', 'oxford shoes', 'leather satchels'],
    colors: ['brown', 'burgundy', 'forest green', 'cream', 'charcoal'],
    upgradePaths: ['tweed blazers', 'turtlenecks', 'plaid trousers', 'oxford shoes', 'leather satchels', 'vintage-inspired layers'],
  },

  'light-academia': {
    characteristics: ['bright intellectual', 'soft', 'linen and cotton', 'poetry-reading energy'],
    pieces: ['cream knits', 'linen trousers', 'loafers', 'structured bags', 'Peter Pan collars'],
    colors: ['cream', 'beige', 'white', 'soft brown', 'gold'],
    upgradePaths: ['cream and beige palette', 'linen and cotton', 'loafers', 'structured bags', 'soft knits', 'gold wire-rim glasses aesthetic'],
  },

  // ─── LIFESTYLE & REGIONAL ─────────────────────────────────────
  bohemian: {
    characteristics: ['free-spirited', 'layered', 'mixed patterns', 'earthy'],
    pieces: ['maxi dresses', 'wide-brim hats', 'layered jewelry', 'fringe', 'suede'],
    colors: ['earth tones', 'rust', 'olive', 'mustard', 'turquoise'],
    upgradePaths: ['richer textures (suede, crochet, raw silk)', 'layered jewelry', 'vintage-inspired accessories', 'flowy silhouettes'],
  },

  coastal: {
    characteristics: ['beach-inspired', 'breezy', 'natural fabrics', 'relaxed'],
    pieces: ['linen shirts', 'espadrilles', 'woven bags', 'shell jewelry', 'sandals'],
    colors: ['white', 'sand', 'light blue', 'coral', 'natural tones'],
    upgradePaths: ['linen upgrades', 'woven accessories', 'nude and white palette', 'espadrilles or leather sandals', 'shell or pearl jewelry'],
  },

  western: {
    characteristics: ['cowboy-inspired', 'leather', 'fringe', 'turquoise', 'rugged'],
    pieces: ['cowboy boots', 'turquoise jewelry', 'denim', 'bolo ties', 'fringe jackets', 'leather belts'],
    colors: ['brown', 'tan', 'turquoise', 'denim blue', 'rust'],
    upgradePaths: ['quality cowboy boots', 'turquoise or silver jewelry', 'denim-on-denim done right', 'bolo ties', 'fringe details'],
  },

  'korean-fashion': {
    characteristics: ['oversized-fitted contrast', 'layered', 'tonal', 'clean', 'balanced'],
    pieces: ['oversized blazers', 'wide-leg pants', 'clean sneakers', 'structured bags', 'minimal jewelry'],
    colors: ['black', 'white', 'beige', 'muted tones', 'one pop color'],
    upgradePaths: ['oversized-fitted contrast', 'layering mastery', 'neutral palette with one pop', 'clean sneakers or loafers', 'tonal coordination'],
  },

  // ─── CONCEPTUAL ───────────────────────────────────────────────
  minimalist: {
    characteristics: ['less is more', 'monochromatic', 'clean', 'quality basics'],
    pieces: ['simple silhouettes', 'neutral basics', 'minimal jewelry', 'sleek bags'],
    colors: ['black', 'white', 'gray', 'beige', 'navy'],
    upgradePaths: ['upgrade fabric quality', 'refine proportions', 'better tailoring', 'architectural jewelry'],
  },

  maximalist: {
    characteristics: ['more is more', 'pattern mixing', 'bold colors', 'personality-driven'],
    pieces: ['statement prints', 'layered jewelry', 'bold accessories', 'mixed patterns'],
    colors: ['jewel tones', 'bold primaries', 'mixed palettes', 'anything goes'],
    upgradePaths: ['bolder pattern mixing', 'more jewelry layering', 'confident color clashing', 'statement accessories'],
  },

  vintage: {
    characteristics: ['era-specific', 'retro', 'second-hand', 'nostalgic', 'curated'],
    pieces: ['era-specific accessories', 'retro silhouettes', 'vintage jewelry', 'second-hand finds'],
    colors: ['era-dependent', 'muted versions of originals'],
    upgradePaths: ['era-specific accessories', 'quality second-hand pieces', 'retro silhouettes', 'period-accurate color palettes'],
  },

  'avant-garde': {
    characteristics: ['experimental', 'sculptural', 'asymmetric', 'conceptual', 'artistic'],
    pieces: ['deconstructed garments', 'sculptural accessories', 'asymmetric cuts', 'oversized shapes'],
    colors: ['black', 'white', 'monochrome', 'unexpected accents'],
    upgradePaths: ['sculptural shapes', 'asymmetry', 'experimental proportions', 'statement pieces', 'unexpected fabric combinations'],
  },
};

export const PATTERN_MIXING_RULES = {
  safe: [
    'Same color family (e.g., navy stripes + navy polka dots)',
    'Different scales (large floral + small stripes)',
    'Pattern + solid that pulls color from pattern',
  ],
  advanced: [
    'Complementary patterns in same color (gingham + plaid)',
    'Different patterns, same vibe (bohemian florals + paisleys)',
  ],
  avoid: [
    'Competing bold patterns (large floral + large geometric)',
    'Too many patterns at once (max 2-3)',
  ],
};

export const ACCESSORY_GUIDELINES = {
  jewelry: {
    metalMatching: 'Does not have to match perfectly, but do not mix drastically different tones',
    statementRule: 'One statement piece - if earrings are bold, keep necklace simple',
    necklines: {
      vNeck: 'V-shaped or Y-necklace follows the line',
      crewneck: 'Longer necklace or collar-style',
      boatneck: 'Skip necklace, focus on earrings',
      offShoulder: 'Chandelier earrings, skip necklace',
    },
  },

  bags: {
    proportion: 'Bag size should balance your frame—petite = smaller bags',
    formality: 'Structured = formal, slouchy = casual',
    colorRule: 'Does not have to match shoes, but should work with outfit',
  },

  shoes: {
    heightRule: 'Heel height depends on occasion and comfort',
    styleMatch: 'Match formality level (do not wear sneakers with cocktail dress)',
    colorTips: [
      'Nude elongates legs',
      'Black is classic and slimming',
      'Match to bag for cohesion',
      'Metallic works with everything',
    ],
  },

  belts: {
    whenToWear: ['Define waist', 'Add interest to simple outfit', 'Keep pants up'],
    width: 'Wider belts are statement pieces; thin belts are subtle',
    placement: 'At natural waist (most flattering)',
  },
};

export const QUICK_FIX_DATABASE = {
  tooLongPants: 'Cuff them for a casual look, or get them hemmed',
  tooShortPants: 'Wear with ankle boots to make it look intentional',
  gapingBlouse: 'Use fashion tape between buttons or add a camisole',
  tooCasual: 'Add blazer and swap sneakers for loafers',
  tooFormal: 'Remove blazer, swap heels for flats, add casual jacket',
  boringOutfit: 'Add statement jewelry, colorful scarf, or bold lip',
  noDefinition: 'Add a belt to create waist definition',
  tooMatchy: 'Break up matching set with different colored shoes or jacket',
  proportionIssues: 'Balance loose with fitted (loose top + fitted bottom or vice versa)',
};
