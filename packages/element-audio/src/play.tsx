import { SVGProps } from "react";

const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 -960 960 960"
    fill="currentColor"
    {...props}
  >
    <path d="M320-203v-560l440 280-440 280Z" />
  </svg>
);
export default SvgComponent;
