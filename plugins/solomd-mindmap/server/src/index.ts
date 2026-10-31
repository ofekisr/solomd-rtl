#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { parseArgs } from './config.ts';
import { createServer, SERVER_NAME } from './server.ts';

const cfg = parseArgs(process.argv.slice(2));
serveStdio(() => createServer(cfg));
console.error(`${SERVER_NAME} on stdio, workspace ${cfg.workspace}${cfg.allowWrite ? ' (writes on)' : ''}`);
