const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  target: "webworker", // VS Code web extensions run in a webworker context
  entry: path.join(__dirname, "src", "extension.ts"),
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      // Polyfills for Node.js modules not available in browser
      "path": require.resolve("path-browserify"),
      "fs": false, // We use vscode.workspace.fs instead
      "child_process": false,
      "net": false,
      "tls": false,
      "dns": false,
      "url": false,
      "buffer": require.resolve("buffer/"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "assert": require.resolve("assert/"),
      "process": require.resolve("process/browser"),
    },
    alias: {
      // Map node: protocol imports to regular imports
      "node:process": "process/browser",
      "node:buffer": "buffer",
      "node:url": false, 
    }
  },
  output: {
    filename: "extension.web.js",
    libraryTarget: "commonjs2",
    path: path.resolve(__dirname, "out"),
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode",
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
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
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                module: "es6",
              },
            },
          },
        ],
      },
    ],
  },
};
