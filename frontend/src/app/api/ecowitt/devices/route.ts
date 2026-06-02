import { NextRequest, NextResponse } from 'next/server';
import { callEcowittApi } from '../../../../lib/ecowitt-client';
import { pool } from '../../../../lib/db';
import { requireRoleFromRequest } from '../../../../lib/server-auth';

interface DeviceInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

async function ensureDeviceTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecowitt_device (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(32) NOT NULL UNIQUE,
      name VARCHAR(255) DEFAULT '',
      lat DOUBLE DEFAULT 0,
      lng DOUBLE DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function getRegisteredDevices(): Promise<DeviceInfo[]> {
  const [rows] = await pool.query(
    `SELECT device_id AS id, name, lat, lng FROM ecowitt_device ORDER BY device_id ASC`,
  );
  return rows as DeviceInfo[];
}

export async function GET(request: NextRequest) {
  try {
    await ensureDeviceTable();
    const idsParam = request.nextUrl.searchParams.get('ids');
    let registered = await getRegisteredDevices();

    let deviceIds: DeviceInfo[] = [];

    if (idsParam) {
      const customIds = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
      for (const cid of customIds) {
        const existing = registered.find((r) => r.id === cid);
        if (existing) {
          deviceIds.push(existing);
        } else {
          deviceIds.push({ id: cid, name: cid, lat: 0, lng: 0 });
        }
      }
    } else if (registered.length > 0) {
      deviceIds = [...registered];
    } else {
      const [rows] = await pool.query(
        `SELECT DISTINCT device_id FROM ecowitt WHERE device_id IS NOT NULL AND device_id != '' ORDER BY device_id ASC`,
      );
      const fallback = (rows as Array<{ device_id: string }>).map((r) => ({
        id: r.device_id,
        name: r.device_id,
        lat: 0,
        lng: 0,
      }));
      deviceIds = fallback.length > 0 ? fallback : [];
    }

    const results: DeviceInfo[] = [];

    for (const dev of deviceIds) {
      try {
        const result = await callEcowittApi('get_device_info', { device_id: dev.id });
        if (result.ok && result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
          const d = result.data as Record<string, unknown>;
          if (String(d.errcode ?? d.code ?? 0) === '0') {
            const info = d.info ?? d.data ?? d;
            const infoObj = typeof info === 'object' && info !== null ? (info as Record<string, unknown>) : {};
            const lat = parseFloat(String(infoObj.latitude ?? infoObj.lat ?? infoObj.latitudedec ?? 0));
            const lng = parseFloat(String(infoObj.longitude ?? infoObj.lng ?? infoObj.longitudedec ?? 0));
            const resolved: DeviceInfo = {
              id: dev.id,
              name: dev.name || String(infoObj.name ?? infoObj.stationname ?? infoObj.device_name ?? dev.id),
              lat: isNaN(lat) ? 0 : lat,
              lng: isNaN(lng) ? 0 : lng,
            };
            results.push(resolved);
            continue;
          }
        }
      } catch {
        // fallback to local data
      }
      results.push(dev);
    }

    return NextResponse.json({ source: 'ecowitt', devices: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Ecowitt devices error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);
    await ensureDeviceTable();
    const body = await request.json();
    const deviceId = String(body.deviceId || body.device_id || '').trim();
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    }

    let name = String(body.name || deviceId);
    let lat = parseFloat(String(body.lat ?? 0));
    let lng = parseFloat(String(body.lng ?? 0));
    if (isNaN(lat)) lat = 0;
    if (isNaN(lng)) lng = 0;

    await pool.query(
      `INSERT INTO ecowitt_device (device_id, name, lat, lng)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), lat = VALUES(lat), lng = VALUES(lng)`,
      [deviceId, name, lat, lng],
    );

    return NextResponse.json({ success: true, device: { id: deviceId, name, lat, lng } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Ecowitt register device error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);
    await ensureDeviceTable();
    const body = await request.json();
    const deviceId = String(body.deviceId || body.device_id || '').trim();
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    }

    if (body.name !== undefined) {
      await pool.query(`UPDATE ecowitt_device SET name = ? WHERE device_id = ?`, [String(body.name), deviceId]);
    }
    if (body.lat !== undefined || body.lng !== undefined) {
      const lat = parseFloat(String(body.lat ?? 0));
      const lng = parseFloat(String(body.lng ?? 0));
      await pool.query(`UPDATE ecowitt_device SET lat = ?, lng = ? WHERE device_id = ?`, [
        isNaN(lat) ? 0 : lat,
        isNaN(lng) ? 0 : lng,
        deviceId,
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Ecowitt update device error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);
    await ensureDeviceTable();
    const deviceId = request.nextUrl.searchParams.get('id');
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing device id' }, { status: 400 });
    }
    await pool.query(`DELETE FROM ecowitt_device WHERE device_id = ?`, [deviceId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
