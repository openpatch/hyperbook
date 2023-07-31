import QRCode from "qrcode";
import { FC, useEffect, useState } from "react";
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

const DirectiveQr: FC<DirectiveQrProps> = ({ size = "M", value, label }) => {
  const [data, setData] = useState("");

  useEffect(() => {
    QRCode.toDataURL(
      value,
      {
        width: realSizes[size],
        errorCorrectionLevel: "Q",
        margin: 0,
        color: {
          dark: "#000",
          light: "#FFF",
        },
      },
      (err, url) => {
        if (err) return;
        setData(url);
      }
    );
  }, [size, value]);

  return (
    <div className="element-qr">
      <div className={["code", size].join(" ")}>
        <img src={data} />
      </div>
      {label && (
        <div
          className={["label", size].join(" ")}
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
