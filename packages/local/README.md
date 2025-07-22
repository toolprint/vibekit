# @vibekit/local

Local sandbox provider for VibeKit using [Dagger](https://dagger.io/).

## Overview

The `@vibekit/local` package enables VibeKit to run AI coding agents in isolated, containerized environments on your local machine. This provides a **fully compatible alternative** to cloud-based sandboxes (E2B, Northflank, Daytona), offering faster iteration, offline development, and cost savings.

**🔄 Drop-in Replacement**: Our local provider implements the exact same interfaces as cloud providers, making it completely swappable in any VibeKit application.

## Key Features

- ✅ **Perfect Interface Compatibility**: Same APIs as E2B, Northflank, and Daytona
- ✅ **Complete Git Workflow Support**: Clone, branch, commit, push, and create Pull Requests  
- ✅ **Agent-Specific Docker Images**: Pre-built containers with Claude, Codex, OpenCode, and Gemini tools
- ✅ **Persistent Workspace State**: Filesystem changes persist across command executions
- ✅ **GitHub Integration**: Full authentication and PR creation via GitHub API
- ✅ **Dockerfile-Based Builds**: Dynamic container creation from agent-specific Dockerfiles
- ✅ **Shell Command Support**: Complete shell functionality including pipes and redirects

## System Requirements

### Required Dependencies
- **Docker**: Container runtime for isolation  
- **Dagger**: Container orchestration engine (auto-installed)
- **Node.js 18+**: Runtime environment

### Supported Platforms
- macOS (recommended for Apple Silicon support)
- Linux
- Windows (WSL2)

### Minimum System Resources
- 8GB RAM (16GB recommended for multiple environments)
- 10GB free disk space
- Modern CPU with virtualization support

## Installation

The local provider is automatically available when you install VibeKit:

```bash
npm install @vibekit/local
```

## Usage

### Drop-in Replacement Example

Replace any cloud provider with the local provider:

```typescript
import { VibeKit } from "@vibekit/sdk";
import { createLocalProvider } from "@vibekit/local";

// Create the local provider (replaces E2B/Northflank/Daytona)
const localProvider = createLocalProvider({
  githubToken: process.env.GITHUB_TOKEN, // for git operations
});

// Use exactly like any other provider
const vibeKit = new VibeKit()
  .withAgent({
    type: "claude",
    provider: "anthropic",
    apiKey: process.env.CLAUDE_API_KEY!,
    model: "claude-3-5-sonnet-20241022",
  })
  .withSandbox(localProvider) // 🔄 Perfectly swappable!
  .withWorkingDirectory("/vibe0") // Standard working directory
  .withSecrets({
    NODE_ENV: "development",
  });

// Generate code with full git workflow
const response = await vibeKit.generateCode("Create a simple React component");
console.log(response);
```

### Complete Git Workflow

The local provider supports the entire git workflow:

```typescript
const localProvider = createLocalProvider({
  githubToken: process.env.GITHUB_TOKEN // Required for private repos and push operations
});

const sandbox = await localProvider.create({}, 'claude', '/vibe0');

// Execute complete workflow: clone → modify → commit → push → PR
const workflowResult = await sandbox.executeWorkflow(
  {
    repoUrl: 'https://github.com/your-org/your-repo',
    branch: 'main',
    commitMessage: 'AI-generated improvements'
  },
  'npm run build && npm test', // Agent command
  {
    title: 'AI Code Generation',
    body: 'This PR contains AI-generated code improvements',
    headBranch: `feature/ai-${Date.now()}`,
    baseBranch: 'main'
  }
);

console.log(`PR created: ${workflowResult.prUrl}`);
```

### Agent Type Support

All VibeKit agent types are supported with pre-configured Docker images:

```typescript
// Each agent type gets its own optimized container
const claudeProvider = createLocalProvider({}).create({}, 'claude');    // Dockerfile.claude
const codexProvider = createLocalProvider({}).create({}, 'codex');      // Dockerfile.codex  
const opencodeProvider = createLocalProvider({}).create({}, 'opencode'); // Dockerfile.opencode
const geminiProvider = createLocalProvider({}).create({}, 'gemini');     // Dockerfile.gemini
```

## Configuration

### Local Provider Config

```typescript
interface LocalDaggerConfig {
  githubToken?: string; // GitHub Personal Access Token for authenticated git operations
}

const provider = createLocalProvider({
  githubToken: process.env.GITHUB_TOKEN // Enables private repo access and push operations
});
```

### Environment Variables

Set up your environment:

```bash
# Required for private repositories and push operations
export GITHUB_TOKEN="ghp_your_github_personal_access_token"

# Optional: Agent-specific API keys (if needed by your agents)
export CLAUDE_API_KEY="your_claude_key"
export OPENAI_API_KEY="your_openai_key"
```

## Architecture

The local provider is built on **Dagger**, providing:

- **Container Orchestration**: Dagger manages Docker containers with full lifecycle control
- **Dockerfile Integration**: Builds agent-specific containers from `assets/dockerfiles/`
- **Workspace Persistence**: Maintains filesystem state across command executions using Dagger's Directory API
- **Git Integration**: Complete git workflow with authentication via GitHub tokens
- **Shell Execution**: Full shell support with pipes, redirects, and complex commands

## Compatibility

### Interface Parity

Our local provider implements **identical interfaces** to cloud providers:

| Feature | E2B | Northflank | Daytona | Local (Dagger) |
|---------|-----|------------|---------|------------------|
| `SandboxProvider` interface | ✅ | ✅ | ✅ | ✅ |
| `SandboxInstance` interface | ✅ | ✅ | ✅ | ✅ |  
| `commands.run()` method | ✅ | ✅ | ✅ | ✅ |
| Background execution | ✅ | ✅ | ✅ | ✅ |
| Working directory support | ✅ | ✅ | ✅ | ✅ |
| Environment variables | ✅ | ✅ | ✅ | ✅ |
| Agent type auto-selection | ✅ | ✅ | ✅ | ✅ |
| Factory function pattern | ✅ | ✅ | ✅ | ✅ |

### Migration Guide

**Switching from any cloud provider to local is a one-line change:**

```typescript
// Before (E2B)
import { createE2BProvider } from "@vibe-kit/e2b";
const provider = createE2BProvider({ apiKey: "..." });

// After (Local)  
import { createLocalProvider } from "@vibe-kit/local";
const provider = createLocalProvider({ githubToken: "..." });

// Everything else stays exactly the same! 🎉
```

## Security Considerations

Local sandboxes run in isolated Docker containers:

- **File System Isolation**: Containers cannot access host files outside `/vibe0` workspace
- **Network Isolation**: Containers run in isolated Docker networks  
- **Process Isolation**: Complete process isolation from host system
- **Resource Limits**: Configurable CPU and memory limits via Docker
- **Secret Management**: GitHub tokens passed securely via environment variables

## Troubleshooting

### Common Issues

**Docker not running:**
```bash
# Check Docker status
docker ps

# Start Docker Desktop (macOS/Windows) or daemon (Linux)
```

**Dagger installation:**
```bash
# Dagger is auto-installed, but you can install manually:
# macOS
brew install dagger/tap/dagger

# Linux
curl -L https://dl.dagger.io/dagger/install.sh | bash

# Windows
powershell -c "irm https://dl.dagger.io/dagger/install.ps1 | iex"
```

**GitHub authentication errors:**
```bash
# Verify your token has proper permissions:
# - repo (for private repos)  
# - public_repo (for public repos)
# - workflow (if using GitHub Actions)

curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

### Debug Mode

Enable verbose logging:

```bash
export DAGGER_LOG_LEVEL=debug
export VIBEKIT_LOG_LEVEL=debug
```

## Performance Benefits

**Local vs Cloud Comparison:**

| Metric | E2B/Northflank/Daytona | Local (Dagger) |
|--------|-------------------------|------------------|
| Cold start time | 10-30 seconds | 2-5 seconds |
| Network latency | 50-200ms | ~0ms |
| Cost per hour | $0.10-$1.00 | $0.00 |
| Offline support | ❌ | ✅ |
| Custom images | Limited | Full control |

## Contributing

See the main [VibeKit contribution guide](../../CONTRIBUTING.md).

### Local Development

```bash
# Clone and setup
git clone https://github.com/vibekit/vibekit.git
cd vibekit/packages/local

# Install dependencies  
npm install

# Build the package
npm run build

# Run tests
npm test
```

## License

MIT - see [LICENSE](../../LICENSE) for details. 