import { createBlaxelProvider } from "@vibe-kit/blaxel";
import { AuthManager } from "../src/auth";
import dotenv from "dotenv";

dotenv.config();

/**
 * Basic Blaxel Sandbox Example
 * 
 * This example demonstrates:
 * - Creating a Blaxel sandbox
 * - Running basic commands
 * - Cleaning up resources
 */
async function basicSandboxExample() {
  console.log("📦 Basic Blaxel Sandbox Example");
  console.log("=".repeat(50));

  try {
    // Check authentication
    console.log("🔐 Checking authentication...");
    const authSummary = await AuthManager.getAuthSummary();
    console.log(authSummary);
    console.log("");

    // Create Blaxel provider (uses CLI auth by default)
    console.log("🏗️ Creating Blaxel provider...");
    const provider = createBlaxelProvider({
      apiKey: process.env.BL_API_KEY,
      workspace: process.env.BL_WORKSPACE,
    });

    // Create a sandbox with environment variables
    console.log("🚀 Creating sandbox...");
    const sandbox = await provider.create(
      { 
        NODE_ENV: "development",
        EXAMPLE_VAR: "Hello from Blaxel!"
      },
      "claude",
      "/workspace"
    );

    console.log(`✅ Sandbox created: ${sandbox.sandboxId}`);
    console.log("");

    // Run basic commands
    console.log("💻 Running basic commands...");

    const commands = [
      "pwd",
      "ls -la",
      "echo $NODE_ENV",
      "echo $EXAMPLE_VAR", 
      "uname -a",
      "node --version",
      "npm --version"
    ];

    for (const cmd of commands) {
      console.log(`  $ ${cmd}`);
      try {
        const result = await sandbox.commands.run(cmd);
        if (result.stdout) {
          console.log(`    📄 ${result.stdout.trim()}`);
        }
        if (result.stderr) {
          console.log(`    🚫 ${result.stderr.trim()}`);
        }
      } catch (error) {
        console.log(`    ❌ Error: ${error}`);
      }
    }

    console.log("");

    // Test file operations
    console.log("📁 Testing file operations...");
    
    const fileCommands = [
      "echo 'Hello from Blaxel sandbox!' > /tmp/test.txt",
      "cat /tmp/test.txt",
      "ls -la /tmp/test.txt",
      "rm /tmp/test.txt"
    ];

    for (const cmd of fileCommands) {
      console.log(`  $ ${cmd}`);
      const result = await sandbox.commands.run(cmd);
      if (result.stdout) {
        console.log(`    📄 ${result.stdout.trim()}`);
      }
    }

    console.log("");

    // Get sandbox host URL
    console.log("🌐 Getting sandbox host URL...");
    try {
      const hostUrl = await sandbox.getHost(3000);
      console.log(`✅ Sandbox accessible at: ${hostUrl}`);
    } catch (error) {
      console.log(`⚠️ Could not get host URL: ${error}`);
    }

    console.log("");

    // Clean up
    console.log("🧹 Cleaning up sandbox...");
    await sandbox.kill();
    console.log("✅ Sandbox cleaned up");

    console.log("");
    console.log("🎉 Basic sandbox example completed successfully!");

  } catch (error) {
    console.error("❌ Example failed:", error);
    
    if (error instanceof Error && error.message.includes('authentication')) {
      console.log("\n💡 Authentication help:");
      console.log("   1. Run 'npm run auth' for OAuth authentication");
      console.log("   2. Or set CLAUDE_CODE_OAUTH_TOKEN environment variable");
      console.log("   3. Or set ANTHROPIC_API_KEY environment variable");
    }
    
    process.exit(1);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  basicSandboxExample();
}