FROM node:22-alpine

RUN apk update && apk add --no-cache \
  git \
  curl \
  ripgrep \
  netcat-openbsd \
  && rm -rf /var/cache/apk/*

# Confirm installations
RUN node -v && npm -v && git --version

# Install Claude Code globalliy
RUN npm install -g @anthropic-ai/claude-code@latest

WORKDIR /app

COPY --from=ghcr.io/blaxel-ai/sandbox:latest /sandbox-api /usr/local/bin/sandbox-api

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Add npm global modules to PATH
ENV PATH="/usr/local/bin:$PATH"

ENTRYPOINT ["/entrypoint.sh"]