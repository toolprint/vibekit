import { VibeKit } from "@vibe-kit/sdk";
import { createBlaxelProvider } from "@vibe-kit/blaxel";
import { ClaudeWorker } from "../src/worker";
import { AuthManager } from "../src/auth";
import dotenv from "dotenv";

dotenv.config();

/**
 * GitHub Repository Cloning Example
 * 
 * This example demonstrates:
 * - Authenticating with GitHub
 * - Creating a sandbox with GitHub integration
 * - Cloning a repository
 * - Working with the cloned code
 */
async function githubCloneExample() {
  console.log("🐙 GitHub Repository Cloning Example");
  console.log("=".repeat(50));

  try {
    // Check authentication
    console.log("🔐 Checking authentication...");
    const authSummary = await AuthManager.getAuthSummary();
    console.log(authSummary);
    console.log("");

    // Get authentication tokens
    const claudeAuth = await AuthManager.getClaudeAuth();
    const githubToken = await AuthManager.getGitHubToken();

    if (!githubToken) {
      console.log("⚠️ No GitHub authentication found");
      console.log("💡 This example works best with GitHub authentication");
      console.log("   Run: gh auth login");
      console.log("   Or set GITHUB_TOKEN environment variable");
      console.log("   Continuing with public repository access only...");
      console.log("");
    }

    // Configuration
    const repository = process.env.GITHUB_REPOSITORY || "octocat/Hello-World";
    console.log(`📦 Target repository: ${repository}`);
    console.log("");

    // Create Blaxel provider
    const blaxelProvider = createBlaxelProvider({
      apiKey: process.env.BL_API_KEY,
      workspace: process.env.BL_WORKSPACE,
      defaultImage: "sandbox/blaxel-claude-worker:a7p9o5jq6gnt",
    });

    // Create VibeKit instance with GitHub integration
    const vibeKit = new VibeKit()
      .withAgent({
        type: "claude",
        provider: "anthropic",
        apiKey: claudeAuth.type === 'apikey' ? claudeAuth.token : '',
        ...(claudeAuth.type === 'oauth' && {
          oauthToken: claudeAuth.token,
          apiKey: ''
        }),
        model: "claude-sonnet-4-20250514",
      })
      .withSandbox(blaxelProvider);

    // Add GitHub integration if token is available
    if (githubToken) {
      vibeKit.withGithub({
        token: githubToken,
        repository: repository,
      });
      console.log("✅ GitHub integration enabled");
    }

    // Create worker
    const worker = new ClaudeWorker(vibeKit);

    // Test connection
    console.log("🔌 Testing sandbox connection...");
    await worker.testConnection();
    console.log("");

    // Clone the repository
    console.log(`📥 Cloning repository: ${repository}`);
    await worker.cloneRepository(repository);
    console.log("");

    // Explore the cloned repository
    const repoName = repository.split('/')[1];
    const repoPath = `/workspace/${repoName}`;

    console.log("🔍 Exploring cloned repository...");
    
    const exploreCommands = [
      `ls -la ${repoPath}`,
      `find ${repoPath} -type f -name "*.js" -o -name "*.ts" -o -name "*.json" -o -name "*.md" | head -10`,
      `wc -l ${repoPath}/README.md 2>/dev/null || echo "No README.md found"`,
    ];

    for (const cmd of exploreCommands) {
      console.log(`  $ ${cmd}`);
      const result = await worker.executeCommand(cmd);
      if (result.stdout) {
        console.log(`    📄 ${result.stdout}`);
      }
    }

    console.log("");

    // Read package.json if it exists (for Node.js projects)
    console.log("📋 Checking for Node.js project...");
    const packageJsonCheck = await worker.executeCommand(`cat ${repoPath}/package.json 2>/dev/null || echo "No package.json found"`);
    
    if (packageJsonCheck.stdout && !packageJsonCheck.stdout.includes("No package.json found")) {
      console.log("✅ Found Node.js project");
      console.log("📦 Installing dependencies...");
      
      const installResult = await worker.executeCommand(`cd ${repoPath} && npm install`);
      if (installResult.success) {
        console.log("✅ Dependencies installed successfully");
        
        // Check for common scripts
        const scriptsCheck = await worker.executeCommand(`cd ${repoPath} && npm run 2>&1 || true`);
        if (scriptsCheck.stdout) {
          console.log("📝 Available npm scripts:");
          console.log(`    ${scriptsCheck.stdout}`);
        }
      } else {
        console.log("⚠️ Failed to install dependencies");
      }
    } else {
      console.log("ℹ️ Not a Node.js project or no package.json found");
    }

    console.log("");

    // Use Claude to analyze the repository
    if (claudeAuth) {
      console.log("🤖 Using Claude to analyze the repository...");
      
      const analysisPrompt = `Analyze this cloned repository at ${repoPath}. Look at the file structure and main files to understand what this project does. Provide a brief summary.`;
      
      try {
        const analysis = await worker.generateCode(analysisPrompt, 'ask');
        console.log("🔍 Claude's analysis:");
        console.log(`    ${JSON.stringify(analysis, null, 2)}`);
      } catch (error) {
        console.log(`⚠️ Claude analysis failed: ${error}`);
      }
    }

    console.log("");

    // Clean up
    console.log("🧹 Cleaning up...");
    await worker.cleanup();

    console.log("");
    console.log("🎉 GitHub cloning example completed successfully!");

  } catch (error) {
    console.error("❌ Example failed:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('authentication')) {
        console.log("\n💡 Authentication help:");
        console.log("   Run 'npm run auth' for Claude OAuth authentication");
        console.log("   Run 'gh auth login' for GitHub authentication");
      } else if (error.message.includes('repository')) {
        console.log("\n💡 Repository help:");
        console.log("   Make sure the repository exists and is accessible");
        console.log("   For private repos, ensure GitHub authentication is set up");
      }
    }
    
    process.exit(1);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  githubCloneExample();
}