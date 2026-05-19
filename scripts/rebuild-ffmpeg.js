const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const [platform, arch] = process.argv.slice(2);

if (!platform || !arch) {
    console.error('Usage: node scripts/rebuild-ffmpeg.js <platform> <arch>');
    process.exit(1);
}

const installScript = path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'install.js');

if (!fs.existsSync(installScript)) {
    console.error('ffmpeg-static is not installed. Run npm install first.');
    process.exit(1);
}

const result = spawnSync(process.execPath, [installScript], {
    stdio: 'inherit',
    env: {
        ...process.env,
        npm_config_platform: platform,
        npm_config_arch: arch
    }
});

process.exit(result.status || 0);
