import { Html, Head, Main, NextScript } from "next/document";
import { getHyperbook } from "../utils/hyperbook";

const config = getHyperbook();

export default function Document() {
  return (
    <Html lang={config.language || "en"}>
      <Head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.15.2/dist/katex.min.css"
          integrity="sha384-MlJdn/WNKDGXveldHDdyRP1R4CTHr3FeuDNfhsLPYrq2t0UBkUdK2jyTnXPEK1NQ"
          crossOrigin="anonymous"
        />
        <style>
          {`:root {
            --color-brand: ${config?.colors?.brand || "#014d40"};
            --color-brand-dark: ${
              config?.colors?.brandDark || config?.colors?.brand || "#014d40"
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
