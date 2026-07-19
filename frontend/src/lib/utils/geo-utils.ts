import type OLGeometry from "ol/geom/Geometry";

const areaCache = new WeakMap<OLGeometry, number>();

export function computePolygonAreaHa(geom: OLGeometry | null | undefined): number {
  if (!geom) return 0;
  const cached = areaCache.get(geom);
  if (cached !== undefined) return cached;

  try {
    const gt = geom.getType();
    if (gt !== 'Polygon' && gt !== 'MultiPolygon') { areaCache.set(geom, 0); return 0; }
    const raw = (geom as any).getCoordinates() as any[];
    const polys = gt === 'MultiPolygon' ? raw : [raw];
    let a = 0;
    for (let p = 0; p < polys.length; p++) {
      const ring = polys[p][0] as number[][];
      for (let i = 0; i < ring.length - 1; i++) {
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      }
    }
    const result = Math.abs(a) / 20000;
    areaCache.set(geom, result);
    return result;
  } catch {
    areaCache.set(geom, 0);
    return 0;
  }
}
