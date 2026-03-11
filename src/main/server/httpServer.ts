import { createServer, type Server } from 'node:http';

export interface InternalHttpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  getPort(): number;
}

export function createInternalHttpServer(port: number): InternalHttpServer {
  let server: Server | null = null;

  return {
    async start() {
      if (server) return;

      server = createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      await new Promise<void>((resolve, reject) => {
        server?.once('error', reject);
        server?.listen(port, () => resolve());
      });
    },
    async stop() {
      if (!server) return;

      const activeServer = server;
      server = null;

      await new Promise<void>((resolve, reject) => {
        activeServer.close((err) => (err ? reject(err) : resolve()));
      });
    },
    getPort() {
      return port;
    }
  };
}
