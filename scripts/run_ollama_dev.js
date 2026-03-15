#!/usr/bin/env node

import { spawn } from 'child_process';

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const HEALTH_URL = `${OLLAMA_BASE_URL}/api/tags`;

async function isOllamaReachable() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function keepAlive(message) {
  console.log(message);
  const timer = setInterval(() => {}, 60_000);
  const shutdown = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main() {
  if (await isOllamaReachable()) {
    keepAlive(`Ollama already reachable at ${OLLAMA_BASE_URL}`);
    return;
  }

  console.log('Starting Ollama development server...');
  const child = spawn('ollama', ['serve'], {
    stdio: 'inherit',
    shell: true,
  });

  const shutdown = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('Failed to initialize Ollama:', error instanceof Error ? error.message : error);
  process.exit(1);
});
