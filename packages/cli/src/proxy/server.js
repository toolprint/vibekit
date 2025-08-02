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
                console.log(chalk.yellow(`[proxy] Warning: Invalid regex for ${patternObj.pattern.name}: ${error.message}`));
              }
            }
          });
        }
      }
      
      console.log(chalk.green(`[proxy] Loaded ${Object.keys(patterns).length} sensitive data patterns`));
      return patterns;
    } catch (error) {
      console.log(chalk.red(`[proxy] Error loading patterns: ${error.message}`));
      console.log(chalk.yellow(`[proxy] Falling back to basic patterns`));
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
        console.log(chalk.green(`🔄 Vibekit Proxy Server running on http://localhost:${this.port}`));
        console.log(chalk.blue(`📊 Logging all HTTP/HTTPS traffic (including SSE streams)`));
        console.log(chalk.yellow(`🔗 Configure your application to use HTTP proxy: http://localhost:${this.port}`));
        console.log(chalk.magenta(`🌊 For SSE support, ensure your requests use HTTP or configure HTTPS certificate handling`));
        console.log(chalk.gray(`Press Ctrl+C to stop\n`));
        resolve();
      });

      this.server.on('error', (error) => {
        console.error(chalk.red(`❌ Proxy server error: ${error.message}`));
        reject(error);
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n📴 Shutting down proxy server...'));
        this.server.close(() => {
          console.log(chalk.green('✅ Proxy server stopped'));
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
    
    console.log(chalk.cyan(`\n[${requestId}] 📤 HTTP ${req.method} ${req.url}`));
    console.log(chalk.gray(`[${requestId}] Headers:`, JSON.stringify(req.headers, null, 2)));

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
      console.log(chalk.red(`[${requestId}] ❌ Invalid URL: ${req.url}`));
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

    console.log(chalk.blue(`[${requestId}] 🎯 Proxying to: ${targetUrl.hostname}:${options.port}`));

    // Choose http or https module
    const httpModule = targetUrl.protocol === 'https:' ? https : http;

    // Capture request body
    let requestBody = '';
    req.on('data', (chunk) => {
      requestBody += chunk.toString();
    });

    req.on('end', () => {
      if (requestBody) {
        console.log(chalk.magenta(`[${requestId}] 📝 Request Body:`));
        console.log(requestBody);
      }
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
                console.log(chalk.red(`[${requestId}] 🚨 Detected ${type}: ${matches.length} match(es) - redacting`));
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
                console.log(chalk.red(`[${requestId}] 🚨 Detected ${type} in final buffer: ${matches.length} match(es) - redacting`));
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
      console.log(chalk.green(`[${requestId}] 📥 Response ${proxyRes.statusCode} from ${targetUrl.hostname}`));
      console.log(chalk.gray(`[${requestId}] Response Headers:`, JSON.stringify(proxyRes.headers, null, 2)));

      // Check if this is an SSE response
      const isSSE = proxyRes.headers['content-type']?.includes('text/event-stream');
      
      if (isSSE) {
        console.log(chalk.magenta(`[${requestId}] 🌊 SSE Stream detected - listening for events...`));
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
        if (!isSSE && responseBody) {
          console.log(chalk.yellow(`[${requestId}] 📄 Response Body:`));
          console.log(responseBody);
        }
        
        if (isSSE) {
          console.log(chalk.magenta(`[${requestId}] 🌊 SSE Stream ended`));
        }
        
        console.log(chalk.gray(`[${requestId}] ✅ Request completed\n`));
      });

      // Forward the response through sensitive data filter
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      const sensitiveFilter = createSensitiveDataFilter(requestId);
      proxyRes.pipe(sensitiveFilter).pipe(res);
    });

    // Handle proxy request errors
    proxyReq.on('error', (error) => {
      console.log(chalk.red(`[${requestId}] ❌ Proxy error: ${error.message}`));
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Proxy Error: ' + error.message);
    });

    // Forward the request body
    req.pipe(proxyReq);
  }

  handleHttpsConnect(req, clientSocket, head) {
    this.requestCount++;
    const requestId = this.requestCount;
    
    console.log(chalk.cyan(`\n[${requestId}] 🔒 HTTPS CONNECT to ${req.url}`));

    const { hostname, port } = this.parseHostPort(req.url);
    console.log(chalk.blue(`[${requestId}] 🎯 Tunneling to: ${hostname}:${port}`));

    const serverSocket = new net.Socket();

    serverSocket.connect(port, hostname, () => {
      console.log(chalk.green(`[${requestId}] ✅ HTTPS tunnel established`));
      
      // Send connection established response
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      
      // Set up bidirectional pipe
      if (head && head.length) {
        serverSocket.write(head);
      }
      
      // Log data flowing through the tunnel with enhanced detection
      clientSocket.on('data', (data) => {
        console.log(chalk.magenta(`[${requestId}] 📤 Client->Server: ${data.length} bytes`));
        this.analyzeTraffic(requestId, data, 'client->server');
      });

      serverSocket.on('data', (data) => {
        console.log(chalk.yellow(`[${requestId}] 📥 Server->Client: ${data.length} bytes`));
        this.analyzeTraffic(requestId, data, 'server->client');
      });

      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (error) => {
      console.log(chalk.red(`[${requestId}] ❌ HTTPS tunnel error: ${error.message}`));
      clientSocket.end();
    });

    clientSocket.on('error', (error) => {
      console.log(chalk.red(`[${requestId}] ❌ Client socket error: ${error.message}`));
      serverSocket.end();
    });

    serverSocket.on('end', () => {
      console.log(chalk.gray(`[${requestId}] 🔚 HTTPS tunnel closed\n`));
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
      console.log(chalk.magenta(`[${requestId}] 🌊 SSE connection closed`));
      this.sseBuffers.delete(requestId);
    });
    
    proxyRes.on('error', (error) => {
      console.log(chalk.red(`[${requestId}] ❌ SSE stream error: ${error.message}`));
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
    
    // Log the parsed SSE event
    console.log(chalk.blue(`[${requestId}] 📡 SSE Event:`));
    console.log(chalk.cyan(`  Type: ${event.type}`));
    if (event.id) console.log(chalk.cyan(`  ID: ${event.id}`));
    if (event.retry) console.log(chalk.cyan(`  Retry: ${event.retry}ms`));
    
    // Display data with proper formatting
    if (event.data) {
      try {
        // Try to parse as JSON for better formatting
        const jsonData = JSON.parse(event.data);
        console.log(chalk.yellow(`  Data (JSON):`));
        console.log(chalk.gray(JSON.stringify(jsonData, null, 2)));
      } catch {
        // Display as text if not JSON
        console.log(chalk.yellow(`  Data: ${this.truncateString(event.data, 300)}`));
      }
    }
    
    console.log(chalk.gray(`  ─────────────────────────────────────`));
  }

  analyzeTraffic(requestId, data, direction) {
    const dataStr = data.toString('utf8', 0, Math.min(data.length, 500));
    
    // Check if this looks like HTTP request/response
    if (dataStr.includes('HTTP/1.1') || dataStr.includes('HTTP/2')) {
      console.log(chalk.blue(`[${requestId}] 🔍 HTTP traffic detected in tunnel`));
      
      // Check for SSE-related headers
      if (dataStr.includes('text/event-stream') || dataStr.includes('Accept: text/event-stream')) {
        console.log(chalk.magenta(`[${requestId}] 🌊 SSE headers detected in encrypted tunnel`));
        console.log(chalk.yellow(`[${requestId}] ⚠️  SSE content cannot be parsed due to HTTPS encryption`));
        console.log(chalk.gray(`[${requestId}] 💡 Consider using HTTP endpoints for full SSE monitoring`));
      }
      
      // Show readable HTTP headers if available
      const lines = dataStr.split('\n');
      const httpLine = lines.find(line => line.includes('HTTP/'));
      if (httpLine) {
        console.log(chalk.cyan(`[${requestId}] HTTP: ${httpLine.trim()}`));
      }
      
      // Show some headers
      const headers = lines.slice(1, 5).filter(line => line.includes(':')).map(h => h.trim());
      if (headers.length > 0) {
        console.log(chalk.gray(`[${requestId}] Headers: ${headers.join(', ')}`));
      }
    } else if (data.length < 100 && this.isPrintableData(dataStr)) {
      // Show small printable data
      console.log(chalk.gray(`[${requestId}] Data: ${this.truncateString(dataStr, 100)}`));
    } else {
      // Show first few bytes in hex for binary data
      const hexBytes = Array.from(data.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(chalk.gray(`[${requestId}] Binary data (hex): ${hexBytes}${data.length > 16 ? '...' : ''}`));
    }
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