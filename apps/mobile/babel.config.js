module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-worklets/plugin debe ir SIEMPRE el último (reanimated 4 / worklets).
    plugins: ["react-native-worklets/plugin"],
  };
};
