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
    <path d="M555-200v-560h175v560H555Zm-325 0v-560h175v560H230Z" />
  </svg>
);
export default SvgComponent;
