import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07111f",
          color: "#f8fafc",
          padding: "72px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            fontSize: 34,
            fontWeight: 800,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#07111f",
            }}
          >
            LF
          </div>
          LeadFlow
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: 82,
              lineHeight: 1,
              fontWeight: 900,
              maxWidth: 900,
            }}
          >
            Embudos publicos listos para convertir
          </div>
          <div style={{ fontSize: 30, color: "#bae6fd", maxWidth: 760 }}>
            Captacion, presentacion y seguimiento comercial en una sola
            experiencia.
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
