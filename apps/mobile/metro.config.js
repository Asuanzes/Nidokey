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

// 4. Ignorar las caches de Gradle dentro de node_modules. En Windows (sin watchman)
//    el watcher de Metro revienta con ENOENT al vigilar `.gradle/.../fileHashes`
//    (cache volátil que traen los plugins Gradle de Expo/RN). El bundler no las
//    necesita; excluirlas del file-map evita el crash.
const gradleCacheRe = /[\\/]\.gradle(?:[\\/]|$)/;
const prevBlockList = config.resolver.blockList;
config.resolver.blockList = Array.isArray(prevBlockList)
  ? [...prevBlockList, gradleCacheRe]
  : prevBlockList
    ? [prevBlockList, gradleCacheRe]
    : gradleCacheRe;

module.exports = config;
