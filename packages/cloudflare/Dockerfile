# FROM docker.io/ghostwriternr/cloudflare-sandbox-arm:0.0.9
FROM my-sandbox-base:latest

# Switch to sandbox user and set up Bun environment
ENV BUN_INSTALL="/home/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"
RUN bun add -g @anthropic-ai/claude-code@latest
RUN bun add -g @openai/codex@latest
RUN bun add -g @google/gemini-cli@latest
RUN bun add -g opencode-ai@latest

# Local development ports
EXPOSE 3001

# Run the same command as the original image
CMD ["bun", "index.ts"]
