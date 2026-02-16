# Phase 3: Social Features (Community Tab)

## Context

The solo flow works perfectly: users can submit outfits, get AI feedback, track streaks, and manage their history. Now we add the social layer that transforms FitCheck from a personal tool into a community platform. Users can share their best outfits, get feedback from real people, discover trends, and build their fashion credibility.

---

## Work Items (10 total, ordered by priority)

### 1. Community Tab - Discovery Feed

**Problem**: App has 4 tabs (Home, Camera, History, Profile). No way to see other users' outfits.

**Files to create**:
- `fitcheck-app/app/(tabs)/community.tsx` - New tab with feed of public outfits

**Files to modify**:
- `fitcheck-app/app/(tabs)/_layout.tsx` - Add 5th tab (Community) to tab bar, reorder to: Home, Camera, **Community**, History, Profile

**Features**:
- Infinite scroll feed of public outfit checks
- Filter by: Recent, Popular (most feedback), Top Rated
- Each card shows: thumbnail, score, occasion, feedback count, username
- Tap card → view full outfit + all feedback (community + AI)
- Pull to refresh

**API needed**: `GET /api/community/feed?filter=recent&limit=20&offset=0`

---

### 2. Make Outfit Public Toggle

**Problem**: All outfit checks are private by default (`isPublic: false`). No UI to share to community.

**Files to modify**:
- `fitcheck-app/app/feedback.tsx` - Add "Share to Community" toggle after getting feedback
- `fitcheck-api/src/controllers/outfit.controller.ts` - Add `togglePublic` endpoint

**Flow**:
1. User gets AI feedback on outfit
2. If score ≥ 7, show "Share to Community?" toggle (prominent CTA)
3. If score < 7, show "Share to Community" as secondary option
4. Toggle updates `outfit.isPublic = true`
5. Outfit now appears in Community feed

**Backend**: `PUT /api/outfits/:id/public` (toggle isPublic field)

---

### 3. Community Feedback System

**Problem**: `CommunityFeedback` table exists but no UI to give/view feedback from other users.

**Files to create**:
- `fitcheck-app/app/outfit/[id].tsx` - Public outfit detail screen (anyone can view if public)
- `fitcheck-app/src/components/CommunityFeedbackCard.tsx` - Display community votes

**Files to modify**:
- `fitcheck-api/src/controllers/social.controller.ts` - Already has endpoints, verify they work

**Features**:
- View outfit with AI feedback + all community feedback
- "What do you think?" section with score slider (1-10) + optional comment
- Submit feedback (stored in `CommunityFeedback` table)
- Show aggregate: "Community Score: 8.2/10 (based on 14 votes)"
- List individual feedback: avatar, username, score, comment, timestamp
- Can't vote on your own outfits

**API**:
- `GET /api/outfits/:id/public` - Get public outfit with all feedback
- `POST /api/outfits/:id/feedback` - Submit community feedback
- `GET /api/outfits/:id/community-feedback` - List all community feedback

---

### 4. User Profiles (Public View)

**Problem**: No way to view other users' profiles or their outfit history.

**Files to create**:
- `fitcheck-app/app/user/[username].tsx` - Public user profile screen

**Features**:
- Header: avatar, username, bio, join date
- Stats: Total public outfits, avg score, total feedback given
- Grid of user's public outfits (sorted by recent or top-rated)
- Tap outfit → view full detail
- **Own profile**: Link from main Profile tab ("View Public Profile")

**API**: `GET /api/users/:username/profile` (returns only public data)

---

### 5. Username & Bio Setup

**Problem**: Users have email/name but no username or bio for public profiles.

**Files to modify**:
- `fitcheck-app/app/(tabs)/profile.tsx` - Add "Edit Profile" section above stats
  - Username input (unique, 3-20 chars, alphanumeric + underscore)
  - Bio textarea (max 150 chars)
  - Public profile toggle (controls `user.isPublic`)
- `fitcheck-api/src/controllers/user.controller.ts` - Update validation for username uniqueness

**Flow**:
1. New users prompted: "Pick a username to share outfits publicly"
2. Can edit anytime in Profile
3. Username shown in Community feed, feedback, etc.

**Backend**: `PUT /api/user/profile` already exists, add username/bio validation

---

### 6. Notifications for Community Feedback

**Problem**: When someone votes on your outfit, you don't know.

**Files to create**:
- `fitcheck-app/app/notifications.tsx` - Notifications screen (accessible from bell icon in header)
- `fitcheck-api/src/services/notification.service.ts` - Create notification records

**Notification types**:
1. "👍 @username rated your outfit 9/10" (CTA: View outfit)
2. "💬 @username commented on your outfit" (CTA: View comment)
3. "🔥 Your outfit hit 10 community votes!" (CTA: View outfit)

**Implementation**:
- Store in-app notifications (not push notifications yet)
- Badge count on bell icon
- Mark as read when viewed
- Filter: All, Unread

**Backend**:
- Create `Notification` model (Prisma schema)
- Trigger notification on `CommunityFeedback` creation
- `GET /api/notifications`, `PUT /api/notifications/:id/read`

---

### 7. Following System (Optional Enhancement)

**Problem**: Can't follow users whose style you like.

**Files to modify**:
- `fitcheck-app/app/user/[username].tsx` - Add "Follow" button
- Prisma schema - Add `Follow` model (follower/following relationship)

**Features**:
- Follow/Unfollow button on user profiles
- Feed filter: "Following" (see only followed users' outfits)
- Profile stats: "X followers, Y following"

**Backend**:
- `POST /api/users/:username/follow`
- `DELETE /api/users/:username/follow`
- `GET /api/users/:username/followers`
- `GET /api/users/:username/following`

---

### 8. Leaderboard

**Problem**: No way to see top contributors or best-dressed users.

**Files to create**:
- `fitcheck-app/app/leaderboard.tsx` - Accessible from Community tab header

**Leaderboard types**:
1. **Top Rated**: Users with highest avg outfit scores (min 5 public outfits)
2. **Most Helpful**: Users who give most feedback to others
3. **Most Popular**: Users with most total community votes received
4. **This Week**: Weekly leaderboard (resets Monday)

**Backend**: `GET /api/leaderboard?type=top-rated&limit=50`

---

### 9. Report/Block System

**Problem**: No moderation tools for inappropriate content or users.

**Files to modify**:
- `fitcheck-app/app/outfit/[id].tsx` - Add "Report" option (3-dot menu)
- `fitcheck-app/app/user/[username].tsx` - Add "Block User" option

**Features**:
- Report outfit: Inappropriate, spam, other (with reason text)
- Block user: Hides their outfits from your feed, prevents them from seeing/voting on yours
- Reports stored for manual review (no auto-moderation yet)

**Backend**:
- Create `Report` model
- `POST /api/outfits/:id/report`
- `POST /api/users/:username/block`
- `GET /api/user/blocked-users`

---

### 10. Community Guidelines & Onboarding

**Problem**: First-time community users don't know the norms.

**Files to create**:
- `fitcheck-app/app/community-guidelines.tsx` - Community rules screen

**Changes**:
- Before first public share: Show "Community Guidelines" modal
  - Be respectful
  - Constructive feedback only
  - No harassment
  - Fashion is subjective
- Checkbox: "I agree to follow community guidelines"
- Link in Community tab footer

---

## Implementation Order

### Phase 3A: Core Social (MVP)
1. **Work Item 1** - Community tab + feed
2. **Work Item 2** - Make outfit public toggle
3. **Work Item 3** - Community feedback system
4. **Work Item 5** - Username & bio setup

### Phase 3B: Discovery & Engagement
5. **Work Item 4** - User profiles (public view)
6. **Work Item 8** - Leaderboard
7. **Work Item 6** - Notifications

### Phase 3C: Safety & Polish (Later)
8. **Work Item 9** - Report/block system
9. **Work Item 10** - Community guidelines
10. **Work Item 7** - Following system (optional)

---

## Backend Changes Required

### New Prisma Models

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  type      String   // "feedback", "milestone", "follow"
  title     String
  message   String
  linkType  String?  @map("link_type") // "outfit", "user"
  linkId    String?  @map("link_id")

  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("notifications")
}

model Follow {
  id          String   @id @default(uuid())
  followerId  String   @map("follower_id")
  follower    User     @relation("UserFollowers", fields: [followerId], references: [id], onDelete: Cascade)
  followingId String   @map("following_id")
  following   User     @relation("UserFollowing", fields: [followingId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now()) @map("created_at")

  @@unique([followerId, followingId])
  @@map("follows")
}

model Report {
  id        String      @id @default(uuid())
  reporterId String     @map("reporter_id")
  reporter   User       @relation(fields: [reporterId], references: [id])

  targetType String     @map("target_type") // "outfit" or "user"
  targetId   String     @map("target_id")

  reason     String
  details    String?
  status     String     @default("pending") // pending, reviewed, resolved

  createdAt  DateTime   @default(now()) @map("created_at")

  @@map("reports")
}

model BlockedUser {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  user       User     @relation("UserBlocks", fields: [userId], references: [id], onDelete: Cascade)
  blockedId  String   @map("blocked_id")
  blocked    User     @relation("UserBlockedBy", fields: [blockedId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now()) @map("created_at")

  @@unique([userId, blockedId])
  @@map("blocked_users")
}
```

### Update User Model

```prisma
model User {
  // Add relations
  notifications   Notification[]
  followers       Follow[]       @relation("UserFollowers")
  following       Follow[]       @relation("UserFollowing")
  reports         Report[]
  blockedUsers    BlockedUser[]  @relation("UserBlocks")
  blockedBy       BlockedUser[]  @relation("UserBlockedBy")
}
```

---

## Frontend Components to Create

1. **OutfitFeedCard** - Compact outfit card for feed
2. **CommunityFeedbackCard** - Display community votes/comments
3. **UserAvatar** - Circular avatar with username
4. **FeedbackScoreSlider** - 1-10 score input
5. **NotificationItem** - Notification list item
6. **LeaderboardRow** - User rank + stats
7. **FilterTabs** - Feed filters (Recent, Popular, Following)

---

## New Dependencies Required

**None** - All features use existing dependencies.

---

## Verification Checklist

### Phase 3A (Core Social)
- [ ] Community tab appears in navigation
- [ ] Feed loads public outfits
- [ ] Can make outfit public after receiving feedback
- [ ] Public outfits appear in feed within 1 minute
- [ ] Can submit community feedback (score + comment)
- [ ] Community feedback displays on outfit detail
- [ ] Can set username and bio in Profile
- [ ] Username shows in feed cards and feedback

### Phase 3B (Discovery)
- [ ] Can tap username to view public profile
- [ ] Public profile shows user's public outfits
- [ ] Leaderboard shows top users by criteria
- [ ] Notifications created when feedback received
- [ ] Bell icon shows unread count
- [ ] Can mark notifications as read

### Phase 3C (Safety)
- [ ] Can report inappropriate outfits
- [ ] Can block users
- [ ] Blocked users hidden from feed
- [ ] Community guidelines shown before first share

---

## Success Metrics

- **Engagement**: % of users who make ≥1 outfit public
- **Activity**: Avg community feedback per public outfit
- **Retention**: DAU increase after enabling community features
- **Quality**: Avg community score vs AI score correlation

---

## Notes

- Keep AI feedback always visible (it's the core value)
- Community feedback is supplementary, not replacement
- Moderation will be manual initially (auto-mod in Phase 4)
- Following system can be deferred if time-constrained
- Focus on quality over quantity (curated feed > spam)
