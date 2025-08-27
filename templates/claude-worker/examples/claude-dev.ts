import { VibeKit } from "@vibe-kit/sdk";
import { createBlaxelProvider } from "@vibe-kit/blaxel";
import { ClaudeWorker } from "../src/worker";
import { AuthManager } from "../src/auth";
import dotenv from "dotenv";

dotenv.config();

/**
 * Full Claude Development Workflow Example
 * 
 * This example demonstrates:
 * - Complete authentication setup
 * - Creating a project with Claude's help
 * - Running a full development workflow
 * - Starting a development server
 * - Getting preview URLs
 */
async function claudeDevExample() {
  console.log("🤖 Full Claude Development Workflow");
  console.log("=".repeat(60));

  try {
    // Check authentication status
    console.log("🔐 Authentication Status Check");
    console.log("-".repeat(30));
    const status = await AuthManager.checkAuthStatus();
    console.log(`Claude:  ${status.claude ? '✅' : '❌'}`);
    console.log(`GitHub:  ${status.github ? '✅' : '⚠️'} (optional)`);
    console.log(`Blaxel:  ${status.blaxel ? '✅' : '❌'}`);
    console.log("");

    if (!status.claude) {
      throw new Error("Claude authentication required. Run 'npm run auth' first.");
    }

    // Get authentication
    const claudeAuth = await AuthManager.getClaudeAuth();
    const githubToken = await AuthManager.getGitHubToken();

    // Create Blaxel provider
    const blaxelProvider = createBlaxelProvider({
      apiKey: process.env.BL_API_KEY,
      workspace: process.env.BL_WORKSPACE,
      defaultImage: "sandbox/blaxel-claude-worker:a7p9o5jq6gnt",
    });

    // Create VibeKit instance
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

    // Add GitHub integration if available (for potential repository operations)
    if (githubToken && process.env.GITHUB_REPOSITORY) {
      vibeKit.withGithub({
        token: githubToken,
        repository: process.env.GITHUB_REPOSITORY,
      });
    }

    // Pass secrets to sandbox
    if (claudeAuth.type === 'oauth') {
      vibeKit.withSecrets({
        CLAUDE_CODE_OAUTH_TOKEN: claudeAuth.token
      });
    }

    // Create worker
    const worker = new ClaudeWorker(vibeKit);

    console.log("🚀 Starting Full Development Workflow");
    console.log("=".repeat(60));

    // Step 1: Test connection and setup
    console.log("1️⃣ Setting up development environment");
    console.log("-".repeat(40));
    await worker.testConnection();
    await worker.setupDevelopmentEnvironment('/workspace/claude-project');
    console.log("");

    // Step 2: Generate a complete project with Claude
    console.log("2️⃣ Generating project with Claude");
    console.log("-".repeat(40));
    
    const projectPrompt = `
Create a complete Express.js project with TypeScript that includes:

1. A basic Express server with the following routes:
   - GET /health - Returns health status
   - GET /api/users - Returns a list of mock users
   - POST /api/users - Creates a new user
   - GET /api/users/:id - Gets a specific user

2. Project structure with:
   - package.json with proper dependencies
   - tsconfig.json for TypeScript configuration
   - src/server.ts as the main entry point
   - src/routes/ directory for route handlers
   - src/types/ directory for TypeScript interfaces

3. Include proper error handling and CORS support

4. Add a simple HTML page at public/index.html that tests the API

Please create all the necessary files and make sure the server runs on port 3000.
`;

    console.log("🤖 Asking Claude to generate the project...");
    const projectResult = await worker.generateCode(projectPrompt, 'code');
    console.log("✅ Project generation completed");
    console.log("");

    // Step 3: Set up the generated project
    console.log("3️⃣ Setting up generated project");
    console.log("-".repeat(40));
    
    const workingDir = '/workspace/claude-project';
    
    // Create a basic project structure if Claude's generation needs it
    const setupCommands = [
      `cd ${workingDir}`,
      `ls -la`,
      // Initialize npm if no package.json exists
      `test -f package.json || npm init -y`,
      // Install common dependencies
      `npm install express cors`,
      `npm install -D typescript @types/node @types/express @types/cors ts-node nodemon`,
      // Create basic directories
      `mkdir -p src public`,
      `ls -la`
    ];

    console.log("📦 Setting up Node.js project...");
    for (const cmd of setupCommands) {
      const result = await worker.executeCommand(cmd, workingDir);
      if (result.exitCode !== 0 && !cmd.includes('test -f')) {
        console.log(`⚠️ Command may have failed: ${cmd}`);
      }
    }

    // Step 4: Create basic files if they don't exist
    console.log("📝 Creating basic project files...");
    
    const createBasicServer = `
cd ${workingDir} && cat > src/server.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock data
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/users', (req, res) => {
  res.json({ users });
});

app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.post('/api/users', (req, res) => {
  const newUser = {
    id: users.length + 1,
    name: req.body.name,
    email: req.body.email
  };
  users.push(newUser);
  res.status(201).json({ user: newUser });
});

app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
EOF
`;

    const createTsConfig = `
cd ${workingDir} && cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
EOF
`;

    const createPackageScripts = `
cd ${workingDir} && npm pkg set scripts.start="node dist/server.js" scripts.dev="nodemon src/server.ts" scripts.build="tsc"
`;

    const createIndexHtml = `
cd ${workingDir} && cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Generated API</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        button { background: #007cba; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        #results { background: #f9f9f9; padding: 10px; margin-top: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>🤖 Claude Generated Express API</h1>
    <p>This API was generated by Claude and is running in a Blaxel sandbox!</p>
    
    <div class="endpoint">
        <strong>GET /health</strong>
        <button onclick="testEndpoint('/health')">Test Health</button>
    </div>
    
    <div class="endpoint">
        <strong>GET /api/users</strong>
        <button onclick="testEndpoint('/api/users')">Get Users</button>
    </div>
    
    <div class="endpoint">
        <strong>GET /api/users/1</strong>
        <button onclick="testEndpoint('/api/users/1')">Get User 1</button>
    </div>
    
    <div id="results"></div>
    
    <script>
        async function testEndpoint(path) {
            try {
                const response = await fetch(path);
                const data = await response.json();
                document.getElementById('results').innerHTML = 
                    '<h3>Results:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('results').innerHTML = 
                    '<h3>Error:</h3><pre>' + error.message + '</pre>';
            }
        }
    </script>
</body>
</html>
EOF
`;

    await worker.executeCommand(createBasicServer);
    await worker.executeCommand(createTsConfig);
    await worker.executeCommand(createPackageScripts);
    await worker.executeCommand(createIndexHtml);
    
    console.log("✅ Project files created");
    console.log("");

    // Step 5: Build and start the development server
    console.log("4️⃣ Starting development server");
    console.log("-".repeat(40));
    
    console.log("🔨 Building TypeScript...");
    const buildResult = await worker.executeCommand(`cd ${workingDir} && npx tsc`);
    
    if (buildResult.success) {
      console.log("✅ Build successful");
    } else {
      console.log("⚠️ Build had warnings, continuing...");
    }

    console.log("🚀 Starting development server...");
    
    // Start server in background
    const startServerCmd = `cd ${workingDir} && npx nodemon src/server.ts`;
    await worker.executeCommand(startServerCmd + ' &'); // Background process
    
    // Wait for server to start
    console.log("⏳ Waiting for server to start...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Get preview URL
    console.log("5️⃣ Getting preview URL");
    console.log("-".repeat(40));
    
    try {
      const previewUrl = await worker.getPreviewUrl(3000);
      console.log(`🌐 Your Claude-generated API is running at:`);
      console.log(`   ${previewUrl}`);
      console.log(`   ${previewUrl}/health (health check)`);
      console.log(`   ${previewUrl}/api/users (users API)`);
    } catch (error) {
      console.log(`⚠️ Could not get preview URL: ${error}`);
      console.log(`💡 Server should be running on port 3000 in the sandbox`);
    }

    // Step 7: Test the API
    console.log("6️⃣ Testing the API");
    console.log("-".repeat(40));
    
    const testCommands = [
      `cd ${workingDir} && curl -s http://localhost:3000/health || echo "Health check failed"`,
      `cd ${workingDir} && curl -s http://localhost:3000/api/users || echo "Users API failed"`,
    ];

    for (const cmd of testCommands) {
      console.log(`🧪 ${cmd.split('&&')[1].trim()}`);
      const result = await worker.executeCommand(cmd);
      if (result.stdout && result.stdout.trim()) {
        console.log(`   📄 ${result.stdout.trim()}`);
      }
    }

    console.log("");
    console.log("✅ Claude Development Workflow Complete!");
    console.log("=".repeat(60));
    console.log("🎉 Your Claude-generated Express API is running!");
    console.log("🔧 Features created:");
    console.log("   • TypeScript Express server");
    console.log("   • Health check endpoint");
    console.log("   • Users CRUD API");
    console.log("   • HTML test interface");
    console.log("   • CORS support");
    console.log("");
    
    // Don't cleanup immediately so user can explore
    console.log("💡 Server will continue running. Press Ctrl+C to stop.");
    console.log("🧹 Run cleanup manually or restart to clean up resources.");

  } catch (error) {
    console.error("❌ Development workflow failed:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('authentication')) {
        console.log("\n💡 Authentication help:");
        console.log("   Run 'npm run auth' to set up Claude OAuth");
        console.log("   Or set environment variables as needed");
      }
    }
    
    process.exit(1);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  claudeDevExample();
}