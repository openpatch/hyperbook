import { useConfig, useMakeUrl } from "@hyperbook/provider";
import { Fragment } from "react";

export const Styles = () => {
  const { colors, font, fonts } = useConfig();
  const makeUrl = useMakeUrl();
  return (
    <Fragment>
      <style>
        {`:root {
            --color-brand: ${colors?.brand || "#007864"};
            --color-brand-dark: ${
              colors?.brandDark || colors?.brand || "#b5e3d8"
            };
            --color-brand-text: ${colors?.brandText || "white"};
          }`}
      </style>
      {font && (
        <style>
          {`
@font-face {
  font-family: hyperbook-heading;
  src: url(${makeUrl(font, "public")});
}
@font-face {
  font-family: hyperbook-body;
  src: url(${makeUrl(font, "public")});
}
`}
        </style>
      )}
      {fonts?.body && (
        <style>
          {`
@font-face {
  font-family: hyperbook-body;
  src: url(${makeUrl(fonts.body, "public")});
}
`}
        </style>
      )}
      {fonts?.heading && (
        <style>
          {`
@font-face {
  font-family: hyperbook-heading;
  src: url(${makeUrl(fonts.heading, "public")});
}
`}
        </style>
      )}
      {fonts?.code && (
        <style>
          {`
@font-face {
  font-family: hyperbook-code;
  src: url(${makeUrl(fonts.code, "public")});
}
`}
        </style>
      )}
      <style>
        {`
:root {
  --color-background: white;
  --color-text: black;
  --color-text-deactivated: #242428;
  --color-nav: #f5f5f5;
  --color-nav-border: #3c3c3c;
  --color-author-background: #d6d6d6;
  --color-author-color: #3c3c3c;
  --color-spacer: #a4a4a4;
}
        `}
      </style>
      <style>
        {`
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #1e1e1e;
    --color-text: #f5f5f5;
    --color-text-deactivated: #d6d6d6;
    --color-nav: #222222;
    --color-nav-border: #464646;
    --color-author-background: #2c2c2c;
    --color-author-color: #d6d6d6;
    --color-spacer: #3c3c3c;
    --color-brand: var(--color-brand-dark);
  }

  header {
    background: var(--color-nav);
  }

  .branding {
    color: var(--color-brand);
  }

  .toggle .bar1,
  .toggle .bar2,
  .toggle .bar3 {
    background-color: var(--color-brand);
  }
}`}
      </style>
    </Fragment>
  );
};
