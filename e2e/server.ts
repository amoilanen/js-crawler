import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer(): express.Express {
  const app = express();

  app.use(express.static(path.join(__dirname, 'static')));

  // Redirect chain: redirect1 → redirect2 → redirect3 → redirectend
  app.get('/redirect1', (_req, res) => {
    res.redirect('/redirect2');
  });

  app.get('/redirect2', (_req, res) => {
    res.redirect('/redirect3');
  });

  app.get('/redirect3', (_req, res) => {
    res.redirect('/redirectend');
  });

  app.get('/redirectend', (_req, res) => {
    res.send('End of redirect chain <a href="redirect2">To middle of redirect chain</a>');
  });

  // Shortened URL redirects (302, 301, 307)
  app.get('/shortened', (_req, res) => {
    res.redirect('/graph_no_cycles/page1.html');
  });

  app.get('/bitly-shortened', (_req, res) => {
    res.redirect(301, '/graph_no_cycles/page1.html');
  });

  app.get('/google-shortened', (_req, res) => {
    res.redirect(307, '/graph_no_cycles/page1.html');
  });

  // Binary content endpoint (1x1 PNG pixel)
  app.get('/binary/image.png', (_req, res) => {
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    res.set('Content-Type', 'image/png');
    res.send(pixel);
  });

  // Slow endpoint for timeout testing
  app.get('/slow', (req, res) => {
    const delay = parseInt(req.query.delay as string) || 5000;
    setTimeout(() => {
      res.send('<html><body>Slow page</body></html>');
    }, delay);
  });

  // Custom headers echo endpoint
  app.get('/echo-headers', (req, res) => {
    res.json(req.headers);
  });

  // Retry endpoint: drops connection N times then succeeds
  const retryCounts = new Map<string, number>();
  app.get('/retry', (req, res) => {
    const key = req.query.key as string || 'default';
    const failCount = parseInt(req.query.failCount as string) || 1;
    const count = retryCounts.get(key) || 0;
    retryCounts.set(key, count + 1);

    if (count < failCount) {
      // Destroy the socket to cause a network error (retryable)
      req.socket.destroy();
    } else {
      retryCounts.delete(key);
      res.set('Content-Type', 'text/html');
      res.send('<html><body>Retry success</body></html>');
    }
  });

  // Robots.txt endpoint
  app.get('/robots.txt', (_req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send('User-agent: *\nDisallow: /blocked/\n');
  });

  // Blocked path that robots.txt disallows
  app.get('/blocked/page.html', (_req, res) => {
    res.send('<html><body>Blocked page</body></html>');
  });

  return app;
}

let server: Server | null = null;

export function startServer(port = 3000): Promise<Server> {
  return new Promise((resolve) => {
    const app = createServer();
    server = app.listen(port, () => {
      resolve(server!);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
      server = null;
    } else {
      resolve();
    }
  });
}
