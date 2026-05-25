import { NextResponse } from 'next/server';
import { listRasterLayers } from '../../../lib/constants/raster-layers';

export async function GET() {
  return NextResponse.json({
    layers: listRasterLayers(),
  });
}
