import { contextBridge, ipcRenderer } from "electron";

const api = {
  setOverlayVisible: (visible: boolean) =>
    ipcRenderer.invoke("overlay:set-visible", visible),
  setOverlayRecording: (recording: boolean) =>
    ipcRenderer.invoke("overlay:set-recording", recording),
  onOverlayRecording: (handler: (recording: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, recording: boolean) =>
      handler(recording);
    ipcRenderer.on("overlay:recording", listener);
    return () => ipcRenderer.removeListener("overlay:recording", listener);
  },
  getAppInfo: () => ipcRenderer.invoke("app:info"),
};

contextBridge.exposeInMainWorld("auroraDesktop", api);
