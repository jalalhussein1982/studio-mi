export enum AppStep {
  INITIALIZATION = 0,
  DATA_UPLOAD = 1,
  VARIABLE_SELECTION = 2,
  DATA_QUALITY = 3,
  OUTLIER_DETECTION = 4,
  UNIVARIATE_ANALYSIS = 5,
  BIVARIATE_ANALYSIS = 6,
  CORRELATION_ANALYSIS = 7,
}

export interface VariableInfo {
  name: string;
  type: 'numeric' | 'object' | 'datetime';
  missing_count: number;
  count: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  median?: number;
}

export interface OutlierInfo {
  column: string;
  count: number;
  indices: number[]; // Row indices of outliers
  values: number[];
}

export enum OutlierMethod {
  IQR = 'IQR',
  Z_SCORE = 'Z_SCORE',
  MODIFIED_Z = 'MODIFIED_Z',
}

export enum OutlierAction {
  IGNORE = 'ignore',
  DELETE = 'delete',
  WINSORIZE = 'winsorize',
  IMPUTE_MEAN = 'impute_mean',
  IMPUTE_MEDIAN = 'impute_median',
  TRANSFORM_LOG = 'log',
  TRANSFORM_SQRT = 'sqrt',
}

export interface DataIssue {
  row: number;
  column: string;
  value: any;
  issue: 'missing' | 'invalid';
}

export interface PyStatus {
  isReady: boolean;
  isLoading: boolean;
  message: string;
  progress: number;
}

export interface DatasetMetadata {
  rows: number;
  cols: number;
  columns: string[];
  summary: VariableInfo[];
}

export interface CorrelationData {
  variable: string;
  coefficient: number;
  p_value: number;
  ci_lower: number;
  ci_upper: number;
  n: number;
}

export interface PlotResult {
  png: string; // Base64
  svg: string; // SVG string
}
