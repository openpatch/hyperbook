const path = require("path");
const fs = require("fs");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (_env, argv) => {
  // Remove previous build output, which may still contain bundled runtimes.
  fs.rmSync(path.resolve(__dirname, "assets", "hyperbook"), {
    recursive: true,
    force: true,
  });
  return {
    target: "node",
    entry: path.join(__dirname, "src", "extension.ts"),
    resolve: {
      extensions: [".ts", ".js"],
    },
    output: {
      filename: "extension.js",
      libraryTarget: "commonjs2",
      path: path.resolve(__dirname, "out"),
      devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    devtool: "source-map",
    externals: {
      vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
      // Only a full build generates favicons; the preview renders single pages
      // through the CLI's build.ts, which imports this lazily. Not shipped.
      favicons: "commonjs favicons",
      sharp: "commonjs sharp",
      // unzipper (archive directive) requires this lazily for S3 sources only.
      "@aws-sdk/client-s3": "commonjs @aws-sdk/client-s3",
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(
              __dirname,
              "node_modules",
              // The CLI build retains exactly the small integration files.
              "hyperbook",
              "dist",
              "assets",
            ),
            to: path.resolve(__dirname, "assets", "hyperbook"),
          },
          {
            // Lists the verified runtime bundles of the matching CLI release.
            // The preview downloads them into the CLI's shared asset cache.
            from: path.resolve(
              __dirname,
              "node_modules",
              "hyperbook",
              "dist",
              "asset-manifest.json",
            ),
            to: path.resolve(__dirname, "out", "asset-manifest.json"),
            // Releases must ship it; development builds may skip the CLI build.
            noErrorOnMissing: argv.mode !== "production",
          },
          {
            from: path.resolve(
              __dirname,
              "node_modules",
              "create-hyperbook",
              "dist",
              "templates",
            ),
            to: path.resolve(__dirname, "out", "templates"),
          },
        ],
      }),
    ],
    module: {
      rules: [
        {
          test: /[\\/]markdown[\\/]dist[\\/]index\.js$/,
          // esbuild already bundled the CommonJS dependencies. Its remaining
          // dynamic requires use createRequire for Node built-ins; webpack's
          // CommonJS parser would replace them with an empty module context.
          parser: { commonjs: false, createRequire: false },
        },
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
              options: {
                compilerOptions: {
                  // override `tsconfig.json` so that TypeScript emits native
                  // JavaScript modules (es2022 also allows the CLI's dynamic
                  // imports, e.g. the favicon generator).
                  module: "es2022",
                  // The preview renders through the CLI's build.ts ("hyperbook
                  // build"/"hyperbook render"), which lives outside this
                  // package and imports JSON (package.json, asset-bundles).
                  rootDir: path.resolve(__dirname, "../.."),
                  resolveJsonModule: true,
                  target: "es2022",
                  lib: ["es2023", "dom"],
                },
              },
            },
          ],
        },
      ],
    },
  };
};
