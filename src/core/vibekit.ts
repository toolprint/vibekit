import { AgentConfig } from "../types/agent";
import { callCodex, CodexResponse } from "../agents/codex";
import { callClaude, ClaudeResponse } from "../agents/claude";
import { callDevin } from "../agents/devin";
import { callCodegen } from "../agents/codegen";
import { callOpenHands } from "../agents/openhands";

export type AgentResponse = CodexResponse | ClaudeResponse | { code: string };

export class VibeKit {
  constructor(private setup: AgentConfig) {}

  async sendPrompt(prompt: string): Promise<AgentResponse> {
    switch (this.setup.agent) {
      case "codex":
        return callCodex(prompt, this.setup.config);
      case "claude":
        return callClaude(prompt, this.setup.config);
      case "devin":
        return callDevin(prompt, this.setup.config.apiKey);
      case "codegen":
        return callCodegen(prompt, this.setup.config.apiKey);
      case "openhands":
        return callOpenHands(prompt, this.setup.config.apiKey);
      default:
        throw new Error("Unsupported agent");
    }
  }
}
