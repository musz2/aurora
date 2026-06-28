import { contextBridge, ipcRenderer } from "electron";
const api = {
    setOverlayVisible: (visible) => ipcRenderer.invoke("overlay:set-visible", visible),
    setOverlayRecording: (recording) => ipcRenderer.invoke("overlay:set-recording", recording),
    onOverlayRecording: (handler) => {
        const listener = (_event, recording) => handler(recording);
        ipcRenderer.on("overlay:recording", listener);
        return () => ipcRenderer.removeListener("overlay:recording", listener);
    },
    getAppInfo: () => ipcRenderer.invoke("app:info"),
};
contextBridge.exposeInMainWorld("auroraDesktop", api);
//# sourceMappingURL=preload.js.map