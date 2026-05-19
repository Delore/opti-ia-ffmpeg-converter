const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoConverter', {
    convertVideo: (filePath) => ipcRenderer.invoke('convert-video', filePath),
    saveConvertedVideo: (jobId) => ipcRenderer.invoke('save-converted-video', jobId),
    onProgress: (callback) => {
        const listener = (_event, payload) => callback(payload);

        ipcRenderer.on('conversion-progress', listener);

        return () => {
            ipcRenderer.removeListener('conversion-progress', listener);
        };
    }
});
