import { NextResponse } from 'next/server';
import { getRasterLayerById } from '../../../../lib/constants/raster-layers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const layer = getRasterLayerById(id);

  if (!layer) {
    return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
  }

  return NextResponse.json({
    layer,
  });
}
