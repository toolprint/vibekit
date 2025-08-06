import http from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';
import { Transform } from 'stream';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';

class ProxyServer {
  constructor(port = 8080) {
    this.port = port;
    this.server = null;
    this.requestCount = 0;
    this.sensitivePatterns = this.loadPatterns();
  }

  loadPatterns() {
    try {
      // Get the project root directory and look for patterns in src/utils
      const currentDir = process.cwd();
      const rulesPatternsPath = path.join(currentDir, 'src/utils/rules-stable.yml');
      
      const patterns = {};
      
      // Load rules patterns if available
      if (fs.existsSync(rulesPatternsPath)) {
        const rulesData = yaml.load(fs.readFileSync(rulesPatternsPath, 'utf8'));
        if (rulesData && rulesData.patterns) {
          rulesData.patterns.forEach(patternObj => {
            if (patternObj.pattern && patternObj.pattern.name && patternObj.pattern.regex) {
              try {
                patterns[patternObj.pattern.name] = new RegExp(patternObj.pattern.regex, 'gi');
              } catch (error) {
                // Invalid regex pattern, skip silently
              }
            }
          });
        }
      }
      
      return patterns;
    } catch (error) {
      return {
        emails: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
        creditCards: /[0-9]{13,19}/g
      };
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      // Create HTTP proxy server
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      // Handle HTTPS CONNECT method for tunneling
      this.server.on('connect', (req, clientSocket, head) => {
        this.handleHttpsConnect(req, clientSocket, head);
      });

      // Start listening
      this.server.listen(this.port, () => {
        resolve();
      });

      this.server.on('error', (error) => {
        reject(error);
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        this.server.close(() => {
          process.exit(0);
        });
      });

      process.on('SIGTERM', () => {
        this.server.close(() => process.exit(0));
      });
    });
  }

  handleHttpRequest(req, res) {
    this.requestCount++;
    const requestId = this.requestCount;

    // Parse the target URL - handle relative URLs by prepending Anthropic API base
    let targetUrl;
    try {
      if (req.url.startsWith('/')) {
        // Relative URL - prepend Anthropic API base
        targetUrl = new URL(req.url, 'https://api.anthropic.com');
      } else {
        // Absolute URL
        targetUrl = new URL(req.url);
      }
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request: Invalid URL');
      return;
    }

    // Prepare request options
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...req.headers },
      rejectUnauthorized: false // Disable SSL verification for proxy
    };

    // Clean up headers for clean forwarding
    delete options.headers['host']; // Will be set to target host
    delete options.headers['proxy-connection'];
    delete options.headers['proxy-authorization'];


    // Choose http or https module
    const httpModule = targetUrl.protocol === 'https:' ? https : http;

    // Capture request body
    let requestBody = '';
    req.on('data', (chunk) => {
      requestBody += chunk.toString();
    });

    req.on('end', () => {
      // Request body captured silently
    });

    // Create sensitive data filter transform
    const createSensitiveDataFilter = (requestId) => {
      const sensitivePatterns = this.sensitivePatterns;
      
      let buffer = '';
      
      return new Transform({
        transform(chunk, encoding, callback) {
          // Add chunk to buffer
          buffer += chunk.toString();
          
          // Process most of buffer, keep overlap for cross-chunk patterns
          const overlapSize = 100; // Keep last 100 chars for patterns that might be split
          const processLength = buffer.length - overlapSize;
          
          if (processLength > 0) {
            let processChunk = buffer.slice(0, processLength);
            buffer = buffer.slice(processLength); // Keep overlap
            
            // Scan and replace sensitive data
            Object.entries(sensitivePatterns).forEach(([type, pattern]) => {
              const matches = processChunk.match(pattern);
              if (matches) {
                processChunk = processChunk.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
              }
            });
            
            this.push(processChunk);
          }
          
          callback();
        },
        
        flush(callback) {
          // Process remaining buffer on stream end
          if (buffer) {
            Object.entries(sensitivePatterns).forEach(([type, pattern]) => {
              const matches = buffer.match(pattern);
              if (matches) {
                buffer = buffer.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
              }
            });
            this.push(buffer);
          }
          callback();
        }
      });
    };

    // Make the proxied request
    const proxyReq = httpModule.request(options, (proxyRes) => {

      // Check if this is an SSE response
      const isSSE = proxyRes.headers['content-type']?.includes('text/event-stream');
      
      if (isSSE) {
        this.handleSSEResponse(requestId, proxyRes);
      }

      // Capture response body for non-SSE or log SSE events
      let responseBody = '';
      proxyRes.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        responseBody += chunkStr;
        
        // For SSE streams, parse and display events in real-time
        if (isSSE) {
          this.parseSSEChunk(requestId, chunkStr);
        }
      });

      proxyRes.on('end', () => {
        // Request completed silently
      });

      // Forward the response through sensitive data filter
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      const sensitiveFilter = createSensitiveDataFilter(requestId);
      proxyRes.pipe(sensitiveFilter).pipe(res);
    });

    // Handle proxy request errors
    proxyReq.on('error', (error) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Proxy Error: ' + error.message);
    });

    // Forward the request body
    req.pipe(proxyReq);
  }

  handleHttpsConnect(req, clientSocket, head) {
    this.requestCount++;
    const requestId = this.requestCount;
    
    const { hostname, port } = this.parseHostPort(req.url);

    const serverSocket = new net.Socket();

    serverSocket.connect(port, hostname, () => {
      
      // Send connection established response
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      
      // Set up bidirectional pipe
      if (head && head.length) {
        serverSocket.write(head);
      }
      
      // Data flows through tunnel silently
      clientSocket.on('data', (data) => {
        this.analyzeTraffic(requestId, data, 'client->server');
      });

      serverSocket.on('data', (data) => {
        this.analyzeTraffic(requestId, data, 'server->client');
      });

      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (error) => {
      clientSocket.end();
    });

    clientSocket.on('error', (error) => {
      serverSocket.end();
    });

    serverSocket.on('end', () => {
      // Tunnel closed silently
    });
  }

  parseHostPort(hostPort) {
    const [hostname, port] = hostPort.split(':');
    return {
      hostname,
      port: parseInt(port) || 443
    };
  }

  truncateString(str, maxLength) {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength) + '...';
  }

  handleSSEResponse(requestId, proxyRes) {
    // Initialize SSE buffer for this request
    if (!this.sseBuffers) {
      this.sseBuffers = new Map();
    }
    this.sseBuffers.set(requestId, '');
    
    // Set up event listeners for SSE stream lifecycle
    proxyRes.on('close', () => {
      this.sseBuffers.delete(requestId);
    });
    
    proxyRes.on('error', (error) => {
      this.sseBuffers.delete(requestId);
    });
  }

  parseSSEChunk(requestId, chunk) {
    // Get or initialize buffer for this request
    if (!this.sseBuffers) {
      this.sseBuffers = new Map();
    }
    
    let buffer = this.sseBuffers.get(requestId) || '';
    buffer += chunk;
    
    // Split by double newlines to separate events
    const events = buffer.split('\n\n');
    
    // Keep the last incomplete event in buffer
    buffer = events.pop() || '';
    this.sseBuffers.set(requestId, buffer);
    
    // Process complete events
    events.forEach(eventData => {
      if (eventData.trim()) {
        this.logSSEEvent(requestId, eventData);
      }
    });
  }

  logSSEEvent(requestId, eventData) {
    const lines = eventData.split('\n');
    const event = {
      type: 'message',
      data: '',
      id: null,
      retry: null
    };
    
    // Parse SSE event fields
    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return;
      
      const field = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      switch (field) {
        case 'event':
          event.type = value;
          break;
        case 'data':
          event.data += (event.data ? '\n' : '') + value;
          break;
        case 'id':
          event.id = value;
          break;
        case 'retry':
          event.retry = parseInt(value, 10);
          break;
      }
    });
    
    // Parse SSE event silently
    // Event data is processed but not logged
  }

  analyzeTraffic(requestId, data, direction) {
    // Traffic analysis runs silently
    // Data is processed but not logged
  }

  isPrintableData(str) {
    // Check if string contains mostly printable ASCII characters
    const printableCount = str.split('').filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126;
    }).length;
    
    return printableCount / str.length > 0.7; // 70% printable threshold
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    
    // Clean up SSE buffers
    if (this.sseBuffers) {
      this.sseBuffers.clear();
    }
  }
}

export default ProxyServer;