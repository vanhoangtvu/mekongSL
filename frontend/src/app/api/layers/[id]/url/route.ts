import { NextResponse } from 'next/server';
import { getRasterLayerById } from '../../../../../lib/constants/raster-layers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const layer = getRasterLayerById(id);

  if (!layer) {
    return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
  }

  const url = layer.previewUrl.startsWith('/')
    ? layer.previewUrl
    : `https://storage.example.com/${layer.cloudPath}`;

  return NextResponse.json({
    id: layer.id,
    url,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    crs: layer.crs,
  });
}
