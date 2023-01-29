import { Range } from "vscode";
import { TocProps } from "@hyperbook/toc";
import { HyperbookJson, Navigation } from "@hyperbook/types";

export interface WriteMessage {
  type: "WRITE";
  payload: {
    path: string;
    content: string;
    rootFolder?: string;
    basePath?: string;
  };
}

export interface ChangeMessage {
  type: "CHANGE";
  payload: {
    content: string;
    data: Record<string, any>;
    navigation?: Navigation;
    assetsPath: string;
    toc?: TocProps;
  };
}

export interface ConfigChangeMessage {
  type: "CONFIG_CHANGE";
  payload: HyperbookJson;
}

export interface OpenMessage {
  type: "OPEN";
  payload: {
    path: string;
    rootFolder?: string;
    basePath?: string;
  };
}

export interface ScrollFromWebViewMessage {
  type: "SCROLL_FROM_WEBVIEW";
  payload: {
    line: number;
  };
}

export interface ScrollFromExtensionMessage {
  type: "SCROLL_FROM_EXTENSION";
  payload: {
    line: readonly Range[];
    source: {
      lineCount: number;
    };
  };
}

export interface ReadyMessage {
  type: "READY";
}

export type Message =
  | ChangeMessage
  | ReadyMessage
  | ConfigChangeMessage
  | WriteMessage
  | OpenMessage
  | ScrollFromWebViewMessage
  | ScrollFromExtensionMessage;
