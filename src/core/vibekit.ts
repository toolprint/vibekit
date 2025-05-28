import { AgentConfig } from "../types/agent";
import {
  CodexAgent,
  CodexResponse,
  CodexStreamCallbacks,
} from "../agents/codex";
import { callClaude, ClaudeResponse } from "../agents/claude";

export type AgentResponse = CodexResponse | ClaudeResponse | { code: string };

// Unified streaming callback interface
export interface VibeKitStreamCallbacks {
  onUpdate?: (message: string) => void;
  onError?: (error: string) => void;
}

export class VibeKit {
  constructor(private setup: AgentConfig) {}

  async generateCode(
    prompt: string,
    callbacks?: VibeKitStreamCallbacks
  ): Promise<AgentResponse> {
    switch (this.setup.agent) {
      case "codex":
        const codexAgent = new CodexAgent(this.setup.config);
        if (callbacks) {
          const codexCallbacks: CodexStreamCallbacks = {
            onUpdate: callbacks.onUpdate,
            onError: callbacks.onError,
          };
          return codexAgent.generateCode(prompt, codexCallbacks);
        }
        return codexAgent.generateCode(prompt);
      case "claude":
        if (callbacks) {
          // Claude doesn't support streaming yet, fall back to regular generation
          // You can optionally call onProgress to indicate start/end
          callbacks.onUpdate?.("Starting Claude code generation...");
          const result = await callClaude(prompt, this.setup.config);
          callbacks.onUpdate?.("Claude code generation completed.");
          return result;
        }
        return callClaude(prompt, this.setup.config);
      default:
        throw new Error("Unsupported agent");
    }
  }
}
