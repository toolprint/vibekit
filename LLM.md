# VibeKit SDK API Documentation

## Overview
VibeKit is a TypeScript SDK for running AI coding agents (Claude, Codex, Gemini, OpenCode) in secure sandboxes with GitHub integration.

**Core Package**: `@vibe-kit/vibekit`  
**Version**: 0.0.43  
**Main Entry**: `dist/index.js`

**Sandbox Providers**:
- `@vibe-kit/e2b` - E2B cloud execution environment
- `@vibe-kit/daytona` - Daytona development platform  
- `@vibe-kit/northflank` - Northflank container platform

## Installation
```bash
# Core VibeKit package
npm install @vibe-kit/vibekit

# Sandbox providers (choose one or more)
npm install @vibe-kit/e2b        # E2B sandbox provider
npm install @vibe-kit/daytona    # Daytona sandbox provider  
npm install @vibe-kit/northflank # Northflank sandbox provider
```

## Quick Start
```typescript
import { VibeKit } from '@vibe-kit/vibekit';
import { createE2BProvider } from '@vibe-kit/e2b';

// Create sandbox provider
const e2bProvider = createE2BProvider({
  apiKey: 'your-e2b-key',
  templateId: 'vibekit-codex'  // or vibekit-claude, vibekit-gemini, etc.
});

// Create VibeKit instance with builder pattern
const vibekit = new VibeKit()
  .withAgent({
    type: 'codex',
    provider: 'openai',
    apiKey: 'your-openai-key',
    model: 'codex-mini-latest'
  })
  .withSandbox(e2bProvider)
  .withGithub({
    token: 'your-github-token',
    repository: 'owner/repo'
  });

// Set up event listeners
vibekit.on('update', (message) => {
  console.log('Update:', message);
});

vibekit.on('error', (error) => {
  console.error('Error:', error);
});

// Generate code
const result = await vibekit.generateCode(
  'Add error handling to login function',
  'code'  // mode: 'code' or 'ask'
);

// Clean up
await vibekit.kill();
```









## Usage Examples

### Basic Code Generation
```typescript
import { VibeKit } from '@vibe-kit/vibekit';
import { createE2BProvider } from '@vibe-kit/e2b';

// Create sandbox provider
const e2bProvider = createE2BProvider({
  apiKey: process.env.E2B_API_KEY,
  templateId: 'vibekit-claude'
});

// Create VibeKit instance
const vibekit = new VibeKit()
  .withAgent({
    type: 'claude',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514'
  })
  .withSandbox(e2bProvider)
  .withGithub({
    token: process.env.GITHUB_TOKEN,
    repository: 'owner/repo'
  })
  .withWorkingDirectory('/var/vibe0');

// Set up event listeners
vibekit.on('update', (msg) => console.log('Progress:', msg));
vibekit.on('error', (err) => console.error('Error:', err));

// Generate code
const result = await vibekit.generateCode(
  'Add input validation to the user registration form',
  'code'  // mode: 'code' or 'ask'
);

if (result.exitCode === 0) {
  const pr = await vibekit.createPullRequest({
    name: 'enhancement',
    color: '0075ca',
    description: 'New feature or request'
  });
  console.log('PR created:', pr.html_url);
}

// Clean up
await vibekit.kill();
```

### Different Sandbox Providers
```typescript
import { VibeKit } from '@vibe-kit/vibekit';
import { createE2BProvider } from '@vibe-kit/e2b';
import { createDaytonaProvider } from '@vibe-kit/daytona';
import { createNorthflankProvider } from '@vibe-kit/northflank';

// Using E2B
const e2bProvider = createE2BProvider({
  apiKey: process.env.E2B_API_KEY,
  templateId: 'vibekit-codex'
});

// Using Daytona
const daytonaProvider = createDaytonaProvider({
  apiKey: process.env.DAYTONA_API_KEY,
  serverUrl: process.env.DAYTONA_SERVER_URL
});

// Using Northflank
const northflankProvider = createNorthflankProvider({
  apiKey: process.env.NORTHFLANK_API_KEY,
  projectId: process.env.NORTHFLANK_PROJECT_ID
});

// Create VibeKit with any provider
const vibekit = new VibeKit()
  .withAgent({
    type: 'codex',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'codex-mini-latest'
  })
  .withSandbox(e2bProvider) // or daytonaProvider, northflankProvider
  .withGithub({
    token: process.env.GITHUB_TOKEN,
    repository: 'owner/repo'
  });

const response = await vibekit.generateCode(
  'Refactor the authentication middleware',
  'code'
);

await vibekit.kill();
```

### Different Agent Types
```typescript
import { VibeKit } from '@vibe-kit/vibekit';
import { createE2BProvider } from '@vibe-kit/e2b';

const e2bProvider = createE2BProvider({
  apiKey: process.env.E2B_API_KEY,
  templateId: 'vibekit-claude'  // Use appropriate template for each agent
});

// Claude Agent
const claudeVibekit = new VibeKit()
  .withAgent({
    type: 'claude',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514'
  })
  .withSandbox(e2bProvider);

// Codex Agent
const codexVibekit = new VibeKit()
  .withAgent({
    type: 'codex',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'codex-mini-latest'
  })
  .withSandbox(e2bProvider);

// Gemini Agent
const geminiVibekit = new VibeKit()
  .withAgent({
    type: 'gemini',
    provider: 'google',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-pro'
  })
  .withSandbox(e2bProvider);

// OpenCode Agent
const opencodeVibekit = new VibeKit()
  .withAgent({
    type: 'opencode',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514'
  })
  .withSandbox(e2bProvider);

// Set up streaming
claudeVibekit.on('update', (message) => {
  console.log('Claude update:', message);
});

const result = await claudeVibekit.generateCode(
  'Add rate limiting to the authentication function',
  'code'
);

await claudeVibekit.kill();
```

### Sandbox Management
```typescript
import { VibeKit } from '@vibe-kit/vibekit';
import { createE2BProvider } from '@vibe-kit/e2b';

const e2bProvider = createE2BProvider({
  apiKey: process.env.E2B_API_KEY,
  templateId: 'vibekit-claude'
});

const vibekit = new VibeKit()
  .withAgent({
    type: 'claude',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514'
  })
  .withSandbox(e2bProvider)
  .withSecrets({ 
    MY_SECRET: 'secret-value',
    DATABASE_URL: 'postgres://...'
  });

// Set up command output streaming
vibekit.on('update', console.log);

// Execute custom commands
const cmdResult = await vibekit.executeCommand('npm test');

// Get sandbox host for port forwarding
const host = await vibekit.getHost(3000);
console.log('App running at:', host);

// Pause/resume for cost optimization
await vibekit.pause();
// ... later
await vibekit.resume();

// Clean up
await vibekit.kill();
```

## Supported Sandbox Runtimes

- **E2B**: Cloud-based code execution environment
- **Daytona**: Development environment platform
- **Northflank**: Container-based sandbox platform

## Error Handling

All methods return promises that may reject. Always wrap in try-catch:

```typescript
try {
  const result = await vibekit.generateCode('...', 'code');
  if (result.exitCode !== 0) {
    console.error('Command failed:', result.stderr);
  }
} catch (error) {
  console.error('SDK error:', error.message);
} finally {
  // Always clean up
  await vibekit.kill();
}
```

## Environment Variables

Common environment variables:
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Google API key
- `E2B_API_KEY` - E2B sandbox API key
- `DAYTONA_API_KEY` - Daytona API key
- `NORTHFLANK_API_KEY` - Northflank API key
- `GITHUB_TOKEN` - GitHub personal access token

## TypeScript Support

Fully typed with TypeScript definitions included. Import types:

```typescript
import type {
  VibeKit,
  AgentResponse,
  AgentType,
  ModelProvider
} from '@vibe-kit/vibekit';

import type {
  E2BConfig
} from '@vibe-kit/e2b';

import type {
  DaytonaConfig
} from '@vibe-kit/daytona';

import type {
  NorthflankConfig
} from '@vibe-kit/northflank';
```
