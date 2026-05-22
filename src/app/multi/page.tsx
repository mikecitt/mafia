const FRAMES = [
  "P1 (host)", "P2", "P3", "P4",
  "P5",        "P6", "P7", "P8",
];

const FRAME_W = 375;
const FRAME_H = 680;
const GAP = 10;

export default function MultiPage() {
  return (
    <div
      style={{
        background: "#10080c",
        minHeight: "100vh",
        padding: 16,
        fontFamily: "'Avenir Next', 'Trebuchet MS', sans-serif",
        color: "#f8ead8",
      }}
    >
      <div style={{ marginBottom: 14, fontSize: 13, color: "rgba(248,234,216,0.55)" }}>
        <strong style={{ color: "#f48d52" }}>Multi</strong>
        {" — "}
        svaki prozor je nezavisan. P1 kreira partiju, ostali se pridružuju istim kodom.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(4, ${FRAME_W}px)`,
          gap: GAP,
          width: "fit-content",
        }}
      >
        {FRAMES.map((label) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: label.includes("host") ? "#f48d52" : "rgba(248,234,216,0.45)",
              }}
            >
              {label}
            </div>
            <iframe
              src="/"
              style={{
                width: FRAME_W,
                height: FRAME_H,
                border: "1px solid rgba(255,220,180,0.16)",
                borderRadius: 14,
                background: "#10080c",
                display: "block",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
