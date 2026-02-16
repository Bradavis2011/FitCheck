# Monetization Product Requirements Document
## FitCheck: Revenue Strategy & Implementation Plan

**Version:** 1.0  
**Date:** February 13, 2026  
**Author:** Brandon [Last Name]  
**Status:** Strategic Planning

---

## Executive Summary

This document outlines FitCheck's monetization strategy across six revenue streams, with phased implementation over 24 months. The strategy prioritizes user trust and product-market fit before aggressive monetization, with projected revenue reaching $500K-2M MRR by month 24.

### Revenue Streams Overview

| Stream | Launch Phase | Projected % of Revenue (Month 24) |
|--------|--------------|-----------------------------------|
| Consumer Subscriptions | Phase 1 (Month 1) | 35% |
| Expert Marketplace | Phase 2 (Month 8) | 25% |
| Affiliate Commerce | Phase 1 (Month 3) | 15% |
| Sponsored Recommendations | Phase 2 (Month 9) | 15% |
| Data & Insights | Phase 3 (Month 18) | 5% |
| Enterprise/B2B | Phase 3 (Month 20) | 5% |

### Key Principles

1. **Trust Before Transactions** - Users must believe advice is genuine before any commerce
2. **Value Before Revenue** - Each monetization feature must enhance, not degrade, user experience
3. **Transparent Commerce** - All sponsored/paid content clearly labeled
4. **Creator Economics** - Experts must earn meaningful income to build supply side
5. **Gradual Introduction** - Phase monetization to avoid overwhelming users

---

## Part 1: Consumer Subscriptions

### 1.1 Tier Structure

#### Free Tier
**Price:** $0  
**Purpose:** Acquisition, viral growth, funnel to paid

| Feature | Limit |
|---------|-------|
| AI outfit checks | 3 per day |
| AI feedback quality | Full |
| Follow-up questions | 1 per check |
| Outfit history | Last 7 days |
| Community feedback (Phase 2) | View only |
| Ads | Yes (non-intrusive) |

#### Plus Tier
**Price:** $5.99/month or $49.99/year (30% discount)  
**Purpose:** Core paid tier, majority of subscription revenue

| Feature | Limit |
|---------|-------|
| AI outfit checks | Unlimited |
| Follow-up questions | 5 per check |
| Outfit history | Unlimited |
| Community feedback | Give & receive |
| Expert reviews | Purchase à la carte |
| Ads | None |
| Style analytics | Basic (monthly summary) |
| Priority AI processing | Yes (faster response) |

#### Pro Tier
**Price:** $14.99/month or $119.99/year (33% discount)  
**Purpose:** Power users, fashion-forward segment

| Feature | Limit |
|---------|-------|
| Everything in Plus | ✓ |
| Expert reviews included | 5 per month |
| Priority expert queue | Yes |
| Style analytics | Advanced (weekly insights, trends) |
| Wardrobe integration | Connect closet apps |
| Event planning mode | Multi-outfit comparison |
| Early access features | Yes |
| Community badges | "Pro Member" flair |

#### VIP Tier (Phase 3)
**Price:** $49.99/month or $399.99/year (33% discount)  
**Purpose:** High-value users, personal styling replacement

| Feature | Limit |
|---------|-------|
| Everything in Pro | ✓ |
| Expert reviews included | Unlimited |
| Dedicated stylist matching | Assigned stylist who learns your style |
| Quarterly wardrobe audit | Included |
| Shopping concierge | Experts help you shop |
| Video consultations | 2 included per month |
| White-glove support | Direct line |

### 1.2 Subscription Feature Requirements

#### Paywall & Upgrade Prompts

**Trigger Points:**
1. Daily limit reached (Free → Plus)
2. Requesting community feedback (Free → Plus)
3. Viewing outfit older than 7 days (Free → Plus)
4. Requesting expert review (Plus → Pro or à la carte)
5. Using event planning mode (Plus → Pro)
6. Requesting dedicated stylist (Pro → VIP)

**Upgrade Modal UI:**

```
┌─────────────────────────────────────────┐
│                                         │
│  ✨ Unlock Unlimited Outfit Checks      │
│                                         │
│  You've used your 3 free checks today.  │
│  Upgrade to keep the feedback flowing.  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  PLUS                           │    │
│  │  $5.99/month                    │    │
│  │                                 │    │
│  │  ✓ Unlimited AI checks          │    │
│  │  ✓ Community feedback           │    │
│  │  ✓ Full outfit history          │    │
│  │  ✓ No ads                       │    │
│  │                                 │    │
│  │  [Start 7-Day Free Trial]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  PRO - Best Value               │    │
│  │  $14.99/month                   │    │
│  │                                 │    │
│  │  Everything in Plus, plus:      │    │
│  │  ✓ 5 expert reviews/month       │    │
│  │  ✓ Priority queue               │    │
│  │  ✓ Advanced style analytics     │    │
│  │                                 │    │
│  │  [Start 7-Day Free Trial]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Maybe later                            │
│                                         │
└─────────────────────────────────────────┘
```

**Acceptance Criteria:**
- Trial requires payment method but charges after 7 days
- Cancel anytime before trial ends
- Show "X days left in trial" reminder at day 5
- Downgrade keeps history but limits future access
- Proration for mid-cycle upgrades

#### Usage Tracking System

**Database Schema Addition:**
```sql
CREATE TABLE subscription_usage (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Limits
    ai_checks_used INT DEFAULT 0,
    ai_checks_limit INT NOT NULL,
    expert_reviews_used INT DEFAULT 0,
    expert_reviews_limit INT,
    
    -- Engagement
    community_feedback_given INT DEFAULT 0,
    community_feedback_received INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Reset Logic:**
- Free tier: Resets daily at midnight user's timezone
- Paid tiers: Resets on billing date

### 1.3 Subscription Metrics

| Metric | Month 6 Target | Month 12 Target | Month 24 Target |
|--------|----------------|-----------------|-----------------|
| MAU | 50,000 | 250,000 | 1,000,000 |
| Free → Plus conversion | 5% | 7% | 8% |
| Plus → Pro conversion | 15% | 20% | 25% |
| Monthly churn (Plus) | 8% | 6% | 5% |
| Monthly churn (Pro) | 5% | 4% | 3% |
| LTV:CAC ratio | 2:1 | 3:1 | 4:1 |
| Annual plan adoption | 20% | 35% | 45% |

### 1.4 Subscription Revenue Projections

| Month | MAU | Paid Users | MRR |
|-------|-----|------------|-----|
| 6 | 50K | 2,500 | $17,500 |
| 12 | 250K | 20,000 | $160,000 |
| 18 | 500K | 50,000 | $425,000 |
| 24 | 1M | 100,000 | $900,000 |

*Assumes blended ARPU of $8.50 across tiers*

---

## Part 2: Expert Marketplace

### 2.1 Expert Tiers

#### Community Giver (Free)
**Requirements:** Complete 10 helpful feedback reviews  
**Purpose:** Build community, identify potential experts

| Benefit | Details |
|---------|---------|
| Give feedback | Unlimited |
| Earn points | 5 points per review, +10 if marked helpful |
| Badges | Earn based on activity and helpfulness |
| Visibility | Standard placement in community queue |
| Earnings | None (intrinsic rewards only) |

#### Verified Expert (Application-Based)
**Requirements:** Application with credentials OR top 5% community rating  
**Purpose:** Quality tier, professional advice

| Benefit | Details |
|---------|---------|
| Verified badge | Checkmark on profile |
| Expert-only queue | Access requests from Pro/VIP users |
| Accept paid reviews | Set your own rates |
| Platform fee | 25% of paid sessions |
| Analytics | See your ratings, response times, earnings |
| Earnings potential | $500-2,000/month |

**Verification Criteria (any one):**
- Fashion degree or certification
- 3+ years professional styling experience
- 10,000+ social media followers in fashion niche
- Top 5% community rating after 100+ reviews

#### Pro Expert (Subscription)
**Price:** $19.99/month OR reduced platform fee (15% instead of 25%)  
**Requirements:** Verified Expert with $500+ monthly earnings  
**Purpose:** High-earning experts who want better economics

| Benefit | Details |
|---------|---------|
| Everything in Verified | ✓ |
| Featured placement | Top of search results |
| Reduced platform fee | 15% (vs 25%) |
| Pro Expert badge | Premium visual distinction |
| Booking tools | Calendar integration, availability settings |
| Client management | Notes, history, favorites |
| Analytics dashboard | Detailed earnings, conversion rates |
| Priority support | Direct line to expert success team |

**Economics Example:**
- Expert earns $2,000/month in bookings
- Standard fee (25%): Expert keeps $1,500
- Pro Expert fee (15%): Expert keeps $1,700
- Pro subscription cost: $20
- Net benefit at $2K/month: $180/month

### 2.2 Expert Services & Pricing

#### Service Menu

| Service | Description | Price Range | Platform Fee | Turnaround |
|---------|-------------|-------------|--------------|------------|
| Quick Review | Async feedback on one outfit | $8-15 | 25% | <2 hours |
| Detailed Review | In-depth written analysis | $20-35 | 25% | <4 hours |
| Outfit Comparison | Compare 2-3 options | $25-40 | 25% | <4 hours |
| Live Video Consult | Real-time styling session | $40-100 | 25% | Scheduled |
| Wardrobe Audit | Full closet review + plan | $150-500 | 20% | 1-3 days |
| Event Styling | Complete look for occasion | $200-800 | 20% | Varies |
| Monthly Retainer | Ongoing stylist access | $300-1000 | 20% | Monthly |

#### Pricing Guidelines

Experts set their own prices within ranges. Platform provides:
- Suggested pricing based on experience level
- Competitive pricing insights ("Similar experts charge $X")
- Dynamic pricing option (higher during peak demand)

### 2.3 Expert Marketplace Features

#### For Users (Receiving Advice)

**Expert Discovery:**
```
┌─────────────────────────────────────────┐
│  Find Your Perfect Stylist              │
│                                         │
│  [Search by specialty, style, price]    │
│                                         │
│  Filter by:                             │
│  ○ Specialty: Workwear | Casual | ...   │
│  ○ Price: $ | $$ | $$$                  │
│  ○ Availability: Now | Today | This wk  │
│  ○ Rating: 4.5+ stars                   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 👩 Sarah M. ✓                   │    │
│  │ ⭐ 4.9 (234 reviews)            │    │
│  │ "Workwear & professional style" │    │
│  │ Quick Review: $12               │    │
│  │ [View Profile] [Book Now]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 👩 Jessica T. ✓ PRO             │    │
│  │ ⭐ 4.8 (589 reviews)            │    │
│  │ "Date night & evening looks"    │    │
│  │ Quick Review: $15               │    │
│  │ [View Profile] [Book Now]       │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Expert Profile:**
- Bio, photo, credentials
- Specialties and style aesthetic
- Portfolio of past work (with permission)
- Reviews and ratings
- Services offered with prices
- Availability calendar
- "Book Now" or "Request Review"

**Booking Flow:**
1. Select service type
2. Upload outfit photo(s) + context
3. Add notes for stylist
4. Confirm price and turnaround
5. Payment (held in escrow)
6. Expert accepts and delivers
7. User reviews and releases payment

#### For Experts (Giving Advice)

**Expert Dashboard:**
```
┌─────────────────────────────────────────┐
│  Welcome back, Sarah! ✓ Verified        │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ $847     │ │ 23       │ │ 4.9⭐    │ │
│  │ Earned   │ │ Reviews  │ │ Rating   │ │
│  │ this mo  │ │ this mo  │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                         │
│  Pending Requests (3)                   │
│  ┌─────────────────────────────────┐    │
│  │ Quick Review • $12              │    │
│  │ "Work outfit for presentation"  │    │
│  │ ⏱️ Requested 15 min ago         │    │
│  │ [Accept] [Decline]              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  │ Detailed Review • $28           │    │
│  │ "Date night options"            │    │
│  │ ⏱️ Requested 1 hour ago          │    │
│  │ [Accept] [Decline]              │    │
│                                         │
│  In Progress (2)                        │
│  • Quick Review - Due in 1h 23m        │
│  • Detailed Review - Due in 3h 45m     │
│                                         │
└─────────────────────────────────────────┘
```

**Expert Tools:**
- Request queue with accept/decline
- Timer for turnaround commitments
- Response templates (customizable)
- Client history and notes
- Earnings tracker and payout schedule
- Availability calendar
- Auto-accept rules (optional)

### 2.4 Expert Quality Control

**Rating System:**
- 5-star rating after each interaction
- Written review (optional)
- Specific dimensions: Helpfulness, Specificity, Kindness
- Ratings visible on profile (aggregate)

**Quality Thresholds:**

| Rating | Status | Action |
|--------|--------|--------|
| 4.5+ | Excellent | Featured placement |
| 4.0-4.4 | Good | Standard placement |
| 3.5-3.9 | Warning | Coaching offered |
| Below 3.5 | Probation | 30-day improvement period |
| Below 3.0 | Removal | Verified status revoked |

**Response Time SLA:**

| Service | Target | Breach Action |
|---------|--------|---------------|
| Quick Review | 2 hours | User can cancel, full refund |
| Detailed Review | 4 hours | User can cancel, full refund |
| Scheduled Video | On time | Partial refund if >5 min late |

**Dispute Resolution:**
1. User flags issue
2. Platform reviews interaction
3. Mediation attempt
4. Refund or partial refund if warranted
5. Expert rating impact if at fault

### 2.5 Expert Marketplace Database Schema

```sql
-- Expert Profiles
CREATE TABLE expert_profiles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    
    -- Status
    tier VARCHAR(20) DEFAULT 'community', -- community, verified, pro
    verified_at TIMESTAMP,
    pro_since TIMESTAMP,
    
    -- Profile
    display_name VARCHAR(100),
    bio TEXT,
    specialties TEXT[], -- ['workwear', 'casual', 'evening']
    credentials TEXT,
    portfolio_urls TEXT[],
    
    -- Settings
    accepting_requests BOOLEAN DEFAULT TRUE,
    auto_accept_quick_reviews BOOLEAN DEFAULT FALSE,
    availability JSONB, -- Calendar/hours
    
    -- Stats
    total_reviews INT DEFAULT 0,
    average_rating DECIMAL(3,2),
    total_earnings DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Expert Services (what each expert offers)
CREATE TABLE expert_services (
    id UUID PRIMARY KEY,
    expert_id UUID REFERENCES expert_profiles(id),
    
    service_type VARCHAR(50), -- quick_review, detailed_review, video, etc.
    price DECIMAL(8,2),
    turnaround_hours INT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bookings
CREATE TABLE expert_bookings (
    id UUID PRIMARY KEY,
    
    -- Parties
    user_id UUID REFERENCES users(id),
    expert_id UUID REFERENCES expert_profiles(id),
    service_id UUID REFERENCES expert_services(id),
    
    -- Request details
    outfit_check_id UUID REFERENCES outfit_checks(id),
    notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', 
    -- pending, accepted, in_progress, delivered, completed, cancelled, disputed
    
    -- Timing
    requested_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    due_at TIMESTAMP,
    delivered_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Payment
    price DECIMAL(8,2),
    platform_fee DECIMAL(8,2),
    expert_payout DECIMAL(8,2),
    payment_status VARCHAR(20), -- held, released, refunded
    
    -- Review
    user_rating INT,
    user_review TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Expert Payouts
CREATE TABLE expert_payouts (
    id UUID PRIMARY KEY,
    expert_id UUID REFERENCES expert_profiles(id),
    
    amount DECIMAL(10,2),
    period_start DATE,
    period_end DATE,
    status VARCHAR(20), -- pending, processing, completed, failed
    
    payout_method VARCHAR(20), -- stripe, paypal, bank
    payout_details JSONB,
    
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.6 Expert Marketplace Metrics

| Metric | Month 8 Target | Month 12 Target | Month 24 Target |
|--------|----------------|-----------------|-----------------|
| Verified Experts | 50 | 200 | 1,000 |
| Pro Experts | 10 | 50 | 200 |
| Monthly bookings | 500 | 5,000 | 50,000 |
| GMV | $10K | $100K | $1M |
| Platform revenue | $2.5K | $25K | $250K |
| Expert avg earnings | $200 | $500 | $1,000 |
| Avg rating | 4.6 | 4.7 | 4.7 |
| Booking completion rate | 90% | 94% | 96% |

---

## Part 3: Affiliate Commerce

### 3.1 Integration Strategy

**Philosophy:** Shopping should feel like a helpful extension of feedback, not an interruption.

**When to Show:**
- After AI feedback is delivered
- When AI recommends adding/changing an item
- When user explicitly asks "where can I buy X?"
- In "Shop Your Style" section of app

**When NOT to Show:**
- During feedback delivery
- When user is clearly just getting validation (high-score outfits)
- If user has disabled shopping suggestions

### 3.2 Affiliate Partners

#### Tier 1: Direct Integrations (API)

| Partner | Commission | Why |
|---------|------------|-----|
| ShopStyle Collective | 5-15% | Aggregates 1,400+ retailers |
| RewardStyle/LTK | 10-20% | Strong fashion focus |
| Amazon Associates | 3-4% | Basics, accessories |
| Rakuten | Varies | Major retailers |

#### Tier 2: Direct Retailer Partnerships

| Retailer | Target Commission | Notes |
|----------|-------------------|-------|
| Nordstrom | 5-7% | Premium positioning |
| ASOS | 6-8% | Younger demo |
| Revolve | 8-10% | Trend-forward |
| ThredUp | 10-15% | Sustainability angle |
| Rent the Runway | 10-12% | Events/special occasions |

### 3.3 Shopping Experience UI

**After Feedback - Shop Section:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 AI suggested: "A structured blazer would elevate this look"

Shop Blazers That Match Your Style
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────┐ ┌─────────┐ ┌─────────┐
│ [Image] │ │ [Image] │ │ [Image] │
│         │ │         │ │         │
│ ASOS    │ │Nordstrom│ │ Mango   │
│ $89     │ │ $149    │ │ $79     │
│ ⭐ 4.5  │ │ ⭐ 4.8  │ │ ⭐ 4.2  │
└─────────┘ └─────────┘ └─────────┘

[See More Blazers →]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Product Matching Logic:**
1. AI identifies item category from feedback
2. Extract user's style preferences and size (if known)
3. Query affiliate APIs for matching products
4. Rank by: relevance, rating, price point match
5. Show 3-6 options, diverse price range

**Product Card:**
- Product image
- Retailer name/logo
- Price
- Rating (if available)
- "View at [Retailer]" CTA

### 3.4 Affiliate Technical Implementation

```typescript
// Product recommendation service
interface ProductRecommendation {
  query: {
    category: string;        // "blazer", "earrings", etc.
    style: string[];         // ["classic", "professional"]
    priceRange: {
      min: number;
      max: number;
    };
    size?: string;
    color?: string;
  };
}

interface AffiliateProduct {
  id: string;
  name: string;
  retailer: string;
  price: number;
  originalPrice?: number;   // For sale items
  imageUrl: string;
  productUrl: string;       // Affiliate link
  affiliateNetwork: string;
  commission: number;
  rating?: number;
  inStock: boolean;
}

// Track clicks and conversions
interface AffiliateClick {
  id: UUID;
  user_id: UUID;
  outfit_check_id: UUID;
  product_id: string;
  retailer: string;
  clicked_at: timestamp;
  converted: boolean;
  conversion_value?: number;
  commission_earned?: number;
}
```

**Database Schema:**
```sql
CREATE TABLE affiliate_clicks (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    outfit_check_id UUID REFERENCES outfit_checks(id),
    
    -- Product info
    product_external_id VARCHAR(255),
    product_name VARCHAR(255),
    retailer VARCHAR(100),
    category VARCHAR(100),
    price DECIMAL(10,2),
    
    -- Affiliate info
    affiliate_network VARCHAR(50),
    affiliate_link TEXT,
    
    -- Tracking
    clicked_at TIMESTAMP DEFAULT NOW(),
    converted BOOLEAN DEFAULT FALSE,
    conversion_at TIMESTAMP,
    order_value DECIMAL(10,2),
    commission_earned DECIMAL(10,2)
);

CREATE TABLE affiliate_payouts (
    id UUID PRIMARY KEY,
    network VARCHAR(50),
    period_start DATE,
    period_end DATE,
    clicks INT,
    conversions INT,
    revenue DECIMAL(10,2),
    commission DECIMAL(10,2),
    status VARCHAR(20),
    paid_at TIMESTAMP
);
```

### 3.5 Affiliate Metrics

| Metric | Month 3 Target | Month 12 Target | Month 24 Target |
|--------|----------------|-----------------|-----------------|
| Shop section views | 5K | 100K | 500K |
| Click-through rate | 3% | 5% | 7% |
| Conversion rate | 2% | 3% | 4% |
| Avg order value | $75 | $85 | $100 |
| Monthly affiliate revenue | $500 | $15K | $75K |
| Revenue per feedback | $0.10 | $0.15 | $0.25 |

---

## Part 4: Sponsored Recommendations

### 4.1 Sponsorship Model

**Philosophy:** Sponsors pay for distribution of genuinely relevant products, not for biased advice.

**How It Works:**
1. AI gives authentic feedback (never influenced by sponsors)
2. If AI recommends a category (e.g., "add a belt"), check for sponsor match
3. If sponsor has relevant product, show as "Featured Partner" option
4. If no sponsor match, show regular affiliate products
5. Always include non-sponsored alternatives

### 4.2 Sponsorship Tiers

#### Category Sponsorship
**Price:** $25,000 - $75,000 / month  
**What They Get:** Featured placement when their category is recommended

| Category | Example Sponsor | Monthly Impressions (est.) |
|----------|-----------------|---------------------------|
| Blazers & Workwear | Theory, M.M.LaFleur | 50K |
| Dresses | Reformation, Anthropologie | 80K |
| Accessories | BaubleBar, Gorjana | 100K |
| Shoes | Sam Edelman, Steve Madden | 60K |
| Basics | Everlane, Uniqlo | 120K |

#### Occasion Sponsorship
**Price:** $50,000 - $150,000 / month  
**What They Get:** Featured when user selects their occasion

| Occasion | Example Sponsor | Monthly Checks (est.) |
|----------|-----------------|----------------------|
| Work | Ann Taylor, J.Crew | 100K |
| Date Night | Revolve, ASTR | 60K |
| Interview | Banana Republic | 30K |
| Event/Wedding | BHLDN, Lulus | 40K |
| Casual | Madewell, Abercrombie | 80K |

#### Brand of the Month
**Price:** $100,000 - $250,000 / month  
**What They Get:** Premium placement across all relevant contexts

- Logo in "Featured Partner" section
- First position in all relevant shopping results
- Dedicated "Shop [Brand]" section in app
- Push notification to relevant users (1x)
- Social media feature

### 4.3 Sponsored Content UI

**Feedback with Sponsor:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Quick Fix: "A structured blazer would polish this look"

┌─────────────────────────────────────┐
│  Featured Partner                   │
│  ┌─────────────────────────────┐    │
│  │        [THEORY LOGO]        │    │
│  │                             │    │
│  │  [Product Image]            │    │
│  │  Wool-Blend Blazer          │    │
│  │  $395  ⭐ 4.7 (128 reviews) │    │
│  │                             │    │
│  │  [Shop at Theory →]         │    │
│  └─────────────────────────────┘    │
│  Sponsored                          │
└─────────────────────────────────────┘

More blazer options:
┌─────────┐ ┌─────────┐ ┌─────────┐
│ ASOS    │ │Nordstrom│ │ Mango   │
│ $89     │ │ $149    │ │ $79     │
└─────────┘ └─────────┘ └─────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Key Design Rules:**
- "Sponsored" or "Featured Partner" label always visible
- Non-sponsored alternatives always shown
- Sponsor never influences the actual feedback text
- User can hide sponsored content in settings (paid tiers only)

### 4.4 Sponsor Self-Serve Platform (Phase 3)

**Sponsor Dashboard:**
```
┌─────────────────────────────────────────┐
│  Theory - Sponsor Dashboard             │
│                                         │
│  Campaign: Blazer Category Sponsorship  │
│  Status: Active                         │
│  Period: Feb 1 - Feb 28, 2026           │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 45,234   │ │ 2,156    │ │ $18,450  │ │
│  │Impressions│ │ Clicks   │ │ Revenue  │ │
│  │          │ │ 4.8% CTR │ │ $8.56 AOV│ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                         │
│  Products in Rotation:                  │
│  • Wool-Blend Blazer ($395) - 890 clicks│
│  • Linen Blazer ($295) - 567 clicks     │
│  • Cropped Blazer ($345) - 432 clicks   │
│                                         │
│  [Add Products] [Edit Campaign]         │
│                                         │
└─────────────────────────────────────────┘
```

### 4.5 Sponsor Revenue Projections

| Month | Active Sponsors | Avg Deal Size | Monthly Revenue |
|-------|-----------------|---------------|-----------------|
| 9 | 2 | $30K | $60K |
| 12 | 5 | $40K | $200K |
| 18 | 10 | $50K | $500K |
| 24 | 15 | $60K | $900K |

### 4.6 Sponsor Sales Process

**Phase 2 (Month 6-12): Manual Outreach**
1. Identify 20 target brands aligned with user demographics
2. Create pitch deck with user data and engagement metrics
3. Offer pilot programs at 50% discount
4. Prove ROI with detailed reporting
5. Convert pilots to ongoing contracts

**Phase 3 (Month 12+): Self-Serve Platform**
1. Build sponsor dashboard
2. Automated campaign setup
3. Real-time bidding for category placement
4. Self-serve creative upload
5. Automated billing and reporting

---

## Part 5: Data & Insights (B2B)

### 5.1 Data Products

#### Trend Reports (Quarterly)
**Price:** $15,000 - $50,000  
**Audience:** Fashion brands, retailers, trend forecasters

**Contents:**
- Top occasions by volume and growth
- Emerging style preferences by demographic
- Color trends by season
- Category demand shifts
- User concern patterns ("what are people struggling with?")
- Geographic variations

#### Custom Research
**Price:** $25,000 - $100,000  
**Audience:** Brands with specific questions

**Examples:**
- "How do women 35-45 in NYC dress for work in 2026?"
- "What percentage of our target demo owns activewear they style casually?"
- "Which accessories are trending for evening occasions?"

#### Real-Time Trend API (Phase 4)
**Price:** $5,000 - $20,000 / month  
**Audience:** Fast-fashion retailers, trend services

**Features:**
- Daily trend pulse
- Category velocity metrics
- Style preference shifts
- Integration with their systems

### 5.2 Data Privacy & Ethics

**Principles:**
1. All data fully anonymized and aggregated
2. No individual-level data sold
3. Minimum cohort size of 100 users for any insight
4. Users can opt out of data aggregation
5. Clear disclosure in privacy policy
6. GDPR/CCPA compliant

**Anonymization Process:**
1. Remove all PII (email, name, photos)
2. Aggregate to cohort level (demographic + geo)
3. Add noise to prevent re-identification
4. Review by privacy team before any sale

### 5.3 Data Revenue Projections

| Month | Products Sold | Revenue |
|-------|---------------|---------|
| 18 | 3 trend reports | $75K |
| 24 | 6 reports + 2 custom | $250K |

---

## Part 6: Enterprise/B2B

### 6.1 White-Label Styling Tool

**Product:** Embeddable outfit feedback for retailer apps/websites  
**Price:** $10,000 - $50,000 / month based on usage  
**Audience:** Fashion retailers, e-commerce platforms

**How It Works:**
1. Retailer integrates FitCheck SDK
2. Their customers upload outfit photos
3. AI feedback references retailer's inventory
4. Shopping links go to retailer's products

**Example Client:** Nordstrom embeds "Outfit Check" in their app
- Customer uploads outfit photo
- AI: "This look needs a structured blazer"
- Shows Nordstrom blazers, not competitors

### 6.2 Corporate Dress Code Assistant

**Product:** Custom AI trained on company dress code  
**Price:** $5 - $15 / employee / month  
**Audience:** HR departments, professional services firms

**How It Works:**
1. Company provides dress code documentation
2. We train custom AI model
3. Employees can check "Does this work for [Company]?"
4. Analytics for HR on common questions/issues

**Example Client:** McKinsey provides to consultants
- New associate unsure about client-ready outfit
- Gets instant feedback aligned with McKinsey standards
- Reduces dress code violations and anxiety

### 6.3 Enterprise Revenue Projections

| Month | Enterprise Clients | Monthly Revenue |
|-------|-------------------|-----------------|
| 20 | 2 | $40K |
| 24 | 5 | $150K |

---

## Part 7: Implementation Timeline

### Phase 1: Foundation (Months 1-6)

| Month | Monetization Milestone |
|-------|----------------------|
| 1 | Launch with Free + Plus tiers |
| 2 | Add Pro tier, implement usage tracking |
| 3 | Soft launch affiliate shopping (non-intrusive) |
| 4 | Implement paywall upgrade flows |
| 5 | Optimize conversion (A/B test pricing, trials) |
| 6 | Launch annual plans, referral program |

**Revenue Target:** $15-25K MRR by Month 6

**Key Metrics to Hit Before Phase 2:**
- [ ] 50K MAU
- [ ] 5% paid conversion
- [ ] Helpfulness rating >4.0
- [ ] D30 retention >15%

### Phase 2: Growth (Months 6-12)

| Month | Monetization Milestone |
|-------|----------------------|
| 6 | Begin expert recruitment |
| 7 | Beta expert marketplace (20 experts) |
| 8 | Full expert marketplace launch |
| 9 | Sign first 2 sponsor partnerships |
| 10 | Launch community feedback + gamification |
| 11 | Expand sponsor program |
| 12 | Launch VIP tier |

**Revenue Target:** $150-200K MRR by Month 12

**Key Metrics to Hit Before Phase 3:**
- [ ] 250K MAU
- [ ] 8% paid conversion
- [ ] 200+ verified experts
- [ ] 3+ active sponsors
- [ ] Expert marketplace GMV $50K+/month

### Phase 3: Scale (Months 12-24)

| Month | Monetization Milestone |
|-------|----------------------|
| 12-14 | Scale expert marketplace, add video consults |
| 15-16 | Launch sponsor self-serve platform |
| 17-18 | First data products sold |
| 19-20 | Enterprise pilot programs |
| 21-22 | International expansion (UK, EU) |
| 23-24 | Optimize all revenue streams |

**Revenue Target:** $500K-1M MRR by Month 24

---

## Part 8: Financial Projections

### Monthly Revenue by Stream (Month 24)

| Stream | MRR | % of Total |
|--------|-----|------------|
| Subscriptions | $350K | 35% |
| Expert Marketplace | $250K | 25% |
| Affiliate Commerce | $150K | 15% |
| Sponsored Content | $150K | 15% |
| Data Products | $50K | 5% |
| Enterprise | $50K | 5% |
| **Total** | **$1M** | **100%** |

### Key Financial Metrics

| Metric | Month 12 | Month 24 |
|--------|----------|----------|
| MRR | $175K | $1M |
| ARR | $2.1M | $12M |
| Gross Margin | 75% | 80% |
| CAC | $15 | $12 |
| LTV | $85 | $120 |
| LTV:CAC | 5.7x | 10x |
| Payback Period | 4 months | 3 months |

### Headcount Needs (Monetization)

| Role | Month 6 | Month 12 | Month 24 |
|------|---------|----------|----------|
| Product Manager | 1 | 1 | 2 |
| Engineers | 2 | 4 | 8 |
| Designer | 1 | 1 | 2 |
| Expert Success | 0 | 1 | 3 |
| Partnerships/Sales | 0 | 1 | 3 |
| Data/Analytics | 0 | 1 | 2 |
| **Total** | **4** | **9** | **20** |

---

## Part 9: Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Paid conversion too low | Medium | High | Aggressive A/B testing; value demonstration; time-limited offers |
| Expert supply shortage | Medium | High | Proactive recruitment; fashion school partnerships; competitive payouts |
| Sponsors degrade user trust | Medium | High | Strict separation of advice and commerce; always show alternatives; clear labeling |
| Affiliate commissions cut | Low | Medium | Diversify partners; build direct retailer relationships; own the customer relationship |
| Competitor copies model | High | Medium | Move fast; build network effects; own expert relationships |
| Regulatory (FTC, data privacy) | Low | High | Proactive compliance; clear disclosures; privacy-first design |

---

## Part 10: Success Metrics Dashboard

### Executive Dashboard (Weekly)

**Revenue**
- Total MRR (trend)
- MRR by stream (breakdown)
- New MRR vs churned MRR

**Subscriptions**
- Conversion rate by tier
- Trial-to-paid conversion
- Churn rate by tier
- ARPU

**Expert Marketplace**
- GMV
- Active experts
- Bookings per expert
- Average rating

**Commerce**
- Affiliate clicks
- Conversion rate
- Revenue per feedback
- Active sponsors

**Leading Indicators**
- Daily outfit checks
- Helpfulness ratings
- Expert response time
- Sponsor impression delivery

---

## Appendix A: Pricing A/B Test Plan

**Test 1: Plus Pricing**
- Control: $5.99/month
- Variant A: $4.99/month
- Variant B: $6.99/month
- Variant C: $7.99/month
- Metric: Revenue per visitor (conversion × price)

**Test 2: Trial Length**
- Control: 7-day trial
- Variant A: 3-day trial
- Variant B: 14-day trial
- Variant C: No trial (money-back guarantee)
- Metric: Trial-to-paid conversion, refund rate

**Test 3: Annual Discount**
- Control: 30% off ($49.99/year)
- Variant A: 20% off ($57.99/year)
- Variant B: 40% off ($42.99/year)
- Variant C: 2 months free framing ($49.99/year)
- Metric: Annual plan adoption rate, total revenue

**Test 4: Upgrade Trigger**
- Control: Show upgrade after hitting limit
- Variant A: Show upgrade proactively at 2/3 checks
- Variant B: Show upgrade after positive feedback ("You look great! Want unlimited?")
- Metric: Upgrade conversion rate

---

## Appendix B: Expert Recruitment Plan

### Phase 1: Seed Experts (Month 6-7)
**Goal:** 50 verified experts

**Channels:**
1. Fashion school partnerships (FIT, Parsons, FIDM)
   - Reach out to career services
   - Offer to recent grads as portfolio builder
   
2. Instagram/TikTok stylists
   - DM fashion content creators 10K-100K followers
   - Offer early access and featured placement
   
3. Personal stylist directories
   - Reach out to Thumbtack, Yelp-listed stylists
   - Position as additional income stream

4. Fashion industry network
   - LinkedIn outreach to working stylists
   - Fashion magazine editor connections

**Incentive:** First 50 experts get "Founding Expert" badge + 6 months Pro free + 10% platform fee (vs 25%)

### Phase 2: Scale Experts (Month 8-12)
**Goal:** 200 verified experts

**Channels:**
1. Referral program (experts invite experts)
2. Expert success stories (case studies, earnings highlights)
3. Fashion conference presence
4. Expert ambassador program
5. Organic applications from product growth

---

## Appendix C: Sponsor Pitch Deck Outline

1. **The Opportunity**
   - Women make 80% of fashion purchase decisions
   - $890B in returns = "doesn't look right" problem
   - FitCheck reaches women at moment of decision

2. **Our Audience**
   - Demographics: Women 25-45, household income $75K+
   - Behavior: Fashion-engaged, purchase-ready
   - Scale: X MAU, Y outfit checks/month

3. **Sponsorship Options**
   - Category sponsorship
   - Occasion sponsorship
   - Brand of the month

4. **How It Works**
   - AI gives genuine feedback
   - Your products shown when relevant
   - Clear "Featured Partner" positioning
   - Full analytics and attribution

5. **Case Study**
   - [Pilot partner] results
   - CTR, conversion, ROAS

6. **Pricing & Next Steps**

---

*End of Monetization PRD*
