const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  return raw.split(/\r?\n/).reduce((result, line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return result;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return result;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
    return result;
  }, {});
}

function loadServerConfig() {
  const envFile = parseEnvFile(path.join(__dirname, '.env.local'));
  const env = {
    ...envFile,
    ...process.env
  };

  return {
    port: Number(env.PORT || env.CHAT_PROXY_PORT || 8787),
    deepseekApiKey: env.DEEPSEEK_API_KEY || '',
    deepseekBaseUrl: (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  };
}

module.exports = {
  loadServerConfig
};
