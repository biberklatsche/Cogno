export function focusSideMenuAutofocusElement(): void {
  const scheduleFocus = globalThis.requestAnimationFrame
    ?? ((callback: FrameRequestCallback) => setTimeout(callback, 0));

  scheduleFocus(() => {
    const documentReference = globalThis.document;
    if (!documentReference) {
      return;
    }

    const autofocusElement = documentReference.querySelector<HTMLInputElement>(
      "[data-side-menu-autofocus='true']",
    );
    autofocusElement?.focus();
    autofocusElement?.select();
  });
}
