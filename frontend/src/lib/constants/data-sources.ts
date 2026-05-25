export type DataSourceKey = 'mekong' | 'ecowitt';

export interface DataSourceOption {
  key: DataSourceKey;
  label: string;
  outputFolder: string;
  fetchScript: string;
  resultFile: string;
  dataFile: string;
  defaultFile: string;
}

export const DATA_SOURCE_OPTIONS: DataSourceOption[] = [
  {
    key: 'mekong',
    label: 'Mekong',
    outputFolder: '../data/mekong/output',
    fetchScript: '../datacenter/mekong/fetch-mekong-data.mjs',
    resultFile: 'mekong-result.json',
    dataFile: 'mekong-data.csv',
    defaultFile: 'mekong-data.csv',
  },
  {
    key: 'ecowitt',
    label: 'Ecowitt',
    outputFolder: '../data/ecowitt/output',
    fetchScript: '../datacenter/ecowitt/fetch-ecowitt-data.mjs',
    resultFile: 'ecowitt-result.json',
    dataFile: 'ecowitt-data.csv',
    defaultFile: 'ecowitt-data.csv',
  },
];

export const DEFAULT_DATA_SOURCE: DataSourceKey = 'mekong';

export function normalizeDataSource(value: string | null | undefined): DataSourceKey {
  return value === 'ecowitt' ? 'ecowitt' : 'mekong';
}

export function getDataSourceOption(source: string | null | undefined): DataSourceOption {
  const normalized = normalizeDataSource(source);
  return DATA_SOURCE_OPTIONS.find((option) => option.key === normalized) ?? DATA_SOURCE_OPTIONS[0];
}

export function inferDataSourceFromFilename(filename: string): DataSourceKey {
  return filename.toLowerCase().startsWith('ecowitt') ? 'ecowitt' : 'mekong';
}
