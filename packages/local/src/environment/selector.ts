/**
 * Environment Selector
 * 
 * Provides intelligent selection mechanisms for choosing between multiple
 * Container Use environments based on various criteria like name, status,
 * branch, and user preferences.
 */

import { Environment } from '../container-use/types';
import { EnvironmentManager } from './manager';

export interface SelectionCriteria {
  name?: string;
  status?: string;
  branch?: string;
  agentType?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  preferredOrder?: 'newest' | 'oldest' | 'name' | 'status';
}

export interface SelectionOptions {
  allowMultiple?: boolean;
  interactive?: boolean;
  defaultToFirst?: boolean;
  confirmSelection?: boolean;
}

export interface SelectionResult {
  selected: Environment[];
  criteria: SelectionCriteria;
  selectionMethod: 'exact' | 'interactive' | 'auto' | 'default';
  confidence: number; // 0-1 scale
}

export class EnvironmentSelector {
  constructor(private environmentManager: EnvironmentManager) {}

  /**
   * Select environment(s) based on criteria
   */
  async selectEnvironments(
    criteria: SelectionCriteria = {},
    options: SelectionOptions = {}
  ): Promise<SelectionResult> {
    const allEnvironments = await this.environmentManager.listEnvironments();
    
    if (allEnvironments.length === 0) {
      return {
        selected: [],
        criteria,
        selectionMethod: 'auto',
        confidence: 1.0,
      };
    }

    // Apply filters
    const filtered = this.applyFilters(allEnvironments, criteria);
    
    if (filtered.length === 0) {
      return {
        selected: [],
        criteria,
        selectionMethod: 'auto',
        confidence: 1.0,
      };
    }

    // Sort based on preferred order
    const sorted = this.sortEnvironments(filtered, criteria.preferredOrder);

    // Determine selection method
    if (criteria.name && filtered.length === 1) {
      // Exact match
      return {
        selected: [filtered[0]],
        criteria,
        selectionMethod: 'exact',
        confidence: 1.0,
      };
    }

    if (options.interactive && filtered.length > 1) {
      // Interactive selection would go here
      // For now, return first match
      return {
        selected: options.allowMultiple ? sorted : [sorted[0]],
        criteria,
        selectionMethod: 'interactive',
        confidence: 0.8,
      };
    }

    if (options.defaultToFirst || sorted.length === 1) {
      return {
        selected: [sorted[0]],
        criteria,
        selectionMethod: 'default',
        confidence: sorted.length === 1 ? 1.0 : 0.6,
      };
    }

    // Return all if multiple allowed
    return {
      selected: options.allowMultiple ? sorted : [sorted[0]],
      criteria,
      selectionMethod: 'auto',
      confidence: 0.5,
    };
  }

  /**
   * Smart environment selection based on context
   */
  async smartSelect(
    hint?: string,
    options: SelectionOptions = {}
  ): Promise<SelectionResult> {
    const allEnvironments = await this.environmentManager.listEnvironments();
    
    if (allEnvironments.length === 0) {
      return {
        selected: [],
        criteria: {},
        selectionMethod: 'auto',
        confidence: 1.0,
      };
    }

    let criteria: SelectionCriteria = {};
    let confidence = 0.5;

    if (hint) {
      // Try to interpret the hint
      criteria = this.interpretHint(hint);
      confidence = 0.7;
    } else {
      // Use smart defaults
      criteria = this.getSmartDefaults(allEnvironments);
      confidence = 0.6;
    }

    return this.selectEnvironments(criteria, {
      ...options,
      defaultToFirst: true,
    });
  }

  /**
   * Get the most recently active environment
   */
  async getRecentEnvironment(): Promise<Environment | null> {
    const result = await this.selectEnvironments({
      status: 'running',
      preferredOrder: 'newest',
    }, {
      defaultToFirst: true,
    });

    return result.selected[0] || null;
  }

  /**
   * Find environment by partial name match
   */
  async findByPartialName(partialName: string): Promise<Environment[]> {
    const allEnvironments = await this.environmentManager.listEnvironments();
    
    return allEnvironments.filter(env =>
      env.name.toLowerCase().includes(partialName.toLowerCase())
    );
  }

  /**
   * Get environments for a specific agent type
   */
  async getEnvironmentsByAgent(agentType: string): Promise<Environment[]> {
    const result = await this.selectEnvironments({
      agentType,
      status: 'running',
    }, {
      allowMultiple: true,
    });

    return result.selected;
  }

  /**
   * Get conflicting environments (same branch, different status)
   */
  async getConflictingEnvironments(): Promise<Map<string, Environment[]>> {
    const allEnvironments = await this.environmentManager.listEnvironments();
    const conflicts = new Map<string, Environment[]>();

    // Group by branch
    const byBranch = new Map<string, Environment[]>();
    for (const env of allEnvironments) {
      if (env.branch) {
        const existing = byBranch.get(env.branch) || [];
        existing.push(env);
        byBranch.set(env.branch, existing);
      }
    }

    // Find conflicts (multiple environments per branch)
    for (const [branch, environments] of byBranch) {
      if (environments.length > 1) {
        conflicts.set(branch, environments);
      }
    }

    return conflicts;
  }

  /**
   * Create interactive selection prompt data
   */
  async createSelectionPrompt(
    environments: Environment[]
  ): Promise<Array<{
    name: string;
    value: string;
    description: string;
    disabled?: boolean;
  }>> {
    return environments.map(env => ({
      name: `${env.name} (${env.status})`,
      value: env.name,
      description: this.getEnvironmentDescription(env),
      disabled: env.status === 'error',
    }));
  }

  // Private helper methods

  private applyFilters(
    environments: Environment[],
    criteria: SelectionCriteria
  ): Environment[] {
    return environments.filter(env => {
      // Name filter
      if (criteria.name && !env.name.includes(criteria.name)) {
        return false;
      }

      // Status filter
      if (criteria.status && env.status !== criteria.status) {
        return false;
      }

      // Branch filter
      if (criteria.branch && env.branch !== criteria.branch) {
        return false;
      }

      // Agent type filter (from environment variables)
      if (criteria.agentType) {
        const envVars = env.environment || {};
        const agentType = envVars.VIBEKIT_AGENT_TYPE || envVars.AGENT_TYPE;
        if (agentType !== criteria.agentType) {
          return false;
        }
      }

      // Date filters
      if (criteria.createdAfter && env.createdAt) {
        const created = new Date(env.createdAt);
        if (created < criteria.createdAfter) {
          return false;
        }
      }

      if (criteria.createdBefore && env.createdAt) {
        const created = new Date(env.createdAt);
        if (created > criteria.createdBefore) {
          return false;
        }
      }

      return true;
    });
  }

  private sortEnvironments(
    environments: Environment[],
    order: 'newest' | 'oldest' | 'name' | 'status' = 'newest'
  ): Environment[] {
    const sorted = [...environments];

    switch (order) {
      case 'newest':
        return sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

      case 'oldest':
        return sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });

      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));

      case 'status':
        const statusOrder = ['running', 'starting', 'stopped', 'error'];
        return sorted.sort((a, b) => {
          const aIndex = statusOrder.indexOf(a.status) ?? 999;
          const bIndex = statusOrder.indexOf(b.status) ?? 999;
          return aIndex - bIndex;
        });

      default:
        return sorted;
    }
  }

  private interpretHint(hint: string): SelectionCriteria {
    const criteria: SelectionCriteria = {};
    const lowerHint = hint.toLowerCase();

    // Check for status keywords
    if (lowerHint.includes('running')) {
      criteria.status = 'running';
    } else if (lowerHint.includes('stopped')) {
      criteria.status = 'stopped';
    }

    // Check for agent type keywords
    const agentTypes = ['claude', 'codex', 'opencode', 'gemini'];
    for (const agentType of agentTypes) {
      if (lowerHint.includes(agentType)) {
        criteria.agentType = agentType;
        break;
      }
    }

    // Check for time keywords
    if (lowerHint.includes('recent') || lowerHint.includes('latest')) {
      criteria.preferredOrder = 'newest';
    } else if (lowerHint.includes('oldest') || lowerHint.includes('first')) {
      criteria.preferredOrder = 'oldest';
    }

    // If it doesn't contain keywords, treat as name
    if (!criteria.status && !criteria.agentType && !criteria.preferredOrder) {
      criteria.name = hint;
    }

    return criteria;
  }

  private getSmartDefaults(environments: Environment[]): SelectionCriteria {
    // Prefer running environments
    const running = environments.filter(env => env.status === 'running');
    if (running.length > 0) {
      return {
        status: 'running',
        preferredOrder: 'newest',
      };
    }

    // Fall back to newest
    return {
      preferredOrder: 'newest',
    };
  }

  private getEnvironmentDescription(env: Environment): string {
    const parts: string[] = [];

    if (env.branch) {
      parts.push(`branch: ${env.branch}`);
    }

    const agentType = env.environment?.VIBEKIT_AGENT_TYPE || env.environment?.AGENT_TYPE;
    if (agentType) {
      parts.push(`agent: ${agentType}`);
    }

    if (env.createdAt) {
      const created = new Date(env.createdAt);
      const ago = this.getTimeAgo(created);
      parts.push(`created ${ago}`);
    }

    return parts.join(', ') || 'No description available';
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else {
      return 'just now';
    }
  }
} 