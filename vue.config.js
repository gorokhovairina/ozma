"use strict";

const { IgnorePlugin } = require("webpack");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

const defaultConfig = require("./config/development.json");
const configName = process.env["CONFIG"] || process.env["NODE_ENV"];
let config;
try {
  config = require(`./config/${configName}.json`);
} catch (e) {
  config = defaultConfig;
}
const defaults = {
  "__DISABLE_AUTH__": false,
  "__API_AUTH_URL__": undefined,
  "__API_AUTH_URL_BASE__": undefined,
  "__AUTH_CLIENT_ID__": undefined,
  "__DEVELOPMENT_MODE__": false
};

const analyzeBundle = process.env["ANALYZE"];
const outputDir = process.env["OUTDIR"] || "dist";

module.exports = {
  assetsDir: "static",
  outputDir,

  productionSourceMap: false,

  lintOnSave: process.env.NODE_ENV === 'production' ? "error" : true,

  pluginOptions: {
    lintStyleOnBuild: true,
    stylelint: {
      fix: false,
      maxWarnings: process.env.NODE_ENV === 'production' ? 0 : undefined,
    },

    i18n: {
      fallbackLocale: "en",
      localeDir: "locales",
      enableInSFC: true,
    }
  },

  configureWebpack: {
    plugins: [
      new MonacoWebpackPlugin({
        languages: ["sql", "javascript"],
      }),
      new IgnorePlugin(/^\.\/locale$/, /moment$/),
      ...(analyzeBundle ? [new BundleAnalyzerPlugin()] : []),
    ]
  },

  chainWebpack: webpackConfig => {
    /* Manually set prefetched chunks */
    webpackConfig.plugins.delete("prefetch");
    webpackConfig.plugin("define").tap(
      ([ definitions, ...rest ]) => [{ ...definitions, ...defaults, ...config }, ...rest]
    );
  },
}
