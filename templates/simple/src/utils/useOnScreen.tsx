import { RefObject, useLayoutEffect, useState } from "react";

export const useOnScreen = <T extends HTMLElement>(
  ref: RefObject<T>,
  containerRef: RefObject<T>,
  padding: number = 0
) => {
  const [isOnScreen, setOnScreen] = useState(true);

  const handleResize = (bounds: DOMRect) => () => {
    if (containerRef.current) {
      const containerBounds = containerRef.current.getBoundingClientRect();

      if (
        containerBounds.width >= bounds.width + padding &&
        containerBounds.right <= window.innerWidth
      ) {
        setOnScreen(true);
      } else {
        setOnScreen(false);
      }
    }
  };

  useLayoutEffect(() => {
    if (ref.current) {
      const bounds = ref.current.getBoundingClientRect();

      const h = handleResize(bounds);

      window.addEventListener("resize", h);

      h();

      return () => {
        window.removeEventListener("resize", h);
      };
    }
  }, [ref]);

  return isOnScreen;
};
