import type OLGeometry from "ol/geom/Geometry";
import { getArea } from "ol/sphere";

const areaCache = new WeakMap<OLGeometry, number>();

export function computePolygonAreaHa(geom: OLGeometry | null | undefined): number {
  if (!geom) return 0;
  const cached = areaCache.get(geom);
  if (cached !== undefined) return cached;

  try {
    const gt = geom.getType();
    if (gt !== 'Polygon' && gt !== 'MultiPolygon') { areaCache.set(geom, 0); return 0; }
    // Geometry is in EPSG:3857 (Web Mercator), tell getArea so it can transform to lon/lat
    // before computing geodesic area. Without projection, getArea assumes EPSG:4326.
    const areaSqM = getArea(geom as any, { projection: 'EPSG:3857' });
    const result = areaSqM / 10000;
    areaCache.set(geom, result);
    return result;
  } catch {
    areaCache.set(geom, 0);
    return 0;
  }
}
