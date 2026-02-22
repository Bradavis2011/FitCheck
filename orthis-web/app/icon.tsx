import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #E85D4C, #FF7A6B)",
          borderRadius: "7px",
        }}
      >
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: "22px",
            fontWeight: "700",
            color: "white",
            lineHeight: "1",
            marginTop: "1px",
          }}
        >
          ?
        </span>
      </div>
    ),
    { ...size }
  );
}
