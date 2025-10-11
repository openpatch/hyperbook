import { Node, Edge, Box } from "@xyflow/react";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UnlockCondition {
  after?: string[];
  date?: string;
  password?: string;
}

export interface Completion {
  needs?: string[];
  optional?: string[];
}

export interface NodeData {
  state: "locked" | "unlocked" | "started" | "completed" | "mastered";
  label: string;
  description?: string;
  duration?: string;
  unlock?: UnlockCondition;
  completion?: Completion;
  video?: string;
  resources?: { label: string; url: string }[];
  summary?: string;
  [key: string]: any;
}

export interface ImageNodeData {
  data?: string; // base64 encoded image
}

export interface TextNodeData {
  text?: string;
  fontSize?: number;
  color?: string;
  rotation?: number;
}

export type BackgroundNodeData = ImageNodeData | TextNodeData;

export interface BackgroundConfig {
  color?: string;
  nodes?: Node<BackgroundNodeData>[];
}

export interface Settings {
  title?: string;
  background?: BackgroundConfig;
  language?: string;
}

export interface EdgeConfig {
  animated?: boolean;
  color?: string;
  width?: number;
  type?: string;
}

export interface RoadmapData {
  nodes?: Node<NodeData>[];
  edges?: Edge[];
  settings: Settings;
  version: number;
}

export interface RoadmapState {
  nodes: Record<string, { state: string }>;
  x: number;
  y: number;
  zoom: number;
}

export type Orientation = "horizontal" | "vertical";

export type HelperLine = {
  // Used to filter out helper lines corresponding to the node being dragged
  node: Node;
  // We use it to check that the helper line is within the viewport.
  nodeBox: Box;
  // 0 for horizontal, 1 for vertical
  orientation: Orientation;
  // If orientation is 'horizontal', `position` holds the Y coordinate of the helper line.
  // (Might correspond to the top or bottom position of a node, or other anchors).
  // If orientation is 'vertical', `position` holds the X coordinate of the helper line.
  position: number;
  // Optional color for the helper line
  color?: string;
  anchorName: string;
};
