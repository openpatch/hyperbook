const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

// build.ts loads the lunr language plugins with require("./lunr-languages/...").
// The CLI's postbuild copies them next to dist/ for the published package, but
// from the workspace source that directory does not exist at the package root,
// so webpack would warn "Can't resolve './lunr-languages'". Redirect both the
// static and the dynamic (context) request to the files inside the
// lunr-languages package so webpack bundles them.
const hyperbookDir = path.dirname(require.resolve("hyperbook/package.json"));
const lunrLanguagesMin = path.join(
  hyperbookDir,
  "node_modules",
  "lunr-languages",
  "min",
);

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
      new webpack.NormalModuleReplacementPlugin(
        /^\.\/lunr-languages[\\/]/,
        (resource) => {
          if (!resource.context.startsWith(hyperbookDir)) return;
          resource.request = path.join(
            lunrLanguagesMin,
            resource.request.slice("./lunr-languages/".length),
          );
        },
      ),
      // The dynamic require(`./lunr-languages/lunr.${lang}.min.js`) becomes a
      // context module; point its directory at the real one. lunr.jp.min.js is
      // an upstream alias stub that requires a non-existent ./lunr.ja — the
      // CLI falls back to English for it, so leave it out of the context too.
      new webpack.ContextReplacementPlugin(
        /^\.\/lunr-languages$/,
        lunrLanguagesMin,
        false,
        /^\.\/lunr\.(?!jp\.).*\.min\.js$/,
      ),
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
