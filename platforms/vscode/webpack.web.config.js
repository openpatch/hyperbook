// The extension for VS Code for the Web. It runs in a web worker, so it has to
// be one file with no Node in it, which is what this config produces.
// https://code.visualstudio.com/api/extension-guides/web-extensions
const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

/** @type {import('webpack').Configuration} */
module.exports = {
  target: "webworker",
  entry: path.join(__dirname, "src", "extension.ts"),
  output: {
    filename: "extension.js",
    path: path.resolve(__dirname, "dist", "web"),
    libraryTarget: "commonjs",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },
  resolve: {
    // Prefer the browser build of a package over its Node one.
    mainFields: ["browser", "module", "main"],
    extensions: [".ts", ".js"],
    alias: {
      // Creating a hyperbook writes files, which a web extension host cannot.
      "./NewCommand": path.resolve(__dirname, "src", "NewCommand.web.ts"),
    },
    fallback: {
      // Hyperbook paths are plain strings, so path is the one Node module that
      // is really needed. The rest are not: reading goes through the workspace
      // file system, and the modules that would have used them are written to
      // notice they are missing.
      path: require.resolve("path-browserify"),
      assert: require.resolve("assert"),
      process: require.resolve("process/browser"),
      fs: false,
      "fs/promises": false,
      os: false,
      crypto: false,
      util: false,
      url: false,
      stream: false,
      zlib: false,
      child_process: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        // The node build and the linter typecheck. Here the sources that the
        // web build replaces are not part of the program at all.
        use: [{ loader: "ts-loader", options: { transpileOnly: true } }],
      },
    ],
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, "");
    }),
    new webpack.ProvidePlugin({
      // An absolute path, so the packages of this repository resolve it too.
      process: require.resolve("process/browser"),
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            "node_modules",
            "@hyperbook",
            "markdown",
            "dist",
            "assets",
          ),
          to: path.resolve(__dirname, "assets", "hyperbook"),
        },
      ],
    }),
  ],
  externals: {
    // Provided by the extension host, and only reachable through require.
    vscode: "commonjs vscode",
  },
  performance: {
    hints: false,
  },
  devtool: "nosources-source-map",
};
