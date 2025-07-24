# Web OAuth Usage Guide

This guide explains how to implement OAuth authentication for Claude in web applications using VibeKit's web OAuth helpers.

## Overview

The web OAuth flow uses the same manual code input approach as the CLI, providing a consistent experience across platforms. Users visit Claude's OAuth page, copy the authentication code, and paste it into your application.

## Basic Implementation

### 1. Frontend - Generate OAuth URL and Show Instructions

```typescript
import { ClaudeWebAuth } from '@vibe-kit/sdk/auth/oauth-web';

// Generate OAuth parameters
const { url, state, codeVerifier } = ClaudeWebAuth.createAuthorizationUrl();

// Store these for later use
sessionStorage.setItem('oauth_state', state);
sessionStorage.setItem('oauth_code_verifier', codeVerifier);

// Show instructions to user
console.log('Visit this URL to authenticate:', url);
console.log('After authorizing, copy the authentication code and paste it below.');

// Open in new tab/window
window.open(url, '_blank');
```

### 2. Frontend - Handle Code Input

```html
<!-- Simple input form -->
<form id="auth-form">
  <p>1. Click <a href="#" id="auth-link" target="_blank">here</a> to open Claude authentication</p>
  <p>2. Click "Authorize" and copy the authentication code</p>
  <p>3. Paste the code below:</p>
  <input type="text" id="auth-code" placeholder="Paste authentication code here" />
  <button type="submit">Authenticate</button>
</form>

<script>
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const authCode = document.getElementById('auth-code').value;
  const state = sessionStorage.getItem('oauth_state');
  const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
  
  try {
    // Send to backend
    const response = await fetch('/api/auth/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authCode, state, codeVerifier })
    });
    
    if (response.ok) {
      window.location.href = '/dashboard';
    } else {
      alert('Authentication failed');
    }
  } catch (error) {
    console.error('Auth error:', error);
  }
});
</script>
```

### 3. Backend - Process Authentication

```typescript
import { ClaudeWebAuth, MemoryTokenStorage } from '@vibe-kit/sdk/auth/oauth-web';

// Express.js example
app.post('/api/auth/authenticate', async (req, res) => {
  const { authCode, state, codeVerifier } = req.body;
  
  // Create auth instance with session storage
  const storage = new MemoryTokenStorage(req.sessionID);
  const auth = new ClaudeWebAuth(storage);
  
  try {
    // Authenticate with the pasted code
    const token = await auth.authenticate(authCode, codeVerifier, state);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(400).json({ error: error.message });
  }
});
```

### 4. Using the Token in API Calls

```typescript
// Check authentication status
app.get('/api/auth/status', async (req, res) => {
  const storage = new MemoryTokenStorage(req.sessionID);
  const auth = new ClaudeWebAuth(storage);
  
  const isAuthenticated = await auth.isAuthenticated();
  const token = await auth.getToken();
  
  res.json({
    authenticated: isAuthenticated,
    hasRefreshToken: !!token?.refresh_token,
    expiresAt: token?.expires_in 
      ? new Date(token.created_at + token.expires_in * 1000)
      : null
  });
});

// Use token for Claude API calls
app.post('/api/claude/message', async (req, res) => {
  const storage = new MemoryTokenStorage(req.sessionID);
  const auth = new ClaudeWebAuth(storage);
  
  const accessToken = await auth.getValidToken();
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Use with Claude agent
  const agent = new ClaudeAgent({
    oauthToken: accessToken
  });
  
  const response = await agent.generateCode(req.body.prompt);
  res.json({ response });
});
```

## React Example

```tsx
import React, { useState } from 'react';
import { ClaudeWebAuth } from '@vibe-kit/sdk/auth/oauth-web';

function AuthComponent() {
  const [authUrl, setAuthUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  const startAuth = () => {
    const { url, state, codeVerifier } = ClaudeWebAuth.createAuthorizationUrl();
    
    // Store for later
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    
    setAuthUrl(url);
    window.open(url, '_blank');
  };
  
  const completeAuth = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authCode,
          state: sessionStorage.getItem('oauth_state'),
          codeVerifier: sessionStorage.getItem('oauth_code_verifier')
        })
      });
      
      if (response.ok) {
        window.location.href = '/dashboard';
      } else {
        alert('Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {!authUrl ? (
        <button onClick={startAuth}>Login with Claude</button>
      ) : (
        <div>
          <p>1. A new tab has opened with Claude authentication</p>
          <p>2. Click "Authorize" and copy the authentication code</p>
          <p>3. Paste it below:</p>
          <input
            type="text"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="Paste authentication code (format: code#state)"
          />
          <button onClick={completeAuth} disabled={loading || !authCode}>
            {loading ? 'Authenticating...' : 'Complete Authentication'}
          </button>
        </div>
      )}
    </div>
  );
}
```

## Storage Options

### 1. Server-Side Session Storage (Recommended)

```typescript
// Using express-session
import session from 'express-session';

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,  // HTTPS only
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days
  }
}));

// Custom session storage
class SessionTokenStorage implements TokenStorage {
  constructor(private session: any) {}
  
  async get(): Promise<OAuthToken | null> {
    return this.session.oauth_token || null;
  }
  
  async set(token: OAuthToken): Promise<void> {
    this.session.oauth_token = token;
  }
  
  async remove(): Promise<void> {
    delete this.session.oauth_token;
  }
}
```

### 2. Cookie Storage (SSR-friendly)

```typescript
import { CookieTokenStorage } from '@vibe-kit/sdk/auth/oauth-web';
import { parseCookies, setCookie, destroyCookie } from 'nookies';

// Next.js example
export async function getServerSideProps(context) {
  const cookies = parseCookies(context);
  
  const storage = new CookieTokenStorage(
    (name) => cookies[name],
    (name, value, options) => setCookie(context, name, value, options),
    (name) => destroyCookie(context, name)
  );
  
  const auth = new ClaudeWebAuth(storage);
  const isAuthenticated = await auth.isAuthenticated();
  
  return { props: { isAuthenticated } };
}
```

### 3. Browser LocalStorage (Client-side only)

```typescript
import { LocalStorageTokenStorage } from '@vibe-kit/sdk/auth/oauth-web';

// For SPAs
const storage = new LocalStorageTokenStorage();
const auth = new ClaudeWebAuth(storage);

// Note: Tokens in localStorage are accessible to JavaScript
// Only use for non-sensitive applications
```

## Vue.js Example

```vue
<template>
  <div>
    <div v-if="!authStarted">
      <button @click="startAuth">Login with Claude</button>
    </div>
    <div v-else>
      <p>1. A new tab has opened with Claude authentication</p>
      <p>2. Click "Authorize" and copy the authentication code</p>
      <p>3. Paste it below:</p>
      <input
        v-model="authCode"
        type="text"
        placeholder="Paste authentication code (format: code#state)"
      />
      <button @click="completeAuth" :disabled="loading || !authCode">
        {{ loading ? 'Authenticating...' : 'Complete Authentication' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ClaudeWebAuth } from '@vibe-kit/sdk/auth/oauth-web';

export default {
  data() {
    return {
      authStarted: false,
      authCode: '',
      loading: false
    };
  },
  methods: {
    startAuth() {
      const { url, state, codeVerifier } = ClaudeWebAuth.createAuthorizationUrl();
      
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_code_verifier', codeVerifier);
      
      this.authStarted = true;
      window.open(url, '_blank');
    },
    
    async completeAuth() {
      this.loading = true;
      
      try {
        const response = await fetch('/api/auth/authenticate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authCode: this.authCode,
            state: sessionStorage.getItem('oauth_state'),
            codeVerifier: sessionStorage.getItem('oauth_code_verifier')
          })
        });
        
        if (response.ok) {
          window.location.href = '/dashboard';
        } else {
          alert('Authentication failed');
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

## Security Considerations

1. **Always use HTTPS** in production for OAuth flows
2. **Validate state parameter** to prevent CSRF attacks
3. **Use PKCE** for additional security (already implemented)
4. **Store tokens securely**:
   - Server-side sessions (most secure)
   - HttpOnly cookies (good for SSR)
   - Avoid localStorage for sensitive applications
5. **Implement token rotation** - the library automatically refreshes tokens
6. **Set appropriate CORS headers** for your API endpoints

## Advanced Usage

### Custom Token Storage

```typescript
import { TokenStorage, OAuthToken } from '@vibe-kit/sdk/auth/oauth-web';
import Redis from 'ioredis';

class RedisTokenStorage implements TokenStorage {
  private redis: Redis;
  private prefix = 'oauth:token:';
  
  constructor(private userId: string) {
    this.redis = new Redis();
  }
  
  async get(): Promise<OAuthToken | null> {
    const data = await this.redis.get(this.prefix + this.userId);
    return data ? JSON.parse(data) : null;
  }
  
  async set(token: OAuthToken): Promise<void> {
    await this.redis.set(
      this.prefix + this.userId,
      JSON.stringify(token),
      'EX',
      30 * 24 * 60 * 60  // 30 days
    );
  }
  
  async remove(): Promise<void> {
    await this.redis.del(this.prefix + this.userId);
  }
}
```

### Handling Errors

```typescript
app.post('/api/auth/authenticate', async (req, res) => {
  try {
    // ... authenticate
  } catch (error) {
    if (error.message.includes('State mismatch')) {
      return res.status(400).json({ error: 'Security error: Invalid state' });
    }
    if (error.message.includes('Invalid authentication code format')) {
      return res.status(400).json({ 
        error: 'Invalid code format. Make sure to copy the entire code including the # symbol' 
      });
    }
    
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});
```

## API Reference

### ClaudeWebAuth

Static methods:
- `generatePKCE()`: Generate code verifier and challenge
- `generateState()`: Generate random state string
- `createAuthorizationUrl()`: Create OAuth URL with code=true parameter
- `exchangeCodeForToken(authCode, codeVerifier, expectedState)`: Exchange code for token
- `refreshAccessToken(refreshToken)`: Refresh an access token

Instance methods:
- `authenticate(authCode, codeVerifier, expectedState)`: Process authentication with pasted code
- `getToken()`: Get current token from storage
- `getValidToken()`: Get valid access token (auto-refresh)
- `isAuthenticated()`: Check authentication status
- `verify()`: Verify token with API call
- `logout()`: Clear stored token

### Token Storage Implementations

- `MemoryTokenStorage`: In-memory storage (server-side)
- `LocalStorageTokenStorage`: Browser localStorage
- `CookieTokenStorage`: Cookie-based storage
- `TokenStorage` interface: Implement your own

## Troubleshooting

1. **"State mismatch" error**: Ensure state is properly stored and matches
2. **"Invalid authentication code format" error**: Code must be in format `code#state`
3. **Token refresh failing**: Check if refresh token exists and hasn't expired
4. **CORS errors**: Configure proper CORS headers for your API endpoints