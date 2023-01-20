import { TocProps } from "@hyperbook/toc";
import { HyperbookJson, Navigation } from "@hyperbook/types";

export interface WriteEvent {
  path: string;
  content: string;
  rootFolder?: string;
  basePath?: string;
}

export interface FileChangedEvent {
  content: string;
  data: Record<string, any>;
  navigation?: Navigation;
  toc?: TocProps;
  assetsPath?: string;
}

export interface ConfigChangeEvent extends HyperbookJson {}

export interface OpenFileEvent {
  path: string;
  rootFolder?: string;
  basePath?: string;
}

export interface AppReadyEvent {}
