import { RefObject, useLayoutEffect, useState } from "react";

export const useIsOverflow = <T extends HTMLElement>(ref: RefObject<T>) => {
  const [isOverflow, setIsOverflow] = useState(undefined);

  useLayoutEffect(() => {
    const { current } = ref;

    const trigger = () => {
      const hasOverflow = current.scrollWidth > current.clientWidth;
      console.log(current);

      setIsOverflow(hasOverflow);
    };

    if (current) {
      if ("ResizeObserver" in window) {
        new ResizeObserver(trigger).observe(current);
      }

      trigger();
    }
  }, [ref]);

  return isOverflow;
};
