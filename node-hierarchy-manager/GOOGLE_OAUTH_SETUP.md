# Google OAuth Configuration Guide

This document provides step-by-step instructions for configuring Google OAuth authentication in Supabase.

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. Access to your Supabase project dashboard
3. Your Supabase project URL: `https://ryeoceystuqrdynbtsvt.supabase.co`

## Step 1: Create OAuth Credentials in Google Cloud

1. **Navigate to Google Cloud Console**:
   - Go to https://console.cloud.google.com
   - Select or create a project

2. **Enable Google+ API** (if not already enabled):
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

3. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" for user type (or "Internal" if using Google Workspace)
   - Fill in required fields:
     - App name: "Antigravity" (or your preferred name)
     - User support email: Your email
     - Developer contact email: Your email
   - Click "Save and Continue"
   - Skip scopes (default scopes are sufficient)
   - Add test users if using External type
   - Click "Save and Continue"

4. **Create OAuth 2.0 Client ID**:
   - Go to "APIs & Services" > "Credentials"
   - Click "+ CREATE CREDENTIALS" > "OAuth client ID"
   - Select "Web application" as the application type
   - Name: "Antigravity Supabase Auth"
   - **Authorized JavaScript origins**: Leave empty or add your production domain
   - **Authorized redirect URIs**: Add the following:
     ```
     https://ryeoceystuqrdynbtsvt.supabase.co/auth/v1/callback
     ```
     For local development, also add:
     ```
     http://localhost:5173/auth/v1/callback
     http://localhost:3000/auth/v1/callback
     ```
   - Click "Create"
   - **Save the Client ID and Client Secret** - you'll need these in the next step

## Step 2: Configure Google Provider in Supabase

1. **Navigate to Supabase Auth Settings**:
   - Go to https://supabase.com/dashboard/project/ryeoceystuqrdynbtsvt/auth/providers
   - Find "Google" in the list of providers

2. **Enable Google Provider**:
   - Toggle "Enable Sign in with Google" to ON

3. **Enter Google OAuth Credentials**:
   - **Client ID**: Paste the Client ID from Google Cloud Console
   - **Client Secret**: Paste the Client Secret from Google Cloud Console

4. **Configure Additional Settings** (optional):
   - **Skip nonce check**: Leave unchecked (recommended for security)
   - **Allowed redirect URLs**: Your application URL will be automatically configured

5. **Save Changes**:
   - Click "Save" to apply the configuration

## Step 3: Test the Integration

1. **Start your local development server**:
   ```bash
   cd node-hierarchy-manager
   npm run dev
   ```

2. **Navigate to the login screen**:
   - Open http://localhost:5173 (or your configured port)

3. **Test Google sign-in**:
   - Click "Sign in with Google"
   - Select a Google account
   - Grant permissions when prompted
   - You should be redirected back to the application

4. **Verify approval flow**:
   - New OAuth users should see a message: "Your account is pending admin approval"
   - Admin users can approve the new user via the Admin panel
   - After approval, the user should be able to sign in successfully

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
- **Cause**: The redirect URI in your Google OAuth configuration doesn't match the one Supabase is using
- **Solution**: Verify that `https://ryeoceystuqrdynbtsvt.supabase.co/auth/v1/callback` is added to the Authorized redirect URIs in Google Cloud Console

### "OAuth provider not configured"
- **Cause**: The Google provider is not enabled or credentials are missing in Supabase
- **Solution**: Double-check that you've saved the Client ID and Client Secret in Supabase Auth settings

### User stuck on "pending approval"
- **Cause**: The user doesn't have an approved entry in the `user_roles` table
- **Solution**: 
  1. Sign in as an admin user
  2. Click the "Admin" button
  3. Find the new user and click "Approve"

### OAuth sign-in works but email/password doesn't (or vice versa)
- **Cause**: These are separate authentication methods
- **Solution**: This is expected behavior. Users can use either method, but they create separate credentials

## Security Considerations

1. **Client Secret**: Never commit your Google Client Secret to version control
2. **Redirect URIs**: Only add trusted domains to the authorized redirect URIs
3. **User Approval**: The existing user approval workflow ensures that only authorized users can access the system, regardless of authentication method
4. **Email Verification**: Google OAuth users have their email automatically verified by Google

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com)
