import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;
let mainWindow = null;
let overlayWindow = null;
let overlayRecording = false;
function rendererUrl(hash = "") {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5174";
    if (isDev)
        return `${devUrl}${hash}`;
    return `file://${path.join(__dirname, "../dist/index.html")}${hash}`;
}
async function loadRenderer(win, hash = "") {
    try {
        await win.loadURL(rendererUrl(hash));
    }
    catch (err) {
        console.error("[desktop] renderer load failed:", err);
    }
}
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1120,
        height: 760,
        minWidth: 920,
        minHeight: 640,
        title: "Aurora Desktop",
        backgroundColor: "#f7f8fb",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    void loadRenderer(mainWindow);
}
function createOverlayWindow() {
    const { workArea } = screen.getPrimaryDisplay();
    overlayWindow = new BrowserWindow({
        width: 360,
        height: 420,
        x: workArea.x + workArea.width - 392,
        y: workArea.y + 32,
        show: false,
        frame: false,
        resizable: false,
        movable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        transparent: true,
        backgroundColor: "#00000000",
        title: "Aurora Private Overlay",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.webContents.on("did-finish-load", () => {
        overlayWindow?.webContents.send("overlay:recording", overlayRecording);
    });
    void loadRenderer(overlayWindow, "#overlay");
}
app.whenReady().then(() => {
    createMainWindow();
    createOverlayWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
            createOverlayWindow();
        }
    });
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit();
});
ipcMain.handle("overlay:set-visible", (_event, visible) => {
    if (!overlayWindow)
        return false;
    if (visible) {
        overlayWindow.showInactive();
        overlayWindow.webContents.send("overlay:recording", overlayRecording);
    }
    else
        overlayWindow.hide();
    return true;
});
ipcMain.handle("overlay:set-recording", (_event, recording) => {
    overlayRecording = recording;
    overlayWindow?.webContents.send("overlay:recording", recording);
    return true;
});
ipcMain.handle("app:info", () => ({
    platform: process.platform,
    version: app.getVersion(),
}));
//# sourceMappingURL=main.js.map