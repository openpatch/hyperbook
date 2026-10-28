declare module "qrcode-svg" {
  type Options = {
    content: string;
    padding?: number;
    width?: number;
    height?: number;
    color?: string;
    background?: string;
    ecl?: "L" | "M" | "Q" | "H";
    join?: boolean;
    xmlDeclaration?: boolean;
    container?: "svg" | "svg-viewbox" | "g" | "none";
  };
  export default class QRCode {
    constructor(options: Options);
    svg(): string;
  }
}
