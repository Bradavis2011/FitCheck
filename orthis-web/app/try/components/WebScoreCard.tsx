"use client";

interface WebScoreCardProps {
  score: number;
  whatsWorking: string[];
  occasion: string;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "#10B981";
  if (score >= 6) return "#F59E0B";
  return "#EF4444";
}

export default function WebScoreCard({ score, whatsWorking, occasion }: WebScoreCardProps) {
  const color = getScoreColor(score);

  return (
    <div
      style={{
        background: "#FBF7F4",
        border: "1px solid rgba(26,26,26,0.1)",
        padding: "32px",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      {/* Score */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: "italic",
            fontSize: "72px",
            lineHeight: 1,
            color,
            marginBottom: "4px",
          }}
        >
          {score}
        </div>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "rgba(26,26,26,0.5)",
          }}
        >
          out of 10 · {occasion}
        </div>
      </div>

      {/* Rule */}
      <div
        style={{
          height: "1px",
          background: "rgba(26,26,26,0.12)",
          margin: "0 0 24px",
        }}
      />

      {/* What's Working */}
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: "rgba(26,26,26,0.5)",
          marginBottom: "12px",
        }}
      >
        What's Working
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
        {whatsWorking.map((item, i) => (
          <li
            key={i}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "15px",
              color: "#1A1A1A",
              paddingBottom: "8px",
              borderBottom: i < whatsWorking.length - 1 ? "1px solid rgba(26,26,26,0.08)" : "none",
              marginBottom: i < whatsWorking.length - 1 ? "8px" : 0,
            }}
          >
            {item}
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: "rgba(26,26,26,0.3)",
          textAlign: "center",
        }}
      >
        orthis.app
      </div>
    </div>
  );
}
