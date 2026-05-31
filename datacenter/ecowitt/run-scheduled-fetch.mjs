#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DEFAULT_MINUTES = [0, 15, 30, 45];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DATACENTER_ROOT = resolve(SCRIPT_DIR, '..');
const FETCH_SCRIPT = resolve(SCRIPT_DIR, 'fetch-ecowitt-data.mjs');

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

function parseMinutes(value) {
  const minutes = String(value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((min) => Number.isInteger(min) && min >= 0 && min <= 59);

  const uniqueMinutes = [...new Set(minutes)].sort((left, right) => left - right);
  if (!uniqueMinutes.length) {
    throw new Error('No valid minutes provided. Expected a comma-separated list from 0 to 59.');
  }

  return uniqueMinutes;
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

function getNextRunDate(now, minutes) {
  const normalizedNow = new Date(now);
  normalizedNow.setMilliseconds(0);
  normalizedNow.setSeconds(0);

  for (const minute of minutes) {
    const candidate = new Date(normalizedNow);
    candidate.setMinutes(minute);
    if (candidate > normalizedNow) {
      return candidate;
    }
  }

  const nextHour = new Date(normalizedNow);
  nextHour.setHours(nextHour.getHours() + 1);
  nextHour.setMinutes(minutes[0]);
  return nextHour;
}

function printUsage() {
  console.log(`Usage:
  node datacenter/ecowitt/run-scheduled-fetch.mjs [--minutes 0,15,30,45] [--once]

Runs the existing Ecowitt fetch script at the given local minutes of every hour and writes data to the
current MySQL structure.

Options:
  --minutes  Comma-separated list of minutes in an hour (default: 0,15,30,45)
  --once     Run one fetch immediately and exit
`);
}

function runFetchOnce() {
  return new Promise((resolve, reject) => {
    console.log(`[scheduler-ecowitt] start ${formatLocalDateTime(new Date())}`);

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

  console.log(`[scheduler-ecowitt] next run at ${formatLocalDateTime(targetDate)}`);
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

  const minutes = parseMinutes(args.minutes ?? DEFAULT_MINUTES.join(','));

  if (args.once) {
    await runFetchOnce();
    return;
  }

  console.log(`[scheduler-ecowitt] active minutes: ${minutes.join(', ')}`);

  while (true) {
    const nextRun = getNextRunDate(new Date(), minutes);
    await waitUntil(nextRun);

    try {
      await runFetchOnce();
    } catch (error) {
      console.error(`[scheduler-ecowitt] ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
