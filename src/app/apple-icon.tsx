import { renderBrandIcon } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// apple-icon can't be an .svg (only .jpg/.jpeg/.png or, as here, a generated route),
// so the header/favicon mark is re-rendered as a PNG at Apple's preferred touch-icon size.
export default function AppleIcon() {
  return renderBrandIcon(size.width);
}
