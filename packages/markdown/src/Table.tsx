import { ComponentType, ReactNode } from "react";

let tableHeaders: ReactNode[] = [];
let tdIndex = 0;

export const Table: ComponentType<JSX.IntrinsicElements["table"]> = ({
  children,
  style,
}) => {
  tableHeaders = [];
  return <table style={style}>{children}</table>;
};

export const Tr: ComponentType<JSX.IntrinsicElements["tr"]> = ({
  children,
  style,
}) => {
  tdIndex = 0;
  return <tr style={style}>{children}</tr>;
};

export const Td: ComponentType<JSX.IntrinsicElements["td"]> = ({
  children,
  style,
}) => {
  return (
    <td data-label={tableHeaders[tdIndex++]} style={style}>
      {children}
    </td>
  );
};

export const Th: ComponentType<JSX.IntrinsicElements["th"]> = ({
  children,
  style,
}) => {
  tableHeaders.push(children);
  return <th style={style}>{children}</th>;
};
