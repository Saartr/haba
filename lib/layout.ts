import { Platform, useWindowDimensions } from 'react-native';

/** Ширина «телефонной» колонки на десктопе. Тем же числом ограничен #root
 *  в app/+html.tsx — держим их в одном месте, иначе вёрстка внутри рамки
 *  начнёт считать себя шире, чем рамка, и полезет за её края. */
export const WEB_MAX_WIDTH = 480;

/** Ширина, от которой должна считаться вёрстка. На телефоне это ширина экрана,
 *  на вебе — не больше рамки: window.innerWidth там равен ширине окна браузера,
 *  и вёрстка, привязанная к нему, растягивается на весь монитор. */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, WEB_MAX_WIDTH) : width;
}
