const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegStaticPath = require('ffmpeg-static');

let mainWindow = null;
const convertedFiles = new Map();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 960,
        minHeight: 680,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    if (isDev()) {
        mainWindow.webContents.openDevTools();
    }

    if (!isDev()) {
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify();
        }, 200);
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
        type: 'warning',
        title: 'Atualização',
        defaultId: 0,
        cancelId: 0,
        message: 'New update available, downloading to update...',
        buttons: ['OK'],
    });
});

autoUpdater.on('update-downloaded', () => {
    dialog
        .showMessageBox({
            type: 'warning',
            title: 'Update',
            defaultId: 0,
            cancelId: 0,
            message: 'There is an update available, click Update',
            buttons: ['Update'],
        })
        .then(() => {
            setTimeout(() => {
                autoUpdater.quitAndInstall();
                app.quit();
            }, 100);
        });
});

ipcMain.handle('convert-video', async (event, inputPath) => {
    if (!inputPath || typeof inputPath !== 'string') {
        throw new Error('Selecione um arquivo de video valido.');
    }

    if (!fs.existsSync(inputPath)) {
        throw new Error('O arquivo selecionado nao foi encontrado.');
    }

    const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inputName = path.parse(inputPath).name;
    const outputName = `${sanitizeFileName(inputName)}_converted.mp4`;
    const outputPath = path.join(os.tmpdir(), outputName);

    await convertVideo({
        event,
        jobId,
        inputPath,
        outputPath,
    });

    convertedFiles.set(jobId, {
        outputPath,
        outputName,
    });

    return {
        jobId,
        outputName,
    };
});

ipcMain.handle('save-converted-video', async (_event, jobId) => {
    const convertedFile = convertedFiles.get(jobId);

    if (!convertedFile || !fs.existsSync(convertedFile.outputPath)) {
        throw new Error('Arquivo convertido nao encontrado. Converta o video novamente.');
    }

    const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: 'Salvar video convertido',
        defaultPath: convertedFile.outputName,
        filters: [{ name: 'Video MP4', extensions: ['mp4'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
        return { saved: false };
    }

    await fs.promises.copyFile(convertedFile.outputPath, saveResult.filePath);

    return {
        saved: true,
        filePath: saveResult.filePath,
    };
});

function convertVideo({ event, jobId, inputPath, outputPath }) {
    return new Promise((resolve, reject) => {
        let duration = null;
        let lastProgress = 0;

        const args = ['-y', '-i', inputPath, '-vf', "scale='min(540,iw)':-2,fps=24", '-c:v', 'libx264', '-preset', 'medium', '-crf', '25', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0', '-c:a', 'aac', '-b:a', '64k', '-ar', '44100', '-movflags', '+faststart', outputPath];

        sendProgress(event, jobId, 0, 'Preparando conversão...');

        const ffmpegPath = getFfmpegExecutablePath();

        if (!ffmpegPath) {
            reject(new Error('FFmpeg não encontrado no pacote do app.'));
            return;
        }

        const ffmpeg = spawn(ffmpegPath, args);
        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;

            const durationMatch = chunk.match(/Duration:\s(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
            if (durationMatch) {
                duration = toSeconds(durationMatch[1], durationMatch[2], durationMatch[3]);
            }

            const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
            if (duration && timeMatch) {
                const currentTime = toSeconds(timeMatch[1], timeMatch[2], timeMatch[3]);
                const progress = Math.min(99, Math.floor((currentTime / duration) * 100));

                if (progress > lastProgress) {
                    lastProgress = progress;
                    sendProgress(event, jobId, progress, 'Convertendo video...');
                }
            }
        });

        ffmpeg.on('error', (error) => {
            reject(new Error(`Não foi possível iniciar o FFmpeg: ${error.message}`));
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                sendProgress(event, jobId, 100, 'Conversão concluída.');
                resolve();
                return;
            }

            reject(new Error(getReadableFfmpegError(errorOutput)));
        });
    });
}

function sendProgress(event, jobId, progress, message) {
    event.sender.send('conversion-progress', {
        jobId,
        progress,
        message,
    });
}

function toSeconds(hours, minutes, seconds) {
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function sanitizeFileName(fileName) {
    return (
        fileName
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
            .replace(/\s+/g, '_')
            .slice(0, 120) || 'video'
    );
}

function getReadableFfmpegError(errorOutput) {
    const lines = errorOutput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.slice(-4).join('\n') || 'A conversão falhou.';
}

function getFfmpegExecutablePath() {
    const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const candidates = [];

    if (app.isPackaged) {
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', binaryName));
    }

    if (ffmpegStaticPath) {
        if (ffmpegStaticPath.includes('app.asar')) {
            candidates.push(ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked'));
        }

        candidates.push(ffmpegStaticPath);
    }

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

function isDev() {
    return process.argv.includes('--dev');
}
