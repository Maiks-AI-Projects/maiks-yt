type ControlPanelEnvironment = {
  readonly PROD?: boolean;
};

export const shouldRenderUnsupportedProductOverlayControls = (
  environment: ControlPanelEnvironment = import.meta.env
): boolean => environment.PROD !== true;
