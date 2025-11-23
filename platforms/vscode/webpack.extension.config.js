const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
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
};
