import { Html, Head, Main, NextScript } from "next/document";
import { getHyperbook, getHyperbookUrl } from "../utils/hyperbook";

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
        {config.font && (
          <style>
            {`
@font-face {
  font-family: hyperbook-heading;
  src: url(${getHyperbookUrl(config.font)});
}
@font-face {
  font-family: hyperbook-body;
  src: url(${getHyperbookUrl(config.font)});
}
`}
          </style>
        )}
        {config.fonts?.body && (
          <style>
            {`
@font-face {
  font-family: hyperbook-body;
  src: url(${getHyperbookUrl(config.fonts.body)});
}
`}
          </style>
        )}
        {config.fonts?.heading && (
          <style>
            {`
@font-face {
  font-family: hyperbook-heading;
  src: url(${getHyperbookUrl(config.fonts.heading)});
}
`}
          </style>
        )}
        {config.fonts?.code && (
          <style>
            {`
@font-face {
  font-family: hyperbook-code;
  src: url(${getHyperbookUrl(config.fonts.code)});
}
`}
          </style>
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
