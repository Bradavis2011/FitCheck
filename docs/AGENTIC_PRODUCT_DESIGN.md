# Open Or This? — Agentic Product Design

## The Question

We've been applying agentic thinking to how we *build* Or This? — Claude writing code, agents running tests, automated deploys. But what if we applied the same principles to the product itself? What would it mean for Or This? to be agentic — not just AI-assisted, but genuinely autonomous on behalf of the user?

OpenClaw succeeded because it inverted the traditional model: instead of a closed system where users interact with a fixed interface, it created an open loop where the tool acts *on the user's behalf*, learns from outcomes, and compounds its effectiveness over time. The user sets intent; the system does the work.

Or This? today is a prompt wrapper with a community bolted on. The user takes a photo, gets a score, maybe asks the community. That's a tool. Not an agent.

What follows is an exploration of what happens when you make the product itself agentic.

---

## What "Agentic" Actually Means Here

An agentic product has three properties that a tool does not:

1. **It acts without being asked.** A tool waits for input. An agent anticipates.
2. **It chains actions toward a goal.** A tool does one thing. An agent sequences multiple steps.
3. **It learns from its own outputs.** A tool is stateless. An agent accumulates context.

Or This? currently has none of these. You open the app, take a photo, read the feedback, close the app. The AI doesn't remember what worked last time. It doesn't know you have a wedding on Saturday. It doesn't go find the shoes that would fix the outfit. It's a vending machine — insert photo, receive opinion.

---

## The Shift: From "Check My Outfit" to "Get Me Ready"

### The Tool Version (What We Have)
```
User opens app → takes photo → gets score → reads feedback → closes app
```

### The Agent Version (What We Could Build)
```
Saturday wedding is 3 days away.
Agent already knows (from calendar integration or manual event creation).
Agent has your wardrobe catalog.
Agent has your Style DNA from 47 previous outfit checks.
Agent has the dress code (cocktail attire).
Agent has the weather forecast (72°F, partly cloudy, outdoor ceremony).

Tuesday evening:
  → Agent surfaces a notification: "Your Saturday wedding outfit —
     I pulled 3 options from your wardrobe. Want to see them?"
  → User taps through. Agent has already assembled combinations
     from wardrobe items, scored them against the event context,
     and ranked them.
  → User picks one, tries it on, snaps a photo.
  → Agent compares the real photo against the virtual assembly.
     "The blazer fits looser than expected — try rolling the
     sleeves once for a more relaxed silhouette.
     Score: 8.2 → projected 8.7 with that adjustment."

Thursday:
  → Agent: "Weather updated — 68°F with chance of rain.
     Your open-toe shoes might not work. Your tan ankle boots
     scored 8.4 in similar outfits. Swap?"

Saturday morning:
  → Agent: "Your outfit is ready. Here's your final look
     with the ankle boot swap. Confidence score: 9.1.
     You're going to kill it."
```

That's not a tool. That's a stylist. The difference is the agent *holds state across time* and *acts proactively toward a goal the user set once*.

---

## The Five Agentic Capabilities

### 1. Proactive Outreach (Act Without Being Asked)

**Current:** User opens app when they feel outfit anxiety.
**Agentic:** Agent reaches out when it detects an upcoming need.

**Triggers:**
- Calendar event with dress code implications (detected from event creation or calendar sync)
- Weather change that affects a planned outfit
- A wardrobe item the user hasn't worn in 60 days that matches an upcoming occasion
- A community trend that matches the user's Style DNA ("Burgundy + cream is trending — you own both")
- Morning of a workday: "Quick check before you leave? Your last 3 Monday outfits scored 8+. Keep the streak going."

**The OpenClaw lesson:** The most powerful agentic behavior is *reducing the activation energy to zero*. The user doesn't have to remember to open the app. The app remembers for them.

### 2. Multi-Step Planning (Chain Actions Toward a Goal)

**Current:** One photo → one score → done.
**Agentic:** User sets a goal, agent works toward it over days.

**Example goals:**
- "I want to look amazing at the Johnson wedding on March 15"
- "I have 3 interviews next week — help me nail the outfits"
- "I'm trying to develop a more minimalist style"
- "I packed for a 5-day work trip — plan my outfits"

**Agent behavior:**
1. Break the goal into sub-tasks (select options, try on, refine, finalize)
2. Work through sub-tasks over multiple days
3. Adapt the plan based on new information (weather, user mood, what they actually own)
4. Track progress and surface the next action

This is the exact pattern that makes agentic coding tools powerful — they don't just answer one question, they hold a *plan* and execute against it.

### 3. Cross-System Intelligence (Connect Data the User Can't)

**Current:** AI sees one photo in isolation.
**Agentic:** AI connects your wardrobe, your history, the weather, the event, community trends, and what worked for users with similar Style DNA.

**Concrete connections:**
- "You wore this blazer to your last 3 work events and scored 7.8 avg. Users with similar Style DNA who switched to a structured cardigan scored 8.5+. Worth trying?"
- "This color combo worked for you in warm weather (8.4) but underperformed in cool weather (6.9). Today is cool — consider swapping the linen pants."
- "Your friend @sarah posted a cocktail look that scored 9.1. You own 2 of the 3 pieces. Want me to suggest the third?"

**The OpenClaw lesson:** The value isn't in any single AI call. It's in the *connections between data points* that no human would think to make. The agent sees the whole graph.

### 4. Persistent Memory (Learn From Its Own Outputs)

**Current:** Style DNA extracts attributes. But the AI doesn't meaningfully *use* them across sessions.
**Agentic:** Every interaction refines a model of the user that persists and compounds.

**What the agent should remember:**
- Not just what scored well, but *why* (the user liked the fit feedback but ignored the color advice — they trust their own color sense)
- That the user always rejects "try tucking in your shirt" suggestions (body confidence issue — stop suggesting it)
- That the user's scores spike when they wear earth tones + structured silhouettes
- That the user checks outfits at 7:15am on weekdays (commute timing) and 6pm on Fridays (going out)
- That the user asks more follow-up questions about accessories than about the main garment (accessory anxiety, not outfit anxiety)

**The compounding effect:** After 50 interactions, the agent should feel like it *knows* you. After 200, it should feel like a friend who happens to have perfect fashion knowledge. This is the moat — not the LLM, but the accumulated understanding of each individual user.

### 5. Open Loop (Let the User Shape the Agent's Behavior)

**Current:** Fixed AI prompt. Every user gets the same feedback personality.
**Agentic:** Users can tune how the agent behaves.

**Tunable dimensions:**
- **Honesty level:** "Be brutally honest" vs. "Be encouraging, focus on what works"
- **Detail level:** "Just give me the score and one tip" vs. "Full analysis please"
- **Style aspirations:** "I want to dress like [reference images / style icons]"
- **No-go zones:** "Never suggest heels" / "I don't wear patterns" / "Don't comment on my weight"
- **Feedback voice:** "Talk to me like a best friend" vs. "Talk to me like a Vogue editor"

**The OpenClaw lesson:** The product becomes *the user's agent*, not a generic service. The customization isn't cosmetic — it changes the fundamental behavior of the system. This is what "open" means in practice: the user has real control over the agent's goals and constraints.

---

## What "Open" Means for Or This?

OpenClaw's "open" isn't just about open-source code. It's about an open *loop* — the system is transparent, modifiable, and composable. Applied to Or This?:

### Open Feedback Loop
- Show the user *why* the AI scored them a 7.2, not just that it did
- Let them disagree ("I think the color is fine") and have that reshape future feedback
- Show the delta between AI score and community score, and let the user decide which calibration they prefer

### Open Style Graph
- Let users see their Style DNA evolving over time (we planned this)
- But also: let them *set* style goals and watch the agent track progress
- "You wanted to move toward minimalism. 3 months ago, 20% of your outfits were minimalist. Now it's 55%. Your minimalist outfits score 1.2 points higher than your non-minimalist ones."

### Open Integrations
- Let the agent connect to what the user already uses:
  - Calendar (event awareness)
  - Weather apps (contextual advice)
  - Shopping apps (when the agent suggests "a structured bag would complete this," it can actually find one)
  - Social media (pull outfit inspo from saved posts)
- Each integration makes the agent more capable, which makes the product stickier

### Open Community Intelligence
- The agent doesn't just serve one user — it learns from the entire community
- "Open" means the aggregate intelligence flows back to every user:
  - Trend detection: "Earth tones are up 35% this month across all users"
  - Occasion intelligence: "For outdoor weddings, users who scored 9+ all avoided silk"
  - Regional style: "In your city, smart casual skews more structured than national average"

---

## The Product Implications

### What Changes in the UX

**Home screen:** Not "Check My Outfit" but "Your Week" — a timeline of upcoming events/occasions with outfit status (planned, tried on, finalized, needs attention).

**Notifications:** Not "Come back and check an outfit!" but "Your Thursday dinner outfit — I noticed the forecast changed. Want to swap the sandals?"

**Onboarding:** Not "Take your first photo" but "Tell me about your week. What's coming up? What are you stressed about wearing to?"

**Community:** Not "Browse outfits" but "People with your style scored these looks highly this week" — curated, not firehose.

### What Changes in the Business Model

**Free tier:** The agent works, but reactively. You still have to open the app and ask.

**Plus tier:** The agent becomes proactive. It reaches out. It plans. It connects to your calendar. This is the real value jump — not "unlimited checks" but "the agent actually works for you."

**Pro tier:** Full autonomy. The agent manages your style across events, seasons, wardrobe changes. Expert stylists can review the agent's recommendations (not just individual outfits). Style DNA becomes a living document the agent and stylists co-maintain.

**This reframes the subscription from "more of the same" to "a fundamentally different relationship with the product."** Free users have a tool. Plus users have an assistant. Pro users have a stylist who never sleeps.

### What Changes in the Moat

The current moat is the Style Intelligence Engine — structured data from every outfit check. An agentic product deepens this moat enormously:

- **Behavioral data:** Not just what the user wore, but what they rejected, what they asked about, what they changed their mind on
- **Intent data:** Not just "she checked an outfit" but "she's preparing for a job interview on Thursday and she's anxious about looking too casual"
- **Temporal data:** Style patterns across seasons, life events, mood shifts
- **Relational data:** Which community members influence which users' style choices

This dataset is orders of magnitude more valuable to brands and retailers than outfit scores alone. A brand doesn't just want to know "navy blazers score well." They want to know "women preparing for job interviews in March buy structured blazers 3 days before the interview, and 40% of them also buy a new bag."

---

## Implementation Priority

If we were to move toward this, the order matters:

### Phase 1: Memory (Foundation)
Make the AI actually remember and reference past interactions meaningfully. The Style DNA engine is the start. But it needs to go deeper — not just attributes, but preferences, rejections, patterns of behavior.

### Phase 2: Proactive Outreach
Event-aware notifications. Weather-aware suggestions. "Your week" view on home screen. The agent starts reaching out instead of waiting.

### Phase 3: Multi-Step Planning
Goal-setting for events and style evolution. The agent holds a plan and works through it over days. Wardrobe-aware outfit assembly.

### Phase 4: Open Loop
User-tunable agent behavior. Feedback on the feedback. Style aspiration tracking. The agent becomes *yours*, not *ours*.

### Phase 5: Connected Intelligence
Calendar integration. Shopping integration. Community trend intelligence flowing into individual recommendations.

---

## The Risk

The risk of agentic products is the same as the risk of agentic anything: **if the agent is wrong, and it's proactive, it's annoying instead of helpful.**

A bad tool is ignorable. A bad agent is intrusive.

This means the quality bar for proactive outreach is *much* higher than for reactive feedback. The agent should only reach out when it has high-confidence, high-value information. One bad notification ("You should try a red blazer!" when the user hates red) and the user disables notifications forever.

**Mitigation:** Start conservative. The agent earns the right to be proactive by being right when reactive. Track the ratio of proactive suggestions accepted vs. dismissed. Only increase proactive frequency when acceptance rate is above 60%.

---

## The Bottom Line

Or This? today is a camera that gives opinions. An agentic Or This? is a stylist that knows you, plans ahead, reaches out when you need it, connects dots you can't see, and gets better every day.

The LLM is the same either way. The difference is everything *around* the LLM — the memory, the planning, the proactivity, the connections, the user model. That's the product. That's the moat. That's what "open" means when applied to a consumer product: the system is transparent, tunable, and working *for* the user, not just *responding to* the user.

OpenClaw didn't succeed because it was a better chatbot. It succeeded because it was an agent that held context, chained actions, and compounded knowledge. Or This? can do the same thing — but for getting dressed in the morning instead of writing code.
