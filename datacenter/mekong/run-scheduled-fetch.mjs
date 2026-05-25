#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DEFAULT_HOURS = [0, 5, 10, 15, 20];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DATACENTER_ROOT = resolve(SCRIPT_DIR, '..');
const FETCH_SCRIPT = resolve(SCRIPT_DIR, 'fetch-mekong-data.mjs');

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--once') {
      args.once = true;
      continue;
    }

    if (!token.startsWith('--')) {
      continue;
    }

    const [flag, inlineValue] = token.split('=', 2);
    const key = flag.slice(2);

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      args[key] = nextValue;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

function parseHours(value) {
  const hours = String(value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);

  const uniqueHours = [...new Set(hours)].sort((left, right) => left - right);
  if (!uniqueHours.length) {
    throw new Error('No valid hours provided. Expected a comma-separated list from 0 to 23.');
  }

  return uniqueHours;
}

function formatLocalDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getNextRunDate(now, hours) {
  const normalizedNow = new Date(now);
  normalizedNow.setMilliseconds(0);

  for (const hour of hours) {
    const candidate = new Date(normalizedNow);
    candidate.setHours(hour, 0, 0, 0);
    if (candidate >= normalizedNow) {
      return candidate;
    }
  }

  const nextDay = new Date(normalizedNow);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(hours[0], 0, 0, 0);
  return nextDay;
}

function printUsage() {
  console.log(`Usage:
  node datacenter/mekong/run-scheduled-fetch.mjs [--hours 0,5,10,15,20] [--once]

Runs the existing Mekong fetch script at the given local hours and writes data to the
current MySQL structure without changing the persistence flow.

Options:
  --hours  Comma-separated list of hours in 24h format (default: 0,5,10,15,20)
  --once   Run one fetch immediately and exit
`);
}

function runFetchOnce() {
  return new Promise((resolve, reject) => {
    console.log(`[scheduler] start ${formatLocalDateTime(new Date())}`);

    const child = spawn(process.execPath, [FETCH_SCRIPT], {
      stdio: 'inherit',
      cwd: DATACENTER_ROOT,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Fetch script exited with code ${code}`));
    });
  });
}

async function waitUntil(targetDate) {
  const delay = Math.max(0, targetDate.getTime() - Date.now());
  if (delay === 0) {
    return;
  }

  console.log(`[scheduler] next run at ${formatLocalDateTime(targetDate)}`);
  await new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const hours = parseHours(args.hours ?? DEFAULT_HOURS.join(','));

  if (args.once) {
    await runFetchOnce();
    return;
  }

  console.log(`[scheduler] active hours: ${hours.join(', ')}`);

  while (true) {
    const nextRun = getNextRunDate(new Date(), hours);
    await waitUntil(nextRun);

    try {
      await runFetchOnce();
    } catch (error) {
      console.error(`[scheduler] ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
