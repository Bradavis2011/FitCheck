# S3 Image Storage Setup Guide

## Overview
Images are now stored in AWS S3 instead of PostgreSQL to prevent database bloat and improve performance. This is **required for production** use.

## What Changed
- **Before**: Images stored as base64 text in PostgreSQL (causes DB bloat)
- **After**: Images uploaded to S3, only URLs stored in database

## Setup Steps

### 1. Create an AWS Account
- Go to https://aws.amazon.com/
- Sign up for a free account (includes 5GB S3 storage free for 12 months)

### 2. Create an S3 Bucket
1. Navigate to S3 in the AWS Console
2. Click "Create bucket"
3. Bucket name: `fitcheck-images` (or your preferred name)
4. Region: `us-east-1` (or your preferred region)
5. **Block Public Access settings**:
   - Uncheck "Block all public access"
   - Acknowledge the warning (we need public read for image URLs)
6. Click "Create bucket"

### 3. Configure Bucket Policy for Public Read
1. Go to your bucket → Permissions tab
2. Scroll to "Bucket policy"
3. Click "Edit" and paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::fitcheck-images/*"
    }
  ]
}
```
*(Replace `fitcheck-images` with your bucket name)*

4. Save changes

### 4. Create an IAM User
1. Navigate to IAM in the AWS Console
2. Click "Users" → "Create user"
3. Username: `fitcheck-s3-uploader`
4. Click "Next"
5. Select "Attach policies directly"
6. Search for and select: `AmazonS3FullAccess`
7. Click "Next" → "Create user"

### 5. Generate Access Keys
1. Click on your new user
2. Go to "Security credentials" tab
3. Scroll to "Access keys" → Click "Create access key"
4. Select "Application running outside AWS"
5. Click "Next" → "Create access key"
6. **IMPORTANT**: Copy both:
   - Access key ID (starts with `AKIA...`)
   - Secret access key (only shown once!)

### 6. Update Environment Variables
Add these to your `fitcheck-api/.env` file:

```env
AWS_ACCESS_KEY_ID=AKIA...your-key-here
AWS_SECRET_ACCESS_KEY=...your-secret-here
AWS_S3_BUCKET=fitcheck-images
AWS_REGION=us-east-1
```

### 7. Verify Setup
1. Restart your API server
2. Submit a new outfit check
3. Check your S3 bucket - you should see files at:
   - `outfits/{userId}/{outfitId}/original.jpg`
   - `outfits/{userId}/{outfitId}/thumbnail.jpg`
4. Check the database - the `image_url` and `thumbnail_url` columns should contain S3 URLs
5. The app should display images from S3

## Fallback Behavior
- **If S3 is not configured**: Images fall back to database storage (base64)
- **Old outfits**: Continue to display from database via fallback chain
- **New outfits**: Stored in S3 if configured, database if not

## Migration (Optional)
To migrate existing base64 images to S3, you can create a migration script that:
1. Reads all outfits with `imageData` but no `imageUrl`
2. Decodes base64 to buffer
3. Uploads to S3 using the same key structure
4. Updates the record with S3 URLs
5. Optionally nulls out the base64 columns to free space

## Cost Estimate
- **Storage**: ~$0.023/GB/month
- **Requests**: ~$0.005 per 1,000 PUT requests
- **Transfer**: First 100GB/month free

Example: 1,000 outfits (average 500KB each) = ~500MB storage = **~$0.01/month**

## Troubleshooting

### Images not uploading to S3
- Check AWS credentials in `.env`
- Verify IAM user has S3 permissions
- Check bucket name and region match `.env`

### Images not displaying
- Verify bucket policy allows public read
- Check browser console for CORS errors
- Confirm S3 URLs are valid (visit in browser)

### Old outfits not showing
- This is expected if S3 wasn't configured when created
- They use database fallback (base64)
- Can be migrated to S3 if desired

## Security Notes
- **Never commit `.env` to git** - it contains secret keys
- S3 bucket allows public read (required for image display)
- S3 bucket denies public write (only API can upload)
- Consider adding CORS rules if serving from different domain
