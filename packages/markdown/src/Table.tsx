import { ReactNode } from "react";
import { Components } from "react-markdown";

let tableHeaders: ReactNode[][] = [];
let tdIndex = 0;

export const Table: Components["table"] = ({ children, style }) => {
  tableHeaders = [];
  return <table style={style}>{children}</table>;
};

export const Tr: Components["tr"] = ({ children, style }) => {
  tdIndex = 0;
  return <tr style={style}>{children}</tr>;
};

export const Td: Components["td"] = ({ children, style }) => {
  return (
    <td data-label={tableHeaders[tdIndex++]} style={style}>
      {children}
    </td>
  );
};

export const Th: Components["th"] = ({ children, style }) => {
  tableHeaders.push(children);
  return <th style={style}>{children}</th>;
};
