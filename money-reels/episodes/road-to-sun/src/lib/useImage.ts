import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

const cache = new Map<string, HTMLImageElement>();

/** Loads an image for canvas or WebGL drawing and holds the render until it is ready. */
export const useImage = (src: string): HTMLImageElement | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(() => cache.get(src) ?? null);
  const [handle] = useState(() => (cache.has(src) ? null : delayRender(`image ${src}`)));
  useEffect(() => {
    if (cache.has(src)) {
      setImage(cache.get(src)!);
      if (handle !== null) continueRender(handle);
      return;
    }
    const im = new Image();
    im.onload = () => {
      cache.set(src, im);
      setImage(im);
      if (handle !== null) continueRender(handle);
    };
    im.onerror = () => {
      if (handle !== null) continueRender(handle);
    };
    im.src = src;
  }, [src, handle]);
  return image;
};
