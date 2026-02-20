import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Or This? — AI Outfit Feedback';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #E85D4C 0%, #FF7A6B 60%, #C94A3A 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 80px',
        }}
      >
        {/* Big italic ? mark */}
        <div
          style={{
            position: 'absolute',
            right: 60,
            top: 40,
            fontSize: 320,
            color: 'rgba(255,255,255,0.12)',
            fontStyle: 'italic',
            fontFamily: 'serif',
            lineHeight: 1,
          }}
        >
          ?
        </div>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, marginBottom: 32 }}>
          <span style={{ color: 'white', fontSize: 72, fontWeight: 500, letterSpacing: '-1px' }}>
            Or
          </span>
          <span style={{ color: 'white', fontSize: 72, fontStyle: 'italic', fontFamily: 'serif', marginLeft: 10 }}>
            This?
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            color: 'rgba(255,255,255,0.95)',
            fontSize: 36,
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
            marginBottom: 16,
          }}
        >
          Stop texting friends "does this look ok?"
        </div>

        <div
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 26,
            textAlign: 'center',
            marginBottom: 56,
          }}
        >
          AI outfit feedback before you walk out the door
        </div>

        {/* CTA pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'white',
            borderRadius: 60,
            padding: '18px 48px',
          }}
        >
          <span style={{ color: '#E85D4C', fontSize: 28, fontWeight: 700 }}>
            Join the waitlist — OrThis.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
