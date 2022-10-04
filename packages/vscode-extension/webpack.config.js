const path = require("path");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: path.join(__dirname, "app", "index.tsx"),
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".mjs", ".jsx", ".css"],
  },
  plugins: [
    new NodePolyfillPlugin(),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            "node_modules",
            "@hyperbook",
            "element-excalidraw",
            "node_modules",
            "@excalidraw",
            "excalidraw",
            "dist",
            "excalidraw-assets"
          ),
          to: path.resolve(
            __dirname,
            "assets",
            "excalidraw",
            "excalidraw-assets"
          ),
        },
        {
          from: path.resolve(
            __dirname,
            "node_modules",
            "@hyperbook",
            "element-excalidraw",
            "node_modules",
            "@excalidraw",
            "excalidraw",
            "dist",
            "excalidraw-assets-dev"
          ),
          to: path.resolve(
            __dirname,
            "assets",
            "excalidraw",
            "excalidraw-assets-dev"
          ),
        },
      ],
    }),
  ],
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: "/node_modules/",
      },
      {
        test: /\.(scss|css)$/,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "[name].[ext]",
              outputPath: "fonts/",
            },
          },
        ],
      },
    ],
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "out", "app"),
  },
};
