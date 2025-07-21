# FROM docker.io/ghostwriternr/cloudflare-sandbox-arm:0.0.9
FROM my-sandbox-base:latest

# Switch to sandbox user and set up Bun environment
USER sandbox
ENV BUN_INSTALL="/home/sandbox/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"
RUN bun add -g @anthropic-ai/claude-code@latest
RUN bun add -g @openai/codex@latest
RUN bun add -g @google/gemini-cli@latest
RUN bun add -g opencode-ai@latest

# Run the same command as the original image
CMD ["bun", "index.ts"]
