// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch ALL workspace folders so changes en packages/shared se reflejan
config.watchFolders = [workspaceRoot];

// 2. Resolver desde node_modules locales Y del root del workspace
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Forzar resolución determinista (npm workspaces hoist things)
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
