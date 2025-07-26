# @vibe-kit/auth

Authentication utilities for VibeKit, providing OAuth integration with Claude and other AI providers.

## Features

- **OAuth Authentication**: Complete OAuth 2.0 flow with PKCE support
- **Token Management**: Automatic token refresh and secure storage
- **Web Integration**: Browser-compatible authentication for web applications
- **CLI Support**: Command-line authentication flow

## Installation

```bash
npm install @vibe-kit/auth
```

## Usage

### Basic Authentication

```typescript
import { ClaudeAuth } from '@vibe-kit/auth';

// Start OAuth flow
const token = await ClaudeAuth.authenticate();

// Check if authenticated
const isAuthenticated = await ClaudeAuth.isAuthenticated();

// Get valid token (auto-refresh if needed)
const accessToken = await ClaudeAuth.getValidToken();

// Verify authentication
const isValid = await ClaudeAuth.verify();

// Get authentication status
const status = await ClaudeAuth.getStatus();

// Logout
await ClaudeAuth.logout();
```

### Using with VibeKit SDK

The auth package is completely separate from the SDK. Get your token and pass it as the API key:

```typescript
import { VibeKit } from '@vibe-kit/sdk';
import { ClaudeAuth } from '@vibe-kit/auth';

// Authenticate and get token
const accessToken = await ClaudeAuth.getValidToken();
if (!accessToken) {
  await ClaudeAuth.authenticate();
  accessToken = await ClaudeAuth.getValidToken();
}

// Use token with VibeKit
const vibekit = new VibeKit();
const agent = await vibekit.withAgent("claude", {
  providerApiKey: accessToken, // Pass OAuth token as API key
  model: "claude-sonnet-4-20250514"
});

const result = await agent.generateCode("Create a hello world function");
```

### Web Applications

```typescript
import { ClaudeWebAuth, LocalStorageTokenStorage } from '@vibe-kit/auth';

// Create storage (localStorage, sessionStorage, or custom)
const storage = new LocalStorageTokenStorage();
const auth = new ClaudeWebAuth(storage);

// Generate authorization URL
const { url, state, codeVerifier } = ClaudeWebAuth.createAuthorizationUrl();

// Open URL in browser, user copies code
window.open(url, '_blank');

// After user pastes code
const userCode = 'auth-code#state-from-clipboard';
const token = await auth.authenticate(userCode, codeVerifier, state);
```

### Token Import/Export

```typescript
// Export token in different formats
const envToken = await ClaudeAuth.exportToken('env');
const jsonToken = await ClaudeAuth.exportToken('json');
const fullToken = await ClaudeAuth.exportToken('full');

// Import from various sources
await ClaudeAuth.importToken({ fromEnv: true });
await ClaudeAuth.importToken({ fromFile: './token.json' });
await ClaudeAuth.importToken({ refreshToken: 'your-refresh-token' });
```

## Types

```typescript
interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  created_at: number;
}
```

## Storage Options

- **MemoryTokenStorage**: In-memory storage for server-side use
- **LocalStorageTokenStorage**: Browser localStorage (client-side only)
- **CookieTokenStorage**: Cookie-based storage for SSR applications

## Security

- Tokens are stored with restricted file permissions (CLI)
- Automatic token refresh prevents expired token usage
- PKCE (Proof Key for Code Exchange) for secure OAuth flows
- State parameter validation prevents CSRF attacks

## Standalone CLI Usage

The auth package can be used independently for authentication:

```bash
# Install globally for CLI usage
npm install -g @vibe-kit/auth

# Or use the auth utilities programmatically in your code
import { authenticate, getValidToken } from '@vibe-kit/auth';
```

Note: CLI authentication commands have been moved out of the main VibeKit CLI to keep packages separate.