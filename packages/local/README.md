# @vibekit/local

Local sandbox provider for Vibekit using [Container Use](https://github.com/dagger/container-use).

## Overview

The `@vibekit/local` package enables Vibekit to run AI coding agents in isolated, containerized environments on your local machine. This provides an alternative to cloud-based sandboxes, offering faster iteration, offline development, and cost savings.

## System Requirements

### Required Dependencies
- **Docker**: Container runtime for isolation
- **Dagger**: Container orchestration engine
- **Container Use**: CLI tool for agent environments

### Supported Platforms
- macOS (recommended)
- Linux
- Windows (WSL2)

### Minimum System Resources
- 8GB RAM (16GB recommended for multiple environments)
- 10GB free disk space
- Modern CPU with virtualization support

## Installation

The local provider is automatically available when you install Vibekit. System dependencies are installed automatically when you first use the local provider:

```bash
# Initialize with local provider
vibekit init --provider local

# Or add to existing project
vibekit local setup
```

### Manual Dependency Installation

If automatic installation fails, you can install dependencies manually:

```bash
# Install Docker (platform-specific)
# See: https://docs.docker.com/get-docker/

# Install Container Use
curl -fsSL https://raw.githubusercontent.com/dagger/container-use/main/install.sh | bash

# Verify installation
container-use --version
```

## Usage

### Basic Commands

```bash
# Create a new local sandbox
vibekit local create --name my-sandbox

# List all local sandboxes
vibekit local list

# Watch sandbox activity in real-time
vibekit local watch my-sandbox

# Open terminal in sandbox
vibekit local terminal my-sandbox

# Delete a sandbox
vibekit local delete my-sandbox
```

### Multi-Environment Workflows

```bash
# Create multiple sandboxes for parallel work
vibekit local create --name frontend-work
vibekit local create --name backend-api

# Watch multiple environments
vibekit local watch --all

# Switch between environments
vibekit local checkout frontend-work
```

### Configuration

```bash
# Set default base image
vibekit local config base-image python:3.11

# Configure resource limits
vibekit local config resources --memory 2g --cpu 1

# View current configuration
vibekit local config show
```

## Architecture

The local provider consists of several key components:

- **Container Use Wrapper**: Low-level CLI interaction
- **Environment Manager**: Lifecycle and state management
- **Git Integration**: Branch-based isolation
- **Agent Configuration**: MCP server setup
- **Resource Management**: Docker container orchestration

## Security Considerations

Local sandboxes run in Docker containers with the following isolation:

- **File System**: Containers cannot access host files outside mounted volumes
- **Network**: Containers run in isolated Docker networks
- **Process**: Complete process isolation from host system
- **Resources**: Configurable CPU and memory limits

## Troubleshooting

### Common Issues

**Docker not running:**
```bash
# Check Docker status
docker ps

# Start Docker Desktop (macOS/Windows)
# Or start Docker daemon (Linux)
```

**Container Use not found:**
```bash
# Reinstall Container Use
curl -fsSL https://raw.githubusercontent.com/dagger/container-use/main/install.sh | bash

# Check PATH
which container-use
```

**Permission errors:**
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Then log out and back in
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
export VIBEKIT_LOG_LEVEL=debug
vibekit local create --name debug-sandbox
```

## Contributing

See the main [Vibekit contribution guide](../../CONTRIBUTING.md) for general guidelines.

### Local Development

```bash
# Clone the repository
git clone https://github.com/vibekit/vibekit.git
cd vibekit

# Install dependencies
npm install

# Build the local package
cd packages/local
npm run build

# Run tests
npm test
```

## License

MIT - see [LICENSE](../../LICENSE) for details. 