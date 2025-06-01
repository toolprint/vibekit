import { TelemetryConfig } from "../types";

export interface TelemetryData {
  sessionId?: string;
  agentType: string;
  mode: string;
  prompt: string;
  timestamp: number;
  sandboxId?: string;
  repoUrl?: string;
  streamData?: string;
  eventType: "start" | "stream" | "end" | "error";
  metadata?: Record<string, any>;
}

export class TelemetryService {
  private config: TelemetryConfig;
  private sessionId: string;

  constructor(config: TelemetryConfig, sessionId?: string) {
    this.config = config;
    this.sessionId = sessionId || this.generateSessionId();
  }

  private generateSessionId(): string {
    return `vibekit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldSample(): boolean {
    if (this.config.samplingRatio === undefined) return true;
    return Math.random() < this.config.samplingRatio;
  }

  private async sendTelemetryData(data: TelemetryData): Promise<void> {
    if (
      !this.config.isEnabled ||
      !this.config.endpoint ||
      !this.shouldSample()
    ) {
      return;
    }

    try {
      const payload = {
        resource: {
          service: {
            name: this.config.serviceName || "vibekit",
            version: this.config.serviceVersion || "1.0.0",
          },
          ...this.config.resourceAttributes,
        },
        scope: {
          name: "vibekit.streaming",
          version: "1.0.0",
        },
        spans: [
          {
            traceId: this.generateTraceId(),
            spanId: this.generateSpanId(),
            name: `vibekit.${data.eventType}`,
            kind: 1, // SPAN_KIND_INTERNAL
            startTimeUnixNano: data.timestamp * 1000000, // Convert to nanoseconds
            endTimeUnixNano: data.timestamp * 1000000,
            attributes: {
              "vibekit.session_id": this.sessionId,
              "vibekit.agent_type": data.agentType,
              "vibekit.mode": data.mode,
              "vibekit.event_type": data.eventType,
              "vibekit.prompt_length": data.prompt.length,
              "vibekit.sandbox_id": data.sandboxId || "",
              "vibekit.repo_url": data.repoUrl || "",
              "vibekit.stream_data_length": data.streamData?.length || 0,
              ...data.metadata,
            },
            events: data.streamData
              ? [
                  {
                    name: "stream_data",
                    timeUnixNano: data.timestamp * 1000000,
                    attributes: {
                      "stream.data": data.streamData,
                    },
                  },
                ]
              : [],
          },
        ],
      };

      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout || 5000),
      });

      if (!response.ok) {
        console.warn(
          `Telemetry request failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.warn("Failed to send telemetry data:", error);
    }
  }

  private generateTraceId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }

  private generateSpanId(): string {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }

  public async trackStart(
    agentType: string,
    mode: string,
    prompt: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.sendTelemetryData({
      sessionId: this.sessionId,
      agentType,
      mode,
      prompt,
      timestamp: Date.now(),
      eventType: "start",
      metadata,
    });
  }

  public async trackStream(
    agentType: string,
    mode: string,
    prompt: string,
    streamData: string,
    sandboxId?: string,
    repoUrl?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.sendTelemetryData({
      sessionId: this.sessionId,
      agentType,
      mode,
      prompt,
      timestamp: Date.now(),
      streamData,
      sandboxId,
      repoUrl,
      eventType: "stream",
      metadata,
    });
  }

  public async trackEnd(
    agentType: string,
    mode: string,
    prompt: string,
    sandboxId?: string,
    repoUrl?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.sendTelemetryData({
      sessionId: this.sessionId,
      agentType,
      mode,
      prompt,
      timestamp: Date.now(),
      sandboxId,
      repoUrl,
      eventType: "end",
      metadata,
    });
  }

  public async trackError(
    agentType: string,
    mode: string,
    prompt: string,
    error: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.sendTelemetryData({
      sessionId: this.sessionId,
      agentType,
      mode,
      prompt,
      timestamp: Date.now(),
      streamData: error,
      eventType: "error",
      metadata,
    });
  }
}
