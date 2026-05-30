/* biome-ignore-all lint/style/noDefaultExport: next/dynamic compatibility mock requires a default export. */
import type { ComponentType } from "react";

export default function dynamic<TProps extends object>(
  _loader: () => Promise<unknown>,
  options?: {
    loading?: ComponentType;
  }
) {
  const Loading = options?.loading;

  return function DynamicComponent(_props: TProps) {
    return Loading ? <Loading /> : null;
  };
}
