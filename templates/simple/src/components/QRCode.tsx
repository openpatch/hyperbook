import { QRCodeSVG } from "qrcode.react";

type QRCodeProps = {
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

export const QRCode = ({ value, size = "M", label }: QRCodeProps) => {
  return (
    <div className="qr">
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
