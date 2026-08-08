import * as fs from 'fs';
import * as path from 'path';

export interface SseClient {
  write(data: string): boolean;
  end(): void;
}

export interface SseHandler {
  addClient(client: SseClient): void;
  removeClient(client: SseClient): void;
  clientCount(): number;
  stop(): void;
}

export function buildSseHandler(jsonlPath: string): SseHandler {
  const clients: Set<SseClient> = new Set();
  let lastOffset = 0;
  let watcher: fs.FSWatcher | null = null;
  let dirWatcher: fs.FSWatcher | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  if (fs.existsSync(jsonlPath)) {
    lastOffset = fs.statSync(jsonlPath).size;
  }

  function broadcastNewLines(): void {
    if (clients.size === 0) return;

    let content: string;
    try {
      const fd = fs.openSync(jsonlPath, 'r');
      const stat = fs.fstatSync(fd);
      if (stat.size < lastOffset) {
        // File was truncated/recreated (e.g. new test run) — reset
        lastOffset = 0;
      }
      if (stat.size <= lastOffset) {
        fs.closeSync(fd);
        return;
      }
      const buf = Buffer.alloc(stat.size - lastOffset);
      fs.readSync(fd, buf, 0, buf.length, lastOffset);
      fs.closeSync(fd);
      lastOffset = stat.size;
      content = buf.toString('utf-8');
    } catch {
      return;
    }

    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const message = `data: ${line}\n\n`;
      for (const client of clients) {
        try {
          client.write(message);
        } catch {
          clients.delete(client);
        }
      }
    }
  }

  function startFileWatcher(): void {
    if (watcher) return;
    try {
      watcher = fs.watch(jsonlPath, (event) => {
        if (event === 'rename') {
          // File was replaced — restart watcher
          watcher?.close();
          watcher = null;
          lastOffset = 0;
          if (fs.existsSync(jsonlPath)) {
            startFileWatcher();
            broadcastNewLines();
          } else {
            // File deleted, watch directory for recreation
            startDirWatcher();
          }
          return;
        }
        broadcastNewLines();
      });
    } catch {
      // ignore
    }
  }

  function startDirWatcher(): void {
    if (dirWatcher) return;
    const dir = path.dirname(jsonlPath);
    const base = path.basename(jsonlPath);
    try {
      dirWatcher = fs.watch(dir, (_event, filename) => {
        if (filename === base && fs.existsSync(jsonlPath) && !watcher) {
          lastOffset = 0;
          startFileWatcher();
          if (dirWatcher) {
            dirWatcher.close();
            dirWatcher = null;
          }
          broadcastNewLines();
        }
      });
    } catch {
      // Parent dir doesn't exist yet
    }
  }

  // Watch the file if it exists, otherwise watch the parent directory for creation
  if (fs.existsSync(jsonlPath)) {
    startFileWatcher();
  } else {
    startDirWatcher();
  }

  // Polling fallback: fs.watch is unreliable on macOS for file creation in large dirs.
  // Poll every 500ms to catch new data regardless of watcher state.
  // Skip polling when no clients are connected to avoid unnecessary I/O.
  pollInterval = setInterval(() => {
    if (clients.size === 0) return;
    if (!fs.existsSync(jsonlPath)) return;
    if (!watcher) {
      lastOffset = 0;
      startFileWatcher();
    }
    broadcastNewLines();
  }, 500);

  return {
    addClient(client: SseClient) {
      clients.add(client);
      if (fs.existsSync(jsonlPath)) {
        try {
          const content = fs.readFileSync(jsonlPath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          for (const line of lines) {
            client.write(`data: ${line}\n\n`);
          }
        } catch {
          // ignore
        }
      }
    },
    removeClient(client: SseClient) {
      clients.delete(client);
    },
    clientCount() {
      return clients.size;
    },
    stop() {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      if (dirWatcher) {
        dirWatcher.close();
        dirWatcher = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      clients.clear();
    },
  };
}
