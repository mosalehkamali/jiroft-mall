import { NextResponse } from 'next/server';
import { siteUrl } from '@/lib/safeRedirect';
import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

// GET /api/auth/google — sends the visitor to Google's consent screen.
export async function GET(request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(siteUrl('/login-register?error=oauth_unavailable', request));
  }
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
  );
  // `state` ties Google's answer to this browser (OAuth login-CSRF protection)
  const state = randomBytes(24).toString('base64url');
  const response = NextResponse.redirect(
    client.generateAuthUrl({
      scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      prompt: 'select_account',
      state,
    }),
  );
  // Lax, not Strict: it has to come back with Google's top-level redirect
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/auth/google',
  });
  return response;
}
