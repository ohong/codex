import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #050709, #11141C)",
          borderRadius: "20%",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
          fontWeight: 700,
          color: "#FF5C39",
          letterSpacing: "-0.04em",
          textShadow: "0 6px 20px rgba(255, 92, 57, 0.4)",
        }}
      >
        OS
      </div>
    ),
    size
  );
}
