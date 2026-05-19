const fileInput = document.getElementById('videoFile');
const dropZone = document.getElementById('dropZone');
const fileStatus = document.getElementById('fileStatus');
const fileCard = document.getElementById('fileCard');
const fileName = document.getElementById('fileName');
const fileMeta = document.getElementById('fileMeta');
const changeFileButton = document.getElementById('changeFileButton');
const convertButton = document.getElementById('convertButton');
const downloadButton = document.getElementById('downloadButton');
const progressMessage = document.getElementById('progressMessage');
const progressValue = document.getElementById('progressValue');
const progressFill = document.getElementById('progressFill');
const feedback = document.getElementById('feedback');

let selectedFile = null;
let convertedJobId = null;

window.videoConverter.onProgress((payload) => {
    updateProgress(payload.progress, payload.message);
});

fileInput.addEventListener('change', () => {
    setSelectedFile(fileInput.files[0]);
});

changeFileButton.addEventListener('click', () => {
    fileInput.click();
});

convertButton.addEventListener('click', async () => {
    if (!selectedFile) {
        setFeedback('Selecione um video antes de converter.', 'error');
        return;
    }

    const filePath = selectedFile.path;

    if (!filePath) {
        setFeedback('Não foi possível acessar o caminho do arquivo selecionado.', 'error');
        return;
    }

    setBusy(true);
    convertedJobId = null;
    downloadButton.classList.add('hidden');
    setFeedback('');
    updateProgress(0, 'Preparando conversão...');

    try {
        const result = await window.videoConverter.convertVideo(filePath);
        convertedJobId = result.jobId;
        updateProgress(100, 'Conversão concluída.');
        setFeedback(`Arquivo pronto: ${result.outputName}`, 'success');
        downloadButton.classList.remove('hidden');
    } catch (error) {
        updateProgress(0, 'Conversão falhou.');
        setFeedback(error.message || 'Não foi possível converter o video.', 'error');
    } finally {
        setBusy(false);
    }
});

downloadButton.addEventListener('click', async () => {
    if (!convertedJobId) {
        setFeedback('Nenhum arquivo convertido disponível.', 'error');
        return;
    }

    downloadButton.disabled = true;
    setFeedback('');

    try {
        const result = await window.videoConverter.saveConvertedVideo(convertedJobId);

        if (result.saved) {
            setFeedback(`Vídeo salvo em: ${result.filePath}`, 'success');
        }
    } catch (error) {
        setFeedback(error.message || 'Não foi possível salvar o arquivo.', 'error');
    } finally {
        downloadButton.disabled = false;
    }
});

['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add('is-dragging');
    });
});

['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove('is-dragging');
    });
});

dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files[0];
    setSelectedFile(file);
});

function setSelectedFile(file) {
    if (!file) {
        return;
    }

    selectedFile = file;
    convertedJobId = null;
    fileName.textContent = file.name;
    fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || 'video'}`;
    fileStatus.textContent = file.name;
    fileCard.classList.remove('hidden');
    convertButton.disabled = false;
    downloadButton.classList.add('hidden');
    setFeedback('');
    updateProgress(0, 'Pronto para converter.');
}

function setBusy(isBusy) {
    convertButton.disabled = isBusy || !selectedFile;
    changeFileButton.disabled = isBusy;
    fileInput.disabled = isBusy;
    dropZone.style.pointerEvents = isBusy ? 'none' : '';
    convertButton.textContent = isBusy ? 'Convertendo...' : 'Converter.';
}

function updateProgress(progress, message) {
    const normalizedProgress = Math.max(0, Math.min(100, Number(progress) || 0));

    progressFill.style.width = `${normalizedProgress}%`;
    progressValue.textContent = `${normalizedProgress}%`;

    if (message) {
        progressMessage.textContent = message;
    }
}

function setFeedback(message, type) {
    feedback.textContent = message;
    feedback.classList.toggle('error', type === 'error');
    feedback.classList.toggle('success', type === 'success');
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;

    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
