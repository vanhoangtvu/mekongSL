#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const CONFIG_PATH = resolve(ROOT, 'config', 'schedule.json');
const LOG_DIR = resolve(ROOT, 'logs');

function parseCron(cronExpr) {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const expand = (part) => {
    if (part === '*') return null;
    if (part.includes('/')) {
      const [, step] = part.split('/');
      return { step: parseInt(step, 10) };
    }
    return new Set(part.split(',').map(Number));
  };
  return {
    minute: expand(parts[0]),
    hour: expand(parts[1]),
    dayOfMonth: expand(parts[2]),
    month: expand(parts[3]),
    dayOfWeek: expand(parts[4]),
  };
}

function matches(parsed, now) {
  if (!parsed) return false;
  const check = (part, value) => {
    if (part === null) return true;
    if (part.step) return value % part.step === 0;
    return part.has(value);
  };
  return (
    check(parsed.minute, now.getMinutes()) &&
    check(parsed.hour, now.getHours()) &&
    check(parsed.dayOfMonth, now.getDate()) &&
    check(parsed.month, now.getMonth() + 1) &&
    check(parsed.dayOfWeek, now.getDay())
  );
}

function runScript(scriptPath, label) {
  return new Promise((resolvePromise) => {
    const logPath = resolve(LOG_DIR, `${label}-cron.log`);
    const child = spawn(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => chunks.push(c));
    child.on('close', (code) => {
      const msg = chunks.join('').trim();
      if (code !== 0 || msg.includes('error')) {
        const timestamp = new Date().toISOString();
        appendFileSync(logPath, `[${timestamp}] exit=${code} ${msg}\n`);
      }
      resolvePromise();
    });
  });
}

async function main() {
  let config;
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    config = JSON.parse(raw);
  } catch (e) {
    appendFileSync(resolve(LOG_DIR, 'wrapper.log'), `[${new Date().toISOString()}] config error: ${e.message}\n`);
    return;
  }

  const now = new Date();
  const ecowittParsed = parseCron(config.ecowitt?.cron || '*/15 * * * *');
  const mekongParsed = parseCron(config.mekong?.cron || '0 0,5,10,15,20 * * *');

  appendFileSync(resolve(LOG_DIR, 'wrapper.log'), `[${now.toISOString()}] check ecowitt=${!!ecowittParsed} mekong=${!!mekongParsed}\n`);

  const tasks = [];
  if (matches(ecowittParsed, now)) {
    appendFileSync(resolve(LOG_DIR, 'wrapper.log'), `[${now.toISOString()}] run ecowitt\n`);
    tasks.push(runScript(resolve(ROOT, 'ecowitt/fetch-ecowitt-data.mjs'), 'ecowitt'));
  }
  if (matches(mekongParsed, now)) {
    appendFileSync(resolve(LOG_DIR, 'wrapper.log'), `[${now.toISOString()}] run mekong\n`);
    tasks.push(runScript(resolve(ROOT, 'mekong/fetch-mekong-data.mjs'), 'mekong'));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  } else {
    appendFileSync(resolve(LOG_DIR, 'wrapper.log'), `[${now.toISOString()}] nothing to run\n`);
  }
}

main().catch((e) => {
  appendFileSync(resolve(LOG_DIR, 'wrapper.log'), `[${new Date().toISOString()}] fatal: ${e.message}\n`);
});
