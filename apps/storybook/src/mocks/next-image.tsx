/* biome-ignore-all lint/style/noDefaultExport: next/image compatibility mock requires a default export. */
/* biome-ignore-all lint/performance/noImgElement: Storybook next/image mock intentionally renders a plain img. */
import type { ImgHTMLAttributes } from "react";

export default function Image(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img alt={props.alt ?? ""} {...props} />;
}
