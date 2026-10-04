// https://docs.expo.dev/guides/customizing-metro/
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The AI proxy in ./server is a separate Node package with its own
// node_modules — keep Metro from crawling or bundling it. The pattern is
// anchored to this project so modules like `react-dom/server` stay resolvable.
const escape = (value) => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const serverDir = new RegExp(`^${escape(path.join(__dirname, 'server'))}([/\\\\].*)?$`);
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  serverDir,
];

module.exports = config;
