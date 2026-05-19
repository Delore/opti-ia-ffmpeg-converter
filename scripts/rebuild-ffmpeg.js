const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const [targetPlatform = process.platform, targetArch = process.arch] = process.argv.slice(2);

const installScript = path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'install.js');
const ffmpegStaticDir = path.dirname(installScript);

if (!fs.existsSync(installScript)) {
    console.error('ffmpeg-static is not installed. Run npm install first.');
    process.exit(1);
}

removeStaleBinaries(ffmpegStaticDir, targetPlatform);

const result = spawnSync(process.execPath, [installScript], {
    stdio: 'inherit',
    env: {
        ...process.env,
        npm_config_platform: targetPlatform,
        npm_config_arch: targetArch
    }
});

process.exit(result.status || 0);

function removeStaleBinaries(directory, targetPlatform) {
    const targetBinaryName = targetPlatform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const binaryNames = ['ffmpeg', 'ffmpeg.exe'];

    for (const binaryName of binaryNames) {
        if (binaryName === targetBinaryName) {
            continue;
        }

        for (const suffix of ['', '.README', '.LICENSE']) {
            const stalePath = path.join(directory, `${binaryName}${suffix}`);

            if (fs.existsSync(stalePath)) {
                fs.rmSync(stalePath, { force: true });
            }
        }
    }
}
