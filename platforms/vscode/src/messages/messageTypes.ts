import { Range } from "vscode";
import {
  HyperbookJson,
  HyperbookPage,
  Language,
  Navigation,
} from "@hyperbook/types";
import { vfile } from "@hyperbook/fs";

export interface WriteMessage {
  type: "WRITE";
  payload: {
    path: string;
    content: string;
    rootFolder?: string;
    basePath?: string;
  };
}

export interface ChangeBookFileMessage {
  type: "CHANGE_BOOK_FILE";
  payload: {
    locale: Language;
    markdown: string;
    data: HyperbookPage;
    navigation: Navigation;
    assetsPath: string;
  };
}

export interface ChangeGlossaryFileMessage {
  type: "CHANGE_GLOSSARY_FILE";
  payload: {
    locale: Language;
    markdown: string;
    data: HyperbookPage;
    references: vfile.VFileBook[];
    navigation: Navigation;
    assetsPath: string;
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
  | ChangeBookFileMessage
  | ChangeGlossaryFileMessage
  | ReadyMessage
  | ConfigChangeMessage
  | WriteMessage
  | OpenMessage
  | ScrollFromWebViewMessage
  | ScrollFromExtensionMessage;
