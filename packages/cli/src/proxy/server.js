import http from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';
import chalk from 'chalk';

class ProxyServer {
  constructor(port = 8080) {
    this.port = port;
    this.server = null;
    this.requestCount = 0;
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
        console.log(chalk.blue(`📊 Logging all HTTP/HTTPS traffic`));
        console.log(chalk.yellow(`🔗 Use: vibekit --proxy http://localhost:${this.port} <agent> "<prompt>"`));
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

    // Parse the target URL
    let targetUrl;
    try {
      targetUrl = new URL(req.url);
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
      headers: { ...req.headers }
    };

    // Remove proxy-specific headers
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
        console.log(chalk.magenta(`[${requestId}] 📝 Request Body: ${this.truncateString(requestBody, 500)}`));
      }
    });

    // Make the proxied request
    const proxyReq = httpModule.request(options, (proxyRes) => {
      console.log(chalk.green(`[${requestId}] 📥 Response ${proxyRes.statusCode} from ${targetUrl.hostname}`));
      console.log(chalk.gray(`[${requestId}] Response Headers:`, JSON.stringify(proxyRes.headers, null, 2)));

      // Capture response body
      let responseBody = '';
      proxyRes.on('data', (chunk) => {
        responseBody += chunk.toString();
      });

      proxyRes.on('end', () => {
        if (responseBody) {
          console.log(chalk.yellow(`[${requestId}] 📄 Response Body: ${this.truncateString(responseBody, 500)}`));
        }
        console.log(chalk.gray(`[${requestId}] ✅ Request completed\n`));
      });

      // Forward the response
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
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
      
      // Log data flowing through the tunnel (first 100 bytes only for privacy)
      clientSocket.on('data', (data) => {
        console.log(chalk.magenta(`[${requestId}] 📤 Client->Server: ${data.length} bytes`));
        if (data.length < 100) {
          console.log(chalk.gray(`[${requestId}] Data: ${this.truncateString(data.toString(), 100)}`));
        }
      });

      serverSocket.on('data', (data) => {
        console.log(chalk.yellow(`[${requestId}] 📥 Server->Client: ${data.length} bytes`));
        if (data.length < 100) {
          console.log(chalk.gray(`[${requestId}] Data: ${this.truncateString(data.toString(), 100)}`));
        }
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

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

export default ProxyServer;