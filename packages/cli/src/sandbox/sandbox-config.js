import SandboxUtils from './sandbox-utils.js';

/**
 * Handles sandbox configuration with precedence: CLI flags > Environment variables > Settings file
 */
export class SandboxConfig {
  /**
   * Get default volume configuration
   */
  static getDefaultVolumeConfig() {
    return {
      credentials: {
        enabled: true,          // Enable credential volumes
        secureMode: false,      // Start insecure, stub for security
        filterSensitive: true,  // Remove sensitive config data
        fallbackEnabled: true   // Fallback to basic mounting on failure
      },
      cache: {
        enabled: true,          // Enable persistent cache volumes
        types: ['npm', 'node'], // Cache types to create
        retention: '7d'         // Cache retention policy
      },
      volumes: {
        prefix: 'vibekit',      // Volume name prefix
        cleanup: 'auto',        // Cleanup policy: auto, manual, never
        debug: false            // Enable volume inspection
      }
    };
  }
  /**
   * Resolve sandbox configuration following Gemini CLI precedence model
   * Enhanced to include volume configuration
   */
  static async resolveSandboxConfig(cliOptions = {}, settings = {}) {
    let sandboxEnabled = false;
    let sandboxType = 'none';
    let source = 'default';

    // 1. Check CLI flags (highest priority)
    if (cliOptions.sandbox || cliOptions.sandboxType) {
      sandboxEnabled = true;
      sandboxType = cliOptions.sandboxType || 'docker';
      source = 'cli';
    }
    // 2. Check environment variables
    else if (process.env.VIBEKIT_SANDBOX === 'true' || process.env.VIBEKIT_SANDBOX === '1') {
      sandboxEnabled = true;
      sandboxType = process.env.VIBEKIT_SANDBOX_TYPE || 'docker';
      source = 'env';
    }
    else if (process.env.VIBEKIT_SANDBOX && process.env.VIBEKIT_SANDBOX !== 'false' && process.env.VIBEKIT_SANDBOX !== '0') {
      // Support direct type specification like VIBEKIT_SANDBOX=docker
      sandboxEnabled = true;
      sandboxType = process.env.VIBEKIT_SANDBOX;
      source = 'env';
    }
    // 3. Check settings file (lowest priority)
    else if (settings.sandbox?.enabled) {
      sandboxEnabled = true;
      sandboxType = settings.sandbox?.type || 'docker';
      source = 'settings';
    }

    // Validate sandbox type
    if (sandboxEnabled && !['docker', 'podman', 'none'].includes(sandboxType)) {
      SandboxUtils.logSandboxWarning(`Unknown sandbox type '${sandboxType}', falling back to 'docker'`);
      sandboxType = 'docker';
    }

    // Auto-detect container runtime if needed
    if (sandboxEnabled && (sandboxType === 'docker' || sandboxType === 'podman')) {
      const availableRuntime = await SandboxUtils.detectContainerRuntime();
      
      if (!availableRuntime) {
        SandboxUtils.logSandboxWarning('No container runtime available, disabling sandbox');
        sandboxEnabled = false;
        sandboxType = 'none';
      } else if (sandboxType !== availableRuntime) {
        // If user specified docker but only podman available (or vice versa), auto-switch
        if (source !== 'cli') {
          sandboxType = availableRuntime;
        }
      }
    }

    // Resolve volume configuration with precedence
    const defaultVolumeConfig = this.getDefaultVolumeConfig();
    const resolvedVolumeConfig = this.resolveVolumeConfig(cliOptions, settings, defaultVolumeConfig);

    return {
      enabled: sandboxEnabled,
      type: sandboxEnabled ? sandboxType : 'none',
      source,
      runtime: sandboxEnabled && (sandboxType === 'docker' || sandboxType === 'podman') ? sandboxType : null,
      volumes: resolvedVolumeConfig
    };
  }

  /**
   * Resolve volume configuration with precedence: CLI > env > settings > defaults
   */
  static resolveVolumeConfig(cliOptions = {}, settings = {}, defaults = {}) {
    const resolved = {
      credentials: {
        ...defaults.credentials,
        ...settings.volumes?.credentials,
        ...cliOptions.volumes?.credentials
      },
      cache: {
        ...defaults.cache,
        ...settings.volumes?.cache,
        ...cliOptions.volumes?.cache
      },
      volumes: {
        ...defaults.volumes,
        ...settings.volumes?.volumes,
        ...cliOptions.volumes?.volumes
      }
    };

    // Override from environment variables
    if (process.env.VIBEKIT_CREDENTIALS_ENABLED !== undefined) {
      resolved.credentials.enabled = process.env.VIBEKIT_CREDENTIALS_ENABLED === 'true';
    }
    
    if (process.env.VIBEKIT_CACHE_ENABLED !== undefined) {
      resolved.cache.enabled = process.env.VIBEKIT_CACHE_ENABLED === 'true';
    }

    if (process.env.VIBEKIT_VOLUME_DEBUG !== undefined) {
      resolved.volumes.debug = process.env.VIBEKIT_VOLUME_DEBUG === 'true';
    }

    return resolved;
  }

  /**
   * Get sandbox flags from environment
   */
  static getSandboxFlags() {
    return SandboxUtils.parseSandboxFlags(process.env.VIBEKIT_SANDBOX_FLAGS);
  }

  /**
   * Get sandbox image name
   */
  static getSandboxImageName() {
    return process.env.VIBEKIT_SANDBOX_IMAGE || 'vibekit-sandbox:latest';
  }
}

export default SandboxConfig;