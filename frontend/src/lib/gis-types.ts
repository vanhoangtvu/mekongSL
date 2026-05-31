export type GisLayer = {
  id: number;
  name: string;
  description: string;
  layerType: string;
  dataClass: string;
  status: string;
  epsgCode: number | null;
  bboxMinLon: number | null;
  bboxMinLat: number | null;
  bboxMaxLon: number | null;
  bboxMaxLat: number | null;
  source: string | null;
  updatedAt: string | null;
};

export type GisLayerRender = {
  id: number;
  name: string;
  layerType: string;
  dataClass: string;
  status: string;
  epsgCode: number | null;
  bboxMinLon: number | null;
  bboxMinLat: number | null;
  bboxMaxLon: number | null;
  bboxMaxLat: number | null;
  source: string | null;
  objectId: number | null;
  s3Key: string | null;
  signedUrl: string | null;
};

export type GisPageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};
