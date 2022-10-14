import { RefObject, useLayoutEffect, useState } from "react";

export const useOnScreen = <T extends HTMLElement>(
  ref: RefObject<T>,
  padding: number = 0
) => {
  const [isOnScreen, setOnScreen] = useState(true);

  const handleResize = (bounds: DOMRect) => () => {
    if (ref.current) {
      if (window.innerWidth >= bounds.x + bounds.width + padding) {
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
