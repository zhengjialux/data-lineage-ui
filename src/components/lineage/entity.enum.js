export const NODE_WIDTH = 400
export const NODE_HEIGHT = 90
export const FOREIGN_OBJECT_SIZE = 40;
export const ZOOM_VALUE = 0.65;
export const MIN_ZOOM_VALUE = 0.1;
export const MAX_ZOOM_VALUE = 2.5;
export const ZOOM_SLIDER_STEP = 0.1;
export const ZOOM_BUTTON_STEP = 0.25;
export const ZOOM_TRANSITION_DURATION = 800;
export const DATATYPES_HAVING_SUBFIELDS = [
  'RECORD',
  'STRUCT',
  'ARRAY',
  'UNION',
];

export const PIPELINE_EDGE_WIDTH = 200;

export const EntityType = {
  TABLE: 'table',
  DASHBOARD: 'dashboard',
  MLMODEL: 'mlmodel',
  DASHBOARD_DATA_MODEL: 'dashboardDataModel',
  CONTAINER: 'container',
  TOPIC: 'topic',
  SEARCH_INDEX: 'searchIndex',
}

export const EntityLineageNodeType = {
  INPUT: 'input',
  OUTPUT: 'output',
  DEFAULT: 'default',
  NOT_CONNECTED: 'not-connected',
  LOAD_MORE: 'load-more',
}

export const Position = {
  Left: 'left',
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
}

export const MarkerType = {
  Arrow: 'arrow',
  ArrowClosed: 'arrowclosed',
}

export const EdgeTypeEnum = {
  UP_STREAM: 'upstream',
  DOWN_STREAM: 'downstream',
  NO_STREAM: '',
}

export const EntityLineageDirection = {
  TOP_BOTTOM: 'TB',
  LEFT_RIGHT: 'LR',
}
