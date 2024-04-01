import { FC, ReactNode } from "react";
import { useLink } from "@hyperbook/provider";
import "./index.css";

type DirectiveTermProps = {
  children?: ReactNode;
  id: string;
  className?: string;
};

const DirectiveTerm: FC<DirectiveTermProps> = ({ id, children, className }) => {
  const Link = useLink();
  if (!id) {
    id = (children as any)?.[0].toLowerCase().replaceAll(" ", "-");
  }

  let href = `/glossary/${id}`;

  if (className && typeof className[0] == "string") {
    href += `#${className}`;
  }

  return <Link href={href}>{children}</Link>;
};

export default {
  directives: { term: DirectiveTerm, t: DirectiveTerm },
};
