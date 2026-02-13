# Clerk Authentication Setup Guide

## Overview
FitCheck uses Clerk for managed authentication, providing OAuth providers (Google, GitHub, etc.), email/password, magic links, and secure session management.

## Benefits
- ✅ OAuth providers out of the box
- ✅ Secure session management
- ✅ User management dashboard
- ✅ Better security than DIY JWT auth
- ✅ No password storage in your database

## Setup Steps

### 1. Create a Clerk Account
- Go to https://clerk.com/
- Sign up for a free account
- Create a new application

### 2. Get Your API Keys
From your Clerk dashboard:

1. Click on "API Keys" in the left sidebar
2. Copy your keys:
   - **Publishable Key** - starts with `pk_test_` (dev) or `pk_live_` (prod)
   - **Secret Key** - starts with `sk_test_` (dev) or `sk_live_` (prod)

### 3. Configure Backend Environment Variables
Add to `fitcheck-api/.env`:

```env
# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...your-secret-key-here
CLERK_WEBHOOK_SECRET=whsec_...your-webhook-secret-here
```

### 4. Configure Frontend Environment Variables
Add to `fitcheck-app/.env`:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...your-publishable-key-here
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### 5. Set Up Clerk Webhook
Webhooks sync Clerk users to your database automatically.

1. In Clerk dashboard, go to "Webhooks"
2. Click "Add Endpoint"
3. Endpoint URL: `https://your-api-domain.com/api/auth/clerk-webhook`
   - For local dev: Use ngrok or similar tunnel
4. Subscribe to events:
   - ✅ `user.created`
   - ✅ `user.updated`
5. Copy the "Signing Secret" (starts with `whsec_`)
6. Add it to backend `.env` as `CLERK_WEBHOOK_SECRET`

### 6. Configure Auth Providers
In Clerk dashboard, go to "User & Authentication" → "Email, Phone, Username":

**Recommended settings:**
- Email address: Required
- Password: Optional (enable for email/password auth)
- Username: Optional

Go to "Social Connections" to enable OAuth providers:
- Google
- GitHub
- Apple
- etc.

### 7. Test the Integration

**Backend:**
```bash
cd fitcheck-api
npm run dev
```

**Frontend:**
```bash
cd fitcheck-app
npx expo start
```

When you launch the app:
1. You should see Clerk's login screen
2. Sign up with email or OAuth
3. User should be automatically created in your database
4. You should be redirected to the onboarding screen

### 8. Verify Database Sync
Check your database after signing up:

```sql
SELECT id, email, name FROM users ORDER BY created_at DESC LIMIT 5;
```

You should see the new Clerk user with:
- `id`: Clerk user ID (not a UUID)
- `email`: User's email
- `name`: User's name from Clerk
- `password_hash`: NULL (Clerk manages passwords)

## Development Mode
FitCheck supports running without Clerk for development:

**If `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is:**
- Not set
- Contains "placeholder"
- Contains "your_clerk"
- Doesn't start with `pk_`

**Then:** App uses custom JWT auth (old login/register screens)

**Otherwise:** App uses Clerk auth

This allows you to develop without setting up Clerk immediately.

## Clerk User Flow

### Sign Up:
1. User signs up via Clerk (email/password or OAuth)
2. Clerk creates the user account
3. Clerk fires `user.created` webhook
4. Your backend receives webhook and creates user in database
5. User is redirected to onboarding

### Sign In:
1. User signs in via Clerk
2. Clerk returns session token
3. Frontend sends requests with Clerk token in `Authorization` header
4. Backend validates token with Clerk
5. Backend looks up user in database
6. If not found, syncs user from Clerk automatically

### Sign Out:
1. User clicks sign out
2. Frontend calls Clerk's `signOut()`
3. Clerk invalidates the session
4. User is redirected to login

## Migrating Existing Users
If you have existing users with password hashes in the database:

**Option 1: Manual Migration**
- Existing users continue to use JWT auth
- New users use Clerk
- Eventually sunset JWT auth

**Option 2: Clerk User Import**
- Export users from database
- Import into Clerk via API or dashboard
- Users will need to reset passwords

**Option 3: Hybrid Approach**
- Keep passwordHash optional
- Check if user has passwordHash on login
- If yes, use JWT; if no, use Clerk
- Gradually migrate users to Clerk

## Security Features

### Session Management
- Clerk handles session tokens
- Tokens auto-refresh
- Secure token storage in device secure store

### Multi-Factor Authentication
- Enable 2FA in Clerk dashboard
- SMS, authenticator app, or backup codes
- No code changes required

### User Banning
- Ban users from Clerk dashboard
- Sessions immediately invalidated
- API requests automatically rejected

## Troubleshooting

### "Invalid or expired token" errors
- Check `CLERK_SECRET_KEY` is set correctly in backend `.env`
- Verify backend can reach Clerk API (check firewall)
- Make sure token hasn't expired (check Clerk dashboard)

### Webhook not firing
- Verify endpoint URL is publicly accessible
- Use ngrok for local development: `ngrok http 3000`
- Check webhook logs in Clerk dashboard
- Verify `CLERK_WEBHOOK_SECRET` matches dashboard

### User not created in database
- Check backend logs for webhook errors
- Verify database connection
- Check Prisma schema is up to date: `npm run db:push`

### App still showing old login screen
- Verify `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set
- Restart Expo dev server
- Clear app cache: `npx expo start -c`

## Production Checklist

- [ ] Switch to production Clerk keys (`pk_live_`, `sk_live_`)
- [ ] Update webhook endpoint to production URL
- [ ] Enable MFA for admin accounts
- [ ] Configure session timeout
- [ ] Set up email templates in Clerk
- [ ] Enable branding customization
- [ ] Test OAuth flows on real devices
- [ ] Monitor webhook delivery in Clerk dashboard

## Cost
- **Free tier**: 10,000 monthly active users
- **Pro tier**: $25/month for 1,000 MAU, then $0.02/MAU
- Significantly cheaper than building auth yourself!

## Resources
- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Expo Quickstart](https://clerk.com/docs/quickstarts/expo)
- [Clerk React Native SDK](https://clerk.com/docs/references/react-native/overview)
- [Webhooks Reference](https://clerk.com/docs/integrations/webhooks)
