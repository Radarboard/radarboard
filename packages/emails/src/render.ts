import { render as reactEmailRender } from "@react-email/components";

export async function render(element: React.ReactElement): Promise<string> {
  return reactEmailRender(element);
}
