import { ClaudeAuth } from '@vibe-kit/auth/node';
import { execSync } from 'child_process';

export interface ClaudeAuthResult {
  type: 'oauth' | 'apikey';
  token: string;
}

export class AuthManager {
  /**
   * Get Claude authentication with priority:
   * 1. CLAUDE_CODE_OAUTH_TOKEN from ClaudeAuth
   * 2. CLAUDE_CODE_OAUTH_TOKEN from environment
   * 3. ANTHROPIC_API_KEY from environment
   */
  static async getClaudeAuth(): Promise<ClaudeAuthResult> {
    console.log("🔐 Checking Claude authentication...");

    // Try ClaudeAuth OAuth first
    try {
      const isAuthenticated = await ClaudeAuth.isAuthenticated();
      if (isAuthenticated) {
        const oauthToken = await ClaudeAuth.getValidToken();
        if (oauthToken) {
          console.log("✅ Using Claude OAuth authentication from ClaudeAuth");
          return { type: 'oauth', token: oauthToken };
        }
      }
    } catch (error) {
      console.log("ℹ️ ClaudeAuth not available, checking environment...");
    }

    // Check for OAuth token in environment
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      console.log("✅ Using CLAUDE_CODE_OAUTH_TOKEN from environment");
      return { type: 'oauth', token: process.env.CLAUDE_CODE_OAUTH_TOKEN };
    }

    // Fallback to API key
    if (process.env.ANTHROPIC_API_KEY) {
      console.log("✅ Using ANTHROPIC_API_KEY");
      return { type: 'apikey', token: process.env.ANTHROPIC_API_KEY };
    }

    throw new Error(
      "❌ No Claude authentication found. Please either:\\n" +
      "1. Run 'npm run auth' to authenticate with OAuth\\n" +
      "2. Run 'vibekit auth claude' if you have VibeKit CLI\\n" +
      "3. Set CLAUDE_CODE_OAUTH_TOKEN environment variable\\n" +
      "4. Set ANTHROPIC_API_KEY environment variable"
    );
  }

  /**
   * Get GitHub token with priority:
   * 1. Try 'gh auth token' command
   * 2. Use GITHUB_TOKEN environment variable
   */
  static async getGitHubToken(): Promise<string | null> {
    console.log("🐙 Checking GitHub authentication...");

    // Try gh CLI first
    try {
      const token = execSync('gh auth token', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
      }).trim();
      
      if (token && !token.includes('error')) {
        console.log("✅ Using GitHub token from 'gh' CLI");
        return token;
      }
    } catch (error) {
      // GitHub CLI not available or not authenticated
    }

    // Fallback to environment variable
    if (process.env.GITHUB_TOKEN) {
      console.log("✅ Using GITHUB_TOKEN from environment");
      return process.env.GITHUB_TOKEN;
    }

    console.log("⚠️ No GitHub authentication found (optional for public repos)");
    return null;
  }

  /**
   * Authenticate with ClaudeAuth OAuth flow
   */
  static async authenticateOAuth(): Promise<ClaudeAuthResult> {
    console.log("🔐 Starting OAuth authentication flow...");
    
    try {
      const token = await ClaudeAuth.authenticate();
      console.log("✅ OAuth authentication successful!");
      
      // Get the fresh token
      const validToken = await ClaudeAuth.getValidToken();
      if (!validToken) {
        throw new Error("Failed to get valid token after authentication");
      }
      
      return { type: 'oauth', token: validToken };
    } catch (error) {
      console.error("❌ OAuth authentication failed:", error);
      throw error;
    }
  }

  /**
   * Check authentication status
   */
  static async checkAuthStatus(): Promise<{
    claude: boolean;
    github: boolean;
    blaxel: boolean;
  }> {
    const status = {
      claude: false,
      github: false,
      blaxel: false
    };

    // Check Claude auth
    try {
      await this.getClaudeAuth();
      status.claude = true;
    } catch {
      // Not authenticated
    }

    // Check GitHub auth
    try {
      const token = await this.getGitHubToken();
      status.github = !!token;
    } catch {
      // Not authenticated
    }

    // Check Blaxel (assume CLI auth if no error)
    status.blaxel = true; // We assume Blaxel CLI is set up

    return status;
  }

  /**
   * Get authentication summary for logging
   */
  static async getAuthSummary(): Promise<string> {
    const status = await this.checkAuthStatus();
    const items = [];
    
    items.push(`Claude: ${status.claude ? '✅' : '❌'}`);
    items.push(`GitHub: ${status.github ? '✅' : '⚠️ (optional)'}`);
    items.push(`Blaxel: ${status.blaxel ? '✅' : '❌'}`);
    
    return `Authentication Status: ${items.join(', ')}`;
  }
}