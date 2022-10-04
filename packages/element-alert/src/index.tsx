import { FC, ReactNode } from "react";
import "./index.css";

type DirectiveAlertProps = {
  children?: ReactNode;
  node: any;
} & any;

const DirectiveAlert: FC<DirectiveAlertProps> = ({
  children,
  node,
  ...props
}) => {
  let c = Object.keys(props).join(" ");
  return <div className={`hyperbook element-alert ${c}`}>{children}</div>;
};

export default {
  directives: { alert: DirectiveAlert },
};
