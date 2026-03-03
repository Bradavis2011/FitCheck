export const post = {
  slug: 'what-wispr-flow-taught-us-about-ugc',
  title: 'What 500M Views in 60 Days Taught Us About Fashion UGC',
  date: '2026-03-01',
  readingTime: '6 min read',
  description: 'Wispr Flow spent $6K/week on creators and hit 500M views. We had $0. Here\'s how we built a creator program that works anyway — and why fashion is the perfect domain for this.',
  sections: [
    {
      type: 'heading' as const,
      text: 'The Wispr Playbook',
    },
    {
      type: 'paragraph' as const,
      text: 'In early 2024, Wispr Flow — an AI voice dictation app — went from obscurity to the top of the App Store in 60 days. The mechanism was deceptively simple: they paid 70 creators between $1,000 and $6,000 per week to post scripted content to TikTok.',
    },
    {
      type: 'paragraph' as const,
      text: 'The key was the hook. Every creator posted some version of the same video: "I\'m terrible at names. I just said \'Shmirnoff\' out loud and Wispr transcribed it perfectly." The hook exploited a universal pain point (mispronouncing names), demonstrated the product organically, and created an irresistible curiosity loop.',
    },
    {
      type: 'paragraph' as const,
      text: '500 million views. 60 days. $6K/week × 70 creators × 8 weeks = ~$3.4M in creator spend. That\'s the paid version of this playbook.',
    },
    {
      type: 'heading' as const,
      text: 'The $0 Version',
    },
    {
      type: 'paragraph' as const,
      text: 'We can\'t spend $3.4M. We\'re a solo founder with a TestFlight build. But studying Wispr revealed something important: the money wasn\'t the reason it worked. The money was a scale mechanism. The underlying mechanics were free.',
    },
    {
      type: 'list' as const,
      items: [
        'The content format had standalone value. Creators would WANT to make "I let an AI score my outfit" videos — it\'s good content regardless of payment.',
        'Exclusivity created social currency. "I have access to an app nobody else has yet" is a flex. TestFlight-only access is a feature, not a bug.',
        '"Founding Creator" status costs nothing. Being featured at launch, early mover advantage, association with a growing brand — this is real value for a 5K-follower creator.',
        'The referral system tracks attribution. Each creator gets a unique link. When their audience signs up, they see the impact. That\'s the proof-of-value loop.',
      ],
    },
    {
      type: 'paragraph' as const,
      text: 'Notion\'s ambassador program got 600+ applications in week one offering exactly this model — no payment, just early access, community, and a role in building something people wanted to be part of.',
    },
    {
      type: 'heading' as const,
      text: 'Why Fashion Is the Perfect Domain',
    },
    {
      type: 'paragraph' as const,
      text: 'Wispr worked because voice dictation is demonstrable and relatable. Fashion AI is even better for this format. The "which outfit?" question is already TikTok\'s highest-engagement category.',
    },
    {
      type: 'paragraph' as const,
      text: '#fitcheck has billions of views. #ratemyoutfit, #thisorthat, #whichoutfit — these aren\'t just trends, they\'re user behaviors that exist independent of any app. We\'re not creating demand for the content format. We\'re giving creators a better version of what they already make.',
    },
    {
      type: 'paragraph' as const,
      text: 'The score reveal moment — animated loading dots → full-bleed 8.5/10 in editorial type → specific feedback — is a natural TikTok beat. The reaction to the score IS the content. No scripting required. Every genuine "wait, it gave me a 4?" is free, authentic, unscriptable marketing.',
    },
    {
      type: 'callout' as const,
      text: 'The question "which outfit?" is already the most-asked question on TikTok. We\'re just giving it a better answer.',
    },
    {
      type: 'heading' as const,
      text: 'The Hooks That Work',
    },
    {
      type: 'paragraph' as const,
      text: 'The Wispr insight that changed everything: with a hook library, 70 creators are manageable by one person. Without specific hooks, you\'re doing 1:1 creative direction. With hooks, you send one email and 20 creators all know what to film.',
    },
    {
      type: 'paragraph' as const,
      text: 'We\'ve built seven seed hooks based on the psychological mechanics that make fashion content go viral:',
    },
    {
      type: 'list' as const,
      items: [
        'The Score Reveal — genuine reaction to a surprising number',
        'The Mom Test — trusted person\'s judgment vs. the AI (vindication or betrayal)',
        'The Closet Roulette — randomness + judgment creates suspense',
        'The Group Chat Betrayal — "my friends are LIARS" is universally relatable',
        'The Date Night Decision — stakes + spiraling + resolution',
        'The Comeback — low score → feedback → glow up (transformation arc)',
        'The AI vs. Human — who\'s more honest? (debate content)',
      ],
    },
    {
      type: 'paragraph' as const,
      text: 'Each hook exploits a different emotion: surprise, vindication, humor, betrayal, stakes, triumph, curiosity. The app can deliver all of them authentically because the score is real, the feedback is specific, and the reaction can\'t be faked.',
    },
    {
      type: 'heading' as const,
      text: 'How OrThis? Makes Every User a Creator',
    },
    {
      type: 'paragraph' as const,
      text: 'The deeper insight from studying Wispr: their best-performing content wasn\'t from the paid creators. It was from organic users who discovered the same format on their own.',
    },
    {
      type: 'paragraph' as const,
      text: 'Or This? is designed for this. The 400×600 shareable score card stamps ORTHIS.APP on every share. The "which outfit?" format maps perfectly to existing user behavior. The score has enough specificity (8.5/10, not just "good") to be worth talking about.',
    },
    {
      type: 'paragraph' as const,
      text: 'We\'re not just building a creator program. We\'re building an app where the product feature and the content format are the same thing. Every user is a potential creator. Every outfit check is a potential video.',
    },
    {
      type: 'callout' as const,
      text: 'The best UGC strategy isn\'t paying creators to make content about your product. It\'s building a product that IS content.',
    },
    {
      type: 'heading' as const,
      text: 'What We\'re Building',
    },
    {
      type: 'paragraph' as const,
      text: 'If you build fashion content and you\'re reading this: we\'re running a Founding Creator program. TestFlight access today (iOS). Featured placement at launch. Your referral link tracked from day one.',
    },
    {
      type: 'paragraph' as const,
      text: 'No payment. No contract. No obligation to post. Just early access to something we think is genuinely useful, and a format that works for your existing audience.',
    },
  ],
};

export type Post = typeof post;
export type PostSection = Post['sections'][number];
