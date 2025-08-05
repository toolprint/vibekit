export interface AnalyticsSession {
  sessionId: string;
  agentName: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  inputBytes: number;
  outputBytes: number;
  commands: Array<{
    command: string;
    args: string[];
    timestamp: number;
  }>;
  exitCode: number | null;
  filesChanged: string[];
  filesCreated: string[];
  filesDeleted: string[];
  errors: string[];
  warnings: string[];
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalDuration: number;
  averageDuration: number;
  successfulSessions: number;
  successRate: number;
  totalFilesChanged: number;
  totalErrors: number;
  totalWarnings: number;
  topErrors: Array<{ error: string; count: number }>;
  agentBreakdown: Record<string, {
    sessions: number;
    duration: number;
    successfulSessions: number;
    successRate: number;
    averageDuration: number;
  }>;
}