const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') {
    process.exit(0);
}

const targets = ['node_modules/ffmpeg-static', 'dist', 'renderer', 'main.js', 'preload.js'];

for (const target of targets) {
    const targetPath = path.join(__dirname, '..', target);

    if (!fs.existsSync(targetPath)) {
        continue;
    }

    const result = spawnSync('xattr', ['-r', '-d', 'com.apple.quarantine', targetPath], {
        encoding: 'utf8',
    });

    if (result.status !== 0 && !isMissingAttribute(result.stderr)) {
        console.warn(`Aviso: não foi possível remover quarantine de ${target}`);
        console.warn((result.stderr || result.stdout || '').trim());
    }
}

function isMissingAttribute(output) {
    return /No such xattr|No such file/i.test(output || '');
}
