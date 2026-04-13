const fs = require('node:fs');
const path = require('node:path');

const projectRoot = __dirname;
const brandingDirectory = path.join(projectRoot, 'src', 'renderer', 'assets', 'branding');
const runtimeEnvPath = path.join(projectRoot, 'build', 'runtime', 'app.env');

function resolvePublishConfiguration() {
  const bucket = process.env.BERT_S3_BUCKET || process.env.S3_BUCKET;
  const region = process.env.BERT_S3_REGION || process.env.AWS_REGION;
  const targetPath = process.env.BERT_S3_PATH;
  const channel = process.env.BERT_UPDATE_CHANNEL;

  if (!bucket || !region || !targetPath) {
    return undefined;
  }

  return [
    {
      provider: 's3',
      bucket,
      region,
      path: targetPath,
      acl: 'private',
      ...(channel ? { channel } : {})
    }
  ];
}

const extraResources = [];

if (fs.existsSync(brandingDirectory)) {
  extraResources.push({
    from: 'src/renderer/assets/branding',
    to: 'src/renderer/assets/branding',
    filter: ['**/*']
  });
}

if (fs.existsSync(runtimeEnvPath)) {
  extraResources.push({
    from: 'build/runtime/app.env',
    to: 'app.env'
  });
}

module.exports = {
  appId: 'org.wfp.bert.v3',
  productName: 'BeRT',
  directories: {
    output: 'release',
    buildResources: 'build'
  },
  files: ['dist/**/*', 'package.json'],
  extraResources,
  mac: {
    target: ['dmg', 'zip'],
    icon: 'build/icons/icon.icns',
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'build/icons/icon.ico',
    artifactName: '${productName}-${version}-${arch}-setup.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: true
  },
  publish: resolvePublishConfiguration()
};
