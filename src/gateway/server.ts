import { randomUUID } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { config, requireOpenAIKey } from '../config';
import { Session } from '../runtime/session';
import { closeSandboxSession, getSandboxSession } from '../sandbox/session';

// --- HTML/JS served verbatim (no build step) ---

const CLIENT = fileURLToPath(new URL('../../web/index.html', import.meta.url));

// --- In-flight approval request ---

type PendingApproval = {
  resolve: (approved: boolean) => void;
};

// --- Per-connection state ---

type Client = {
  ws: WebSocket;
  session: Session;
  /** One per connection: the Session serializes turns, so at most one
   *  approval is in flight at a time. */
  pendingApproval: PendingApproval | null;
};

export function startGateway(port = config.gatewayPort): { close: () => Promise<void> } {
  requireOpenAIKey();

  const sandboxSessionPromise = getSandboxSession();
  const clients = new Set<Client>();

  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await readFile(CLIENT));
      return;
    }
    notFound(res);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws) => {
    const sandboxSession = await sandboxSessionPromise;
    const client: Client = {
      ws,
      session: new Session(randomUUID(), sandboxSession),
      pendingApproval: null,
    };
    clients.add(client);

    ws.on('message', (data) => {
      const raw = data.toString();
      if (raw.trim()) {
        void handleMessage(client, raw).catch((error) => {
          send(client, { type: 'error', error: String(error?.message ?? error) });
        });
      }
    });
    ws.on('close', () => {
      if (client.pendingApproval) client.pendingApproval.resolve(false);
      clients.delete(client);
    });
    ws.on('error', () => {
      /* the close handler runs after */
    });
  });

  async function handleMessage(client: Client, raw: string) {
    let message: { type?: string; id?: string; text?: string; approved?: boolean };
    try {
      message = JSON.parse(raw);
    } catch {
      send(client, { type: 'error', error: 'invalid JSON' });
      return;
    }

    switch (message.type) {
      case 'message':
        await handleUserMessage(client, message.id ?? '', message.text ?? '');
        return;
      case 'approval':
        handleApprovalDecision(client, message.id ?? '', message.approved === true);
        return;
      case 'reset':
        await client.session.reset();
        send(client, { type: 'reset_done' });
        return;
      default:
        send(client, { type: 'error', error: `unknown message type: ${message.type}` });
    }
  }

  async function handleUserMessage(client: Client, id: string, text: string) {
    const { speaker, output } = await client.session.handleMessage(
      text,
      async ({ description, interruption }) => {
        const approvalId = randomUUID();
        send(client, {
          type: 'approval_required',
          id: approvalId,
          description,
          tool: interruption.name ?? 'tool',
        });
        const approved = await new Promise<boolean>((resolve) => {
          client.pendingApproval = { resolve };
        });
        client.pendingApproval = null;
        return approved;
      },
    );
    send(client, { type: 'response', id, speaker, output });
  }

  function handleApprovalDecision(client: Client, id: string, approved: boolean) {
    const pending = client.pendingApproval;
    if (!pending) return;
    // A connection has at most one in-flight approval, so resolving it is
    // unambiguous. Keep the id parameter for a future multi-approval protocol.
    void id;
    pending.resolve(approved);
  }

  function send(client: Client, payload: unknown) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(payload));
    }
  }

  function notFound(res: ServerResponse) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }

  server.listen(port, '127.0.0.1');

  return {
    close: async () => {
      for (const client of clients) client.ws.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closeSandboxSession();
    },
  };
}
