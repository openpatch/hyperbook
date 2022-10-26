import { Range } from "vscode";

export interface WriteMessage {
  type: "WRITE";
  payload: {
    path: string;
    content: string;
    rootFolder?: string;
  };
}

export interface ChangeMessage {
  type: "CHANGE";
  payload: {
    content: string;
    data: Record<string, any>;
    source: string;
  };
}

export interface ConfigChangeMessage {
  type: "CONFIG_CHANGE";
  payload: Record<string, any>;
}

export interface OpenMessage {
  type: "OPEN";
  payload: {
    path: string;
    rootFolder?: string;
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

export type Message =
  | ChangeMessage
  | ConfigChangeMessage
  | WriteMessage
  | OpenMessage
  | ScrollFromWebViewMessage
  | ScrollFromExtensionMessage;
