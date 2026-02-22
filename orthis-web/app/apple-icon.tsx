import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: "40px",
        }}
      >
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: "130px",
            fontWeight: "700",
            color: "white",
            lineHeight: "1",
          }}
        >
          ?
        </span>
      </div>
    ),
    { ...size }
  );
}
