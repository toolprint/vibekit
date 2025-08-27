import { VibeKit } from "@vibe-kit/sdk";
import { CommandUtils, type CommandResult } from "./commands";

export class ClaudeWorker {
  private commands: CommandUtils;

  constructor(private vibeKit: VibeKit) {
    this.commands = new CommandUtils(vibeKit);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.vibeKit.on("update", (message) => {
      console.log("📝 Update:", message);
    });

    this.vibeKit.on("error", (error) => {
      console.error("❌ Error:", error);
    });
  }

  /**
   * Test sandbox connection
   */
  async testConnection(): Promise<void> {
    console.log("🔌 Testing Blaxel sandbox connection...");
    
    const result = await this.commands.execute("echo 'Sandbox connected successfully!'");
    
    if (result.success) {
      console.log("✅ Sandbox connection verified");
      
      // Get system info
      const sysInfo = await this.commands.getSystemInfo();
      console.log("💻 System Information:");
      console.log(`   OS: ${sysInfo.os} ${sysInfo.architecture}`);
      console.log(`   Node.js: ${sysInfo.node}`);
      console.log(`   npm: ${sysInfo.npm}`);
      console.log(`   Git: ${sysInfo.git}`);
    } else {
      throw new Error("Failed to connect to sandbox");
    }
  }

  /**
   * Clone a GitHub repository
   */
  async cloneRepository(repo: string, targetDir?: string): Promise<void> {
    console.log(`📦 Cloning repository: ${repo}`);
    
    const repoName = repo.split('/')[1];
    const cloneDir = targetDir || `/workspace/${repoName}`;
    
    const commands = [
      `git clone https://github.com/${repo}.git ${cloneDir}`,
      `ls -la ${cloneDir}`
    ];
    
    const results = await this.commands.executeSequence(commands);
    
    if (results.every(r => r.success)) {
      console.log(`✅ Repository cloned to ${cloneDir}`);
    } else {
      throw new Error(`Failed to clone repository ${repo}`);
    }
  }

  /**
   * Set up development environment
   */
  async setupDevelopmentEnvironment(workingDir: string = '/workspace/project'): Promise<void> {
    console.log("🛠️ Setting up development environment...");
    
    const success = await this.commands.setupDevEnvironment(workingDir);
    
    if (!success) {
      throw new Error("Failed to set up development environment");
    }
  }

  /**
   * Generate code with Claude
   */
  async generateCode(prompt: string, mode: 'ask' | 'code' = 'code'): Promise<any> {
    console.log("🤖 Generating code with Claude...");
    console.log(`📝 Prompt: ${prompt}`);
    
    try {
      const result = await this.vibeKit.generateCode({
        prompt,
        mode
      });
      
      console.log("✅ Code generation completed");
      return result;
    } catch (error) {
      console.error("❌ Code generation failed:", error);
      throw error;
    }
  }

  /**
   * Create a new project from template
   */
  async createProject(options: {
    name: string;
    template: 'express' | 'react' | 'nextjs' | 'node';
    workingDir?: string;
  }): Promise<void> {
    console.log(`🏗️ Creating ${options.template} project: ${options.name}`);
    
    const projectDir = options.workingDir || `/workspace/${options.name}`;
    
    let createCommand: string;
    
    switch (options.template) {
      case 'express':
        createCommand = `npx express-generator ${projectDir}`;
        break;
      case 'react':
        createCommand = `npx create-react-app ${projectDir} --template typescript`;
        break;
      case 'nextjs':
        createCommand = `npx create-next-app@latest ${projectDir} --typescript --tailwind --eslint --app`;
        break;
      case 'node':
        createCommand = `mkdir -p ${projectDir} && cd ${projectDir} && npm init -y`;
        break;
      default:
        throw new Error(`Unknown template: ${options.template}`);
    }
    
    const result = await this.commands.execute(createCommand);
    
    if (result.success) {
      console.log(`✅ Project ${options.name} created successfully`);
      
      // Install dependencies if needed
      if (options.template !== 'node') {
        await this.commands.installDependencies('npm', projectDir);
      }
    } else {
      throw new Error(`Failed to create project ${options.name}`);
    }
  }

  /**
   * Run a full development workflow
   */
  async runDevelopmentWorkflow(options: {
    repository?: string;
    prompt?: string;
    projectType?: 'express' | 'react' | 'nextjs' | 'node';
    port?: number;
  }): Promise<{ result?: any }> {
    console.log("🚀 Running full development workflow...");
    
    let workingDir = '/workspace';
    
    // Step 1: Clone repository if provided
    if (options.repository) {
      await this.cloneRepository(options.repository);
      const repoName = options.repository.split('/')[1];
      workingDir = `/workspace/${repoName}`;
    }
    
    // Step 2: Set up environment
    await this.setupDevelopmentEnvironment(workingDir);
    
    // Step 3: Generate code if prompt provided, or summarize repo if cloned
    let result;
    if (options.prompt) {
      result = await this.generateCode(options.prompt);
    } else if (options.repository) {
      // Summarize the repository contents
      result = await this.generateCode("Please analyze and summarize the contents of this repository. Provide an overview of the project structure, main technologies used, and key functionality.");
    }
    
    // Step 4: Create project if type specified and no repo
    if (options.projectType && !options.repository) {
      await this.createProject({
        name: 'generated-project',
        template: options.projectType,
        workingDir: workingDir
      });
      workingDir = `${workingDir}/generated-project`;
    }
    
    console.log("✅ Development workflow completed");
    
    return { result };
  }

  /**
   * Execute a custom command
   */
  async executeCommand(command: string, workingDir?: string): Promise<CommandResult> {
    return this.commands.execute(command, { workingDirectory: workingDir });
  }

  /**
   * Get preview URL for a running service
   */
  async getPreviewUrl(port: number = 3000): Promise<string> {
    try {
      const url = await this.vibeKit.getHost(port);
      console.log(`🌐 Preview URL: ${url}`);
      return url;
    } catch (error) {
      throw new Error(`Failed to get preview URL for port ${port}: ${error}`);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up resources...");
    try {
      await this.vibeKit.kill();
      console.log("✅ Cleanup completed");
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
    }
  }
}