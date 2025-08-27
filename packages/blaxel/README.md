# @vibe-kit/blaxel

Blaxel sandbox provider for VibeKit - High-performance, cost-effective sandbox environments for AI agents.

## Installation

```bash
npm install @vibe-kit/blaxel
```

## Quick Start

```typescript
import { VibeKit } from "@vibe-kit/sdk";
import { createBlaxelProvider } from "@vibe-kit/blaxel";

// Create the Blaxel provider
const blaxelProvider = createBlaxelProvider({
  apiKey: process.env.BL_API_KEY,        // Optional if using Blaxel CLI auth
  workspace: process.env.BL_WORKSPACE,   // Optional if using Blaxel CLI auth
  defaultImage: "blaxel/prod-base:latest" // Optional, uses base image by default
});

// Create the VibeKit instance
const vibeKit = new VibeKit()
  .withAgent({
    type: "claude",
    provider: "anthropic", 
    apiKey: process.env.CLAUDE_API_KEY!,
    model: "claude-sonnet-4-20250514",
  })
  .withSandbox(blaxelProvider)
  .withWorkingDirectory("/workspace") // Optional: specify working directory
  .withSecrets({
    // Environment variables for the sandbox
    NODE_ENV: "development",
    API_URL: "https://api.example.com"
  });

// Generate code with your AI agent
const response = await vibeKit.generateCode("Create a React todo app with TypeScript");
console.log(response);
```

## Configuration

### BlaxelConfig Options

```typescript
interface BlaxelConfig {
  apiKey?: string;        // Blaxel API key (optional if using CLI auth)
  workspace?: string;     // Blaxel workspace ID (optional if using CLI auth)  
  defaultImage?: string;  // Default sandbox image (default: "blaxel/prod-base:latest")
}
```

### Authentication Methods

Blaxel supports multiple authentication methods (in order of priority):

1. **Configuration Object** (passed to `createBlaxelProvider`)
```typescript
const provider = createBlaxelProvider({
  apiKey: "your-api-key",
  workspace: "your-workspace"
});
```

2. **Environment Variables**
```bash
export BL_API_KEY="your-api-key"
export BL_WORKSPACE="your-workspace"
```

3. **Blaxel CLI Authentication** (Recommended for development)
```bash
# Install and login with Blaxel CLI
npm install -g @blaxel/cli
bl login
```

## Features

### 🚀 High Performance
- **Sub-20ms cold starts** - Nearly instantaneous sandbox creation
- **Lightweight VMs** - Optimized for AI agent workloads
- **Automatic scaling** - Handles concurrent sandbox requests efficiently

### 💰 Cost Optimization
- **Standby mode** - Sandboxes hibernate when idle (no charges)
- **Smart memory allocation** - Agent-specific memory sizing:
  - Claude: 8GB (complex reasoning tasks)
  - Codex: 4GB (code generation)
  - OpenCode: 4GB (open source code tasks)
  - Gemini: 6GB (multimodal tasks)
  - Grok: 4GB (conversational AI)

### 🛡️ Security
- **Isolated environments** - Each sandbox runs in complete isolation
- **Safe code execution** - Perfect for running untrusted AI-generated code
- **Network controls** - Configurable port access and networking

### 🔧 Developer Experience
- **Multiple auth methods** - API keys, environment variables, or CLI login
- **TypeScript support** - Full type safety and IntelliSense
- **Automatic cleanup** - Sandboxes auto-delete based on TTL settings
- **Port forwarding** - Access running applications via unique URLs

## Agent-Specific Configuration

The provider automatically optimizes sandbox configuration based on your agent type:

| Agent Type | Memory | Use Case | Image |
|------------|--------|----------|-------|
| `claude` | 8GB | Complex reasoning, large context | `blaxel/prod-base:latest` |
| `codex` | 4GB | Code generation and analysis | `blaxel/prod-base:latest` |
| `opencode` | 4GB | Open source development | `blaxel/prod-base:latest` |
| `gemini` | 6GB | Multimodal AI tasks | `blaxel/prod-base:latest` |
| `grok` | 4GB | Conversational AI | `blaxel/prod-base:latest` |

## Advanced Usage

### Custom Sandbox Configuration

```typescript
// You can customize the default behavior
const provider = createBlaxelProvider({
  apiKey: process.env.BL_API_KEY,
  workspace: process.env.BL_WORKSPACE,
  defaultImage: "your-custom-image:latest" // Use your own base image
});
```

### Working with Multiple Sandboxes

```typescript
// Each VibeKit instance gets its own isolated sandbox
const claudeKit = new VibeKit()
  .withAgent({ type: "claude", /* ... */ })
  .withSandbox(blaxelProvider);

const codexKit = new VibeKit()
  .withAgent({ type: "codex", /* ... */ })
  .withSandbox(blaxelProvider);

// They run independently in separate sandboxes
const [claudeResponse, codexResponse] = await Promise.all([
  claudeKit.generateCode("Create a Python web scraper"),
  codexKit.generateCode("Write a JavaScript sorting algorithm")
]);
```

### Sandbox Lifecycle Management

```typescript
// Get sandbox host URL for running applications  
const host = await vibeKit.getHost(3000); // Get URL for port 3000
console.log(`App running at: ${host}`);

// Clean up when done
await vibeKit.kill(); // Terminates and cleans up the sandbox
```

## Migration from E2B

If you're migrating from the E2B provider, the API is mostly compatible:

### Before (@vibe-kit/e2b)
```typescript
import { createE2BProvider } from "@vibe-kit/e2b";

const e2bProvider = createE2BProvider({
  apiKey: process.env.E2B_API_KEY!,
  templateId: "vibekit-claude"
});
```

### After (@vibe-kit/blaxel)
```typescript
import { createBlaxelProvider } from "@vibe-kit/blaxel";

const blaxelProvider = createBlaxelProvider({
  apiKey: process.env.BL_API_KEY,
  workspace: process.env.BL_WORKSPACE
});
```

### Key Differences

| Feature | E2B | Blaxel |
|---------|-----|--------|
| **Cold Start** | ~2-5 seconds | ~20ms |
| **Pricing** | Per-minute billing | Standby mode (free idle time) |
| **Timeout Limit** | Unlimited | 100 seconds max per command |
| **Authentication** | API key only | API key, workspace, or CLI |
| **Custom Images** | Template IDs | Standard Docker images |

## Limitations & Considerations

### Command Execution
- **Maximum timeout**: 100 seconds per command with `waitForCompletion`
- **Background processes**: Supported but limited monitoring capabilities
- **Long-running tasks**: Consider breaking into smaller chunks

### Networking
- **Reserved ports**: Avoid using ports 80, 443, and 8080 (used by Blaxel system)
- **Default ports**: 3000, 5000, 8000 are pre-configured for HTTP traffic
- **HTTPS**: All sandbox URLs use HTTPS by default

### Sandbox Management
- **Pause functionality**: Limited - uses sandbox stop instead of true pause
- **Persistent storage**: Sandboxes are ephemeral by default
- **TTL**: Sandboxes auto-delete after 1 hour of inactivity

## Environment Variables

```bash
# Blaxel Authentication
BL_API_KEY=your-api-key                    # Your Blaxel API key
BL_WORKSPACE=your-workspace-id             # Your Blaxel workspace

# Optional: Custom image overrides (for future use)
BLAXEL_IMAGE_CLAUDE=custom-claude:latest
BLAXEL_IMAGE_CODEX=custom-codex:latest
BLAXEL_IMAGE_OPENCODE=custom-opencode:latest
BLAXEL_IMAGE_GEMINI=custom-gemini:latest
BLAXEL_IMAGE_GROK=custom-grok:latest
```

## Requirements

- **Node.js**: 18+ 
- **Blaxel Account**: Sign up at [blaxel.ai](https://blaxel.ai)
- **API Access**: API key and workspace ID (or Blaxel CLI login)

## Troubleshooting

### Common Issues

**"Cannot find module '@blaxel/core'"**
- Ensure `@blaxel/core` is installed: `npm install @blaxel/core`

**"Authentication failed"** 
- Check your `BL_API_KEY` and `BL_WORKSPACE` environment variables
- Or use `bl login` with the Blaxel CLI

**"Timeout exceeded (100s)"**
- Break long-running commands into smaller steps
- Use background execution for non-blocking operations

**"Port already in use"**
- Use ports 3000, 5000, or 8000 (pre-configured)
- Avoid reserved ports 80, 443, 8080

### Getting Help

- 📖 [Blaxel Documentation](https://docs.blaxel.ai)
- 💬 [GitHub Discussions](https://github.com/superagent-ai/vibekit/discussions)
- 🐛 [Report Issues](https://github.com/superagent-ai/vibekit/issues)

## License

MIT License - see [LICENSE](../../LICENSE) file for details.

---

**Why Blaxel?**
Blaxel provides the fastest, most cost-effective sandbox environments specifically designed for AI agents. With sub-20ms cold starts and intelligent standby mode, your AI applications run faster and cost less than traditional sandbox providers.