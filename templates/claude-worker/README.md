# 🤖 Claude Worker Template

A Node.js/TypeScript template for working with Claude AI in Blaxel sandbox environments. This template demonstrates how to create, manage, and interact with Blaxel sandboxes using the VibeKit SDK with enhanced authentication support.

## ✨ Features

### 🔐 **Flexible Authentication**
- **OAuth Priority**: Automatically uses `CLAUDE_CODE_OAUTH_TOKEN` from ClaudeAuth
- **API Key Fallback**: Traditional `ANTHROPIC_API_KEY` support
- **GitHub CLI Integration**: Automatic `gh auth token` detection
- **Blaxel CLI Integration**: Seamless authentication via `bl login`

### 🏗️ **Sandbox Operations**
- Create and manage Blaxel sandboxes
- Execute shell commands in isolated environments
- Real-time command output and error handling
- Automatic cleanup and resource management

### 🐙 **GitHub Integration**
- Clone public and private repositories
- Work with repository files and structure
- Automatic dependency installation
- Project analysis and exploration

### 🤖 **AI-Powered Development**
- Generate complete projects with Claude
- Code analysis and optimization
- Interactive development workflows
- Real-time AI assistance

## 📋 Prerequisites

- **Node.js** 18+ 
- **TypeScript** (installed via dependencies)
- **Blaxel Account** with CLI access
- **Claude Authentication** (OAuth or API key)
- **GitHub Account** (optional, for private repos)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or copy the template
cd claude-worker
npm install
```

### 2. Authentication Setup

#### Option A: OAuth Authentication (Recommended)
```bash
# Authenticate with Claude OAuth
npm run auth

# Or use VibeKit CLI if available
vibekit auth claude
```

#### Option B: Environment Variables
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
# GITHUB_TOKEN (optional)
```

#### Option C: CLI Authentication
```bash
# Blaxel CLI
bl login

# GitHub CLI (optional)
gh auth login
```

### 3. Run the Template

```bash
# Run main workflow
npm start

# Run specific examples
npm run example:basic    # Basic sandbox connection
npm run example:github   # GitHub repository cloning
npm run example:claude   # Full development workflow

# Check authentication status
npm start -- --status
```

## 📖 Usage Examples

### Basic Sandbox Operations

```typescript
import { createBlaxelProvider } from "@vibe-kit/blaxel";
import { AuthManager } from "./src/auth";

// Get authentication
const claudeAuth = await AuthManager.getClaudeAuth();

// Create sandbox
const provider = createBlaxelProvider({});
const sandbox = await provider.create(
  { NODE_ENV: "development" },
  "claude",
  "/workspace"
);

// Run commands
const result = await sandbox.commands.run("echo 'Hello World!'");
console.log(result.stdout);

// Cleanup
await sandbox.kill();
```

### Full Development Workflow

```typescript
import { ClaudeWorker } from "./src/worker";

// Create worker with authentication
const worker = new ClaudeWorker(vibeKit);

// Run complete workflow
const result = await worker.runDevelopmentWorkflow({
  repository: "octocat/Hello-World",
  prompt: "Create a REST API with TypeScript",
  projectType: "express",
  port: 3000
});

console.log(`Preview: ${result.previewUrl}`);
```

## 🔧 Configuration

### Environment Variables

```bash
# Claude Authentication (Priority Order)
CLAUDE_CODE_OAUTH_TOKEN=    # OAuth token (highest priority)
ANTHROPIC_API_KEY=          # API key fallback

# GitHub Integration  
GITHUB_TOKEN=               # Personal access token
GITHUB_REPOSITORY=          # Target repository (owner/repo)

# Blaxel Configuration
BL_API_KEY=                 # API key (if not using CLI)
BL_WORKSPACE=               # Workspace ID (if not using CLI)

# Customization
CLAUDE_PROMPT=              # Default prompt for code generation
DEV_PORT=3000              # Default development server port
```

### Authentication Priority

1. **CLAUDE_CODE_OAUTH_TOKEN** - OAuth token from ClaudeAuth
2. **ANTHROPIC_API_KEY** - Traditional API key
3. **GitHub CLI** - Automatic `gh auth token` detection  
4. **Environment Variables** - Manual configuration

## 📁 Project Structure

```
claude-worker/
├── src/
│   ├── index.ts          # Main entry point
│   ├── auth.ts           # Authentication manager
│   ├── worker.ts         # Claude worker class
│   └── commands.ts       # Command execution utilities
├── examples/
│   ├── basic-sandbox.ts  # Basic sandbox example
│   ├── github-clone.ts   # GitHub integration example
│   └── claude-dev.ts     # Full development workflow
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment template
└── README.md             # This file
```

## 🎯 Examples in Detail

### 1. Basic Sandbox (`npm run example:basic`)

- Creates a Blaxel sandbox
- Tests basic command execution
- Demonstrates file operations
- Shows cleanup procedures

### 2. GitHub Integration (`npm run example:github`)

- Clones repositories (public/private)
- Explores project structure
- Installs dependencies automatically
- Uses Claude for code analysis

### 3. Full Development Workflow (`npm run example:claude`)

- Complete project generation with Claude
- Creates Express.js API with TypeScript
- Sets up development environment
- Starts preview server with live URLs

## 🛠️ API Reference

### AuthManager

```typescript
// Get Claude authentication with priority handling
const auth = await AuthManager.getClaudeAuth();

// Get GitHub token from CLI or environment
const githubToken = await AuthManager.getGitHubToken();

// Start OAuth authentication flow
const result = await AuthManager.authenticateOAuth();

// Check authentication status
const status = await AuthManager.checkAuthStatus();
```

### ClaudeWorker

```typescript
// Test sandbox connection
await worker.testConnection();

// Clone GitHub repository
await worker.cloneRepository("owner/repo");

// Generate code with Claude
const result = await worker.generateCode("Create a React app");

// Run full development workflow
const workflow = await worker.runDevelopmentWorkflow({
  repository: "owner/repo",
  prompt: "Add authentication",
  port: 3000
});
```

### CommandUtils

```typescript
// Execute single command
const result = await commands.execute("ls -la");

// Execute command sequence
const results = await commands.executeSequence([
  "npm install",
  "npm run build",
  "npm start"
]);

// Start development server
await commands.startDevServer("npm run dev", 3000);
```

## 🚨 Troubleshooting

### Authentication Issues

```bash
# Check authentication status
npm start -- --status

# Re-authenticate with OAuth
npm run auth

# Verify GitHub authentication
gh auth status
```

### Common Errors

**"No Claude authentication found"**
- Run `npm run auth` for OAuth setup
- Or set `CLAUDE_CODE_OAUTH_TOKEN`/`ANTHROPIC_API_KEY`

**"GitHub token not found"**  
- Run `gh auth login` for GitHub CLI
- Or set `GITHUB_TOKEN` environment variable

**"Sandbox creation failed"**
- Ensure Blaxel CLI is authenticated: `bl login`
- Check workspace permissions and quotas

**"Command execution timeout"**
- Commands have 100-second limit with `waitForCompletion`
- Use background execution for long-running processes

## 🌟 Advanced Usage

### Custom Sandbox Configuration

```typescript
const provider = createBlaxelProvider({
  apiKey: "custom-key",
  workspace: "custom-workspace",
  defaultImage: "custom-image:latest"
});
```

### Custom Project Generation

```typescript
await worker.createProject({
  name: "my-api",
  template: "express",
  workingDir: "/workspace/custom"
});
```

### Background Process Management

```typescript
// Start long-running process
await commands.execute("npm run dev", { 
  background: true,
  timeout: 0 
});

// Get preview URL
const url = await worker.getPreviewUrl(3000);
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all examples work
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

## 🆘 Support

- 📖 [VibeKit Documentation](https://docs.vibekit.sh)
- 📖 [Blaxel Documentation](https://docs.blaxel.ai)  
- 💬 [GitHub Discussions](https://github.com/superagent-ai/vibekit/discussions)
- 🐛 [Report Issues](https://github.com/superagent-ai/vibekit/issues)

---

**🎉 Happy coding with Claude and Blaxel!** 

This template provides a solid foundation for AI-powered development workflows in secure, isolated sandbox environments.