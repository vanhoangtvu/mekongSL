import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRoleFromRequest } from '../../../../lib/server-auth';

const CONFIG_PATH = resolve(process.cwd(), '..', 'datacenter', 'config', 'schedule.json');

interface ScheduleEntry {
  cron: string;
  label: string;
}

interface ScheduleConfig {
  ecowitt: ScheduleEntry;
  mekong: ScheduleEntry;
}

async function readSchedule(): Promise<ScheduleConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as ScheduleConfig;
  } catch {
    const defaults: ScheduleConfig = {
      ecowitt: { cron: '*/15 * * * *', label: 'Mỗi 15 phút' },
      mekong: { cron: '0 0,5,10,15,20 * * *', label: '0h, 5h, 10h, 15h, 20h hàng ngày' },
    };
    return defaults;
  }
}

export async function GET() {
  const config = await readSchedule();
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json() as Partial<ScheduleConfig>;
    const current = await readSchedule();

    const validateCron = (cron: string): boolean => {
      if (typeof cron !== 'string') return false;
      const parts = cron.trim().split(/\s+/);
      if (parts.length !== 5) return false;
      const valid = (part: string) => /^(\*|([0-9]|[1-5][0-9])(,([0-9]|[1-5][0-9]))*|(\*\/[1-9][0-9]?))$/.test(part);
      return parts.every(valid);
    };

    const updated: ScheduleConfig = {
      ecowitt: {
        cron: body.ecowitt?.cron ?? current.ecowitt.cron,
        label: body.ecowitt?.label ?? current.ecowitt.label,
      },
      mekong: {
        cron: body.mekong?.cron ?? current.mekong.cron,
        label: body.mekong?.label ?? current.mekong.label,
      },
    };

    if (!validateCron(updated.ecowitt.cron)) {
      return NextResponse.json({ error: 'Ecowitt cron expression không hợp lệ' }, { status: 400 });
    }
    if (!validateCron(updated.mekong.cron)) {
      return NextResponse.json({ error: 'Mekong cron expression không hợp lệ' }, { status: 400 });
    }

    await writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
