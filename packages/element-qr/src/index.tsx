import QRCodeSVG from "qrcode.react";
import { FC } from "react";
import "./index.css";

type DirectiveQrProps = {
  size: "S" | "M" | "L" | "XL";
  value: string;
  label: string;
};

const realSizes = {
  S: 64,
  M: 128,
  L: 256,
  XL: 512,
} as const;

const DirectiveQr: FC<DirectiveQrProps> = ({ size, value, label }) => {
  return (
    <div className="element-qr">
      <div className={["code", size].join(" ")}>
        <QRCodeSVG
          value={value}
          size={realSizes[size]}
          bgColor={"#ffffff"}
          fgColor={"#000000"}
          level={"Q"}
        />
      </div>
      {label && (
        <div
          className="label"
          style={{
            maxWidth: realSizes[size],
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

export default {
  directives: { qr: DirectiveQr },
};
