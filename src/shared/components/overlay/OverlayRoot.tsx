// src/shared/components/overlay/OverlayRoot.tsx

import { ModalRoot } from "./ModalRoot";
import { SheetRoot } from "./SheetRoot";
import { LightboxRoot } from "./LightboxRoot";

/** Mount once near the root — coordinates all global overlays. */
export function OverlayRoot() {
  return (
    <>
      <ModalRoot />
      <SheetRoot />
      <LightboxRoot />
    </>
  );
}
