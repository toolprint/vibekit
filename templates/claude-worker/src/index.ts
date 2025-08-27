import { VibeKit } from "@vibe-kit/sdk";
import { createBlaxelProvider } from "@vibe-kit/blaxel";
import { ClaudeWorker } from "./worker";
import { AuthManager } from "./auth";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🚀 Starting Claude Worker...\n");

  try {
    // Show authentication status
    const authSummary = await AuthManager.getAuthSummary();
    console.log(authSummary + "\n");

    // Get Claude authentication
    const claudeAuth = await AuthManager.getClaudeAuth();
    
    // Get GitHub token (optional)
    const githubToken = await AuthManager.getGitHubToken();
    
    // Create Blaxel provider (uses CLI auth by default)
    const blaxelProvider = createBlaxelProvider({
      apiKey: process.env.BL_API_KEY,
      workspace: process.env.BL_WORKSPACE,
      defaultImage: "sandbox/blaxel-claude-worker:a7p9o5jq6gnt",
    });

    // Create VibeKit instance with appropriate authentication
    const vibeKit = new VibeKit()
      .withAgent({
        type: "claude",
        provider: "anthropic",
        apiKey: claudeAuth.type === 'apikey' ? claudeAuth.token : '',
        // For OAuth, we use authToken instead of apiKey
        ...(claudeAuth.type === 'oauth' && {
          oauthToken: claudeAuth.token,
          apiKey: '' // Empty API key for OAuth
        }),
        model: "claude-sonnet-4-20250514",
      })
      .withSandbox(blaxelProvider);

    // Add GitHub integration if available
    if (githubToken) {
      vibeKit.withGithub({
        token: githubToken,
        repository: process.env.GITHUB_REPOSITORY || "toolprint/vibekit",
      });
      console.log(`📦 GitHub integration enabled for: ${process.env.GITHUB_REPOSITORY || "toolprint/vibekit"}`);
    }

    // Pass OAuth token to sandbox environment if available
    const sandboxSecrets: Record<string, string> = {};
    if (claudeAuth.type === 'oauth') {
      sandboxSecrets.CLAUDE_CODE_OAUTH_TOKEN = claudeAuth.token;
      console.log("🔐 OAuth token will be available in sandbox");
    }
    if (Object.keys(sandboxSecrets).length > 0) {
      vibeKit.withSecrets(sandboxSecrets);
    }

    // Create worker instance
    const worker = new ClaudeWorker(vibeKit);
    console.log("🤖 Claude Worker initialized\n");

    // Example workflow
    console.log("=".repeat(60));
    console.log("🧪 Running Example Workflow");
    console.log("=".repeat(60));

    // Test sandbox connection
    await worker.testConnection();
    console.log("");
    
    // Clone repository if GitHub is configured and repository is specified
    if (githubToken && process.env.GITHUB_REPOSITORY) {
      await worker.cloneRepository(process.env.GITHUB_REPOSITORY);
      console.log("");
    }
    
    // Set up development environment
    await worker.setupDevelopmentEnvironment();
    console.log("");
    
    // Generate code with Claude
    const prompt = process.env.CLAUDE_PROMPT || 
      "Create a simple Express.js API with TypeScript that has a health check endpoint at /health and returns JSON with status 'ok' and timestamp";
    
    console.log("🤖 Generating code with Claude...");
    const result = await worker.generateCode(prompt);
    console.log("✅ Code generation complete");
    console.log("");
    
    // Try to get preview URL if a server might be running
    try {
      const previewUrl = await worker.getPreviewUrl(3000);
      console.log(`🌐 If you started a server, it should be available at: ${previewUrl}`);
    } catch (error) {
      console.log("ℹ️ No server detected on port 3000");
    }

    console.log("");
    console.log("=".repeat(60));
    console.log("✅ Claude Worker workflow completed!");
    console.log("=".repeat(60));
    
    // Clean up
    await worker.cleanup();

  } catch (error) {
    console.error("❌ Claude Worker failed:", error);
    process.exit(1);
  }
}

// Handle authentication command
if (process.argv.includes('--auth')) {
  console.log("🔐 Claude Worker Authentication");
  console.log("=".repeat(50));
  
  AuthManager.authenticateOAuth()
    .then((result) => {
      console.log("✅ Authentication successful!");
      console.log(`🔑 Token type: ${result.type}`);
      console.log("🚀 You can now run 'npm start' to use Claude Worker");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Authentication failed:", error);
      console.log("\n💡 Alternative authentication methods:");
      console.log("   1. Set CLAUDE_CODE_OAUTH_TOKEN environment variable");
      console.log("   2. Set ANTHROPIC_API_KEY environment variable");
      process.exit(1);
    });
} else if (process.argv.includes('--status')) {
  // Check authentication status
  console.log("📊 Claude Worker Status");
  console.log("=".repeat(40));
  
  AuthManager.checkAuthStatus()
    .then(async (status) => {
      console.log("🔐 Authentication Status:");
      console.log(`   Claude:  ${status.claude ? '✅ Authenticated' : '❌ Not authenticated'}`);
      console.log(`   GitHub:  ${status.github ? '✅ Authenticated' : '⚠️ Not authenticated (optional)'}`);
      console.log(`   Blaxel:  ${status.blaxel ? '✅ Ready' : '❌ Not ready'}`);
      
      if (!status.claude) {
        console.log("\n💡 To authenticate with Claude:");
        console.log("   Run: npm run auth");
      }
      
      if (!status.github) {
        console.log("\n💡 To authenticate with GitHub (optional):");
        console.log("   Run: gh auth login");
        console.log("   Or set GITHUB_TOKEN environment variable");
      }
      
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Status check failed:", error);
      process.exit(1);
    });
} else {
  // Run main workflow
  main().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
}