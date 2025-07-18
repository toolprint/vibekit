import { TelemetryConfig } from "../types";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";

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
  private tracer: any;
  private sdk?: NodeSDK;

  constructor(config: TelemetryConfig, sessionId?: string) {
    this.config = config;
    this.sessionId = sessionId || this.generateSessionId();

    if (this.config.isEnabled) {
      this.initializeOpenTelemetry();
    }
  }

  private generateSessionId(): string {
    return `vibekit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldSample(): boolean {
    if (this.config.samplingRatio === undefined) return true;
    return Math.random() < this.config.samplingRatio;
  }

  private initializeOpenTelemetry(): void {
    if (!this.config.endpoint || !this.shouldSample()) {
      return;
    }

    try {
      // Create resource with service information and custom attributes
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.config.serviceName || "vibekit",
        [ATTR_SERVICE_VERSION]: this.config.serviceVersion || "1.0.0",
        ...this.config.resourceAttributes,
      });

      // Create OTLP trace exporter
      const traceExporter = new OTLPTraceExporter({
        url: this.config.endpoint,
        headers: this.config.headers || {},
        timeoutMillis: this.config.timeout || 5000,
      });

      // Initialize OpenTelemetry SDK
      this.sdk = new NodeSDK({
        resource: resource,
        traceExporter: traceExporter,
        instrumentations: [], // No auto-instrumentations needed for this use case
      });

      // Start the SDK
      this.sdk.start();

      // Get tracer
      this.tracer = trace.getTracer("vibekit", "1.0.0");
    } catch (error) {
      console.warn("Failed to initialize OpenTelemetry:", error);
    }
  }

  private createSpan(
    name: string,
    agentType: string,
    mode: string,
    prompt: string,
    metadata?: Record<string, any>
  ): any {
    if (!this.tracer) return null;

    const span = this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes: {
        "vibekit.session_id": this.sessionId,
        "vibekit.agent_type": agentType,
        "vibekit.mode": mode,
        "vibekit.event_type": name.replace("vibekit.", ""),
        "vibekit.prompt_length": prompt.length,
        ...metadata,
      },
    });

    return span;
  }

  public async trackStart(
    agentType: string,
    mode: string,
    prompt: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.isEnabled || !this.tracer) {
      return;
    }

    try {
      const span = this.createSpan(
        `vibekit.start`,
        agentType,
        mode,
        prompt,
        metadata
      );

      if (span) {
        // Add event to span
        span.addEvent("operation_started", {
          "vibekit.event_type": "start",
          timestamp: Date.now(),
        });

        // End span immediately for start events
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    } catch (error) {
      console.warn("Failed to track start event:", error);
    }
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
    if (!this.config.isEnabled || !this.tracer) {
      return;
    }

    try {
      const span = this.createSpan(`vibekit.stream`, agentType, mode, prompt, {
        "vibekit.sandbox_id": sandboxId || "",
        "vibekit.repo_url": repoUrl || "",
        "vibekit.stream_data_length": streamData.length,
        ...metadata,
      });

      if (span) {
        // Add stream data as an event
        span.addEvent("stream_data", {
          "vibekit.event_type": "stream",
          "stream.data": streamData,
          timestamp: Date.now(),
        });

        // End span immediately for stream events
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    } catch (error) {
      console.warn("Failed to track stream event:", error);
    }
  }

  public async trackEnd(
    agentType: string,
    mode: string,
    prompt: string,
    sandboxId?: string,
    repoUrl?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.isEnabled || !this.tracer) {
      return;
    }

    try {
      const span = this.createSpan(`vibekit.end`, agentType, mode, prompt, {
        "vibekit.sandbox_id": sandboxId || "",
        "vibekit.repo_url": repoUrl || "",
        ...metadata,
      });

      if (span) {
        // Add event to span
        span.addEvent("operation_completed", {
          "vibekit.event_type": "end",
          timestamp: Date.now(),
        });

        // End span
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    } catch (error) {
      console.warn("Failed to track end event:", error);
    }
  }

  public async trackError(
    agentType: string,
    mode: string,
    prompt: string,
    error: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.isEnabled || !this.tracer) {
      return;
    }

    try {
      const span = this.createSpan(
        `vibekit.error`,
        agentType,
        mode,
        prompt,
        metadata
      );

      if (span) {
        // Record the error
        span.recordException(new Error(error));

        // Add error event
        span.addEvent("error_occurred", {
          "vibekit.event_type": "error",
          "error.message": error,
          timestamp: Date.now(),
        });

        // Set error status
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error,
        });

        span.end();
      }
    } catch (err) {
      console.warn("Failed to track error event:", err);
    }
  }

  /**
   * Gracefully shutdown the OpenTelemetry SDK
   */
  public async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
      } catch (error) {
        console.warn("Failed to shutdown OpenTelemetry SDK:", error);
      }
    }
  }
}
