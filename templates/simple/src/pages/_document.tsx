import { Html, Head, Main, NextScript } from "next/document";
import { getHyperbook } from "../utils/hyperbook";

const config = getHyperbook();

export default function Document() {
  return (
    <Html lang={config.language || "en"}>
      <Head>
        <style>
          {`:root {
            --color-brand: ${config?.colors?.brand || "#007864"};
            --color-brand-dark: ${
              config?.colors?.brandDark || config?.colors?.brand || "#b5e3d8"
            };
            --color-brand-text: ${config?.colors?.brandText || "white"};
          }`}
        </style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
