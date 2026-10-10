const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (_env, argv) => ({
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
  },
  plugins: [
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
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                module: "es6", // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
              },
            },
          },
        ],
      },
    ],
  },
});
