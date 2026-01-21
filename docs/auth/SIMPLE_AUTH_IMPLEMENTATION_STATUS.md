# Simple Authentication Implementation Status

## Overview
Migrated from complex session-based authentication to simple JWT-based authentication.

## Changes Made

### 1. Created Simple Auth Library (`lib/auth/simple-auth.ts`)
- `simpleLogin()` - Login with email/password, returns JWT token
- `verifyToken()` - Verify JWT token validity
- `getUserFromToken()` - Get user data from JWT token
- `simpleChangePassword()` - Change user password

### 2. Updated API Routes
- `/api/auth/login` - Sets `auth_token` cookie with JWT
- `/api/auth/logout` - Clears `auth_token` cookie
- `/api/auth/me` - Returns user info from JWT token
- `/api/auth/change-password` - Changes password

### 3. Updated Proxy (`proxy.ts`)
- Changed from session-based to JWT-based authentication
- Uses `auth_token` cookie instead of `session_token`
- Validates JWT tokens using `jsonwebtoken` library
- Skips authentication for `/api/auth/*` routes
- Redirects unauthenticated users to `/login?from=<current_path>`

### 4. Updated Pages
- `app/page.tsx` - Checks for `auth_token` and redirects accordingly
- `app/login/page.tsx` - Redirects to original page after login using `from` query param

## Cookie Names
- **OLD**: `session_token` (database session)
- **NEW**: `auth_token` (JWT token)

## Environment Variables
- `JWT_SECRET` - Secret key for signing JWT tokens (required in `.env.local`)

## Current Issue
Error: "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"

### Diagnosis
This error occurs when:
1. Frontend tries to parse HTML as JSON
2. Usually means a redirect to login page (HTML) instead of API response (JSON)

### Possible Causes
1. Proxy might be redirecting API calls incorrectly
2. `/api/auth/me` might not be properly excluded from proxy
3. Race condition between proxy and API route

### Next Steps
1. Verify proxy is correctly skipping `/api/auth/*` routes
2. Add more logging to proxy to debug
3. Test with browser DevTools Network tab to see actual responses
4. Consider adding `X-Requested-With: XMLHttpRequest` header to API calls

## Testing Checklist
- [ ] Login with valid credentials
- [ ] Login redirects to original page
- [ ] Logout clears cookie and redirects to login
- [ ] Unauthenticated users redirected to login
- [ ] Authenticated users can access protected routes
- [ ] `/api/auth/me` returns JSON (not HTML)
- [ ] Token expiration handled correctly
