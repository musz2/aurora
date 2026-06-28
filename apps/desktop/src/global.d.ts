export {};

declare global {
  interface Window {
    auroraDesktop?: {
      setOverlayVisible: (visible: boolean) => Promise<boolean>;
      setOverlayRecording: (recording: boolean) => Promise<boolean>;
      onOverlayRecording: (handler: (recording: boolean) => void) => () => void;
      getAppInfo: () => Promise<{ platform: string; version: string }>;
    };
  }
}
