import React from 'react';

export default function OrThisLogoDisplay() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-16 p-8" style={{ background: '#FBF7F4' }}>
      
      {/* Hero Logo */}
      <div className="text-center">
        <div className="flex items-baseline justify-center">
          <span style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '96px',
            fontWeight: 500,
            color: '#1A1A1A',
            letterSpacing: '-0.02em',
          }}>Or</span>
          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: '106px',
            fontWeight: 600,
            fontStyle: 'italic',
            color: '#E85D4C',
            letterSpacing: '-0.01em',
          }}>This</span>
          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: '120px',
            fontWeight: 700,
            fontStyle: 'italic',
            color: '#E85D4C',
            marginLeft: '-8px',
            lineHeight: 0.8,
          }}>?</span>
        </div>
        <div style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          fontWeight: 400,
          color: '#666666',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginTop: '20px',
        }}>Confidence in every choice</div>
      </div>

      {/* Logo Variations Row */}
      <div className="flex gap-12 items-end flex-wrap justify-center">
        
        {/* On Light Background */}
        <div className="text-center">
          <div style={{
            background: '#FFFFFF',
            padding: '32px 48px',
            borderRadius: '20px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          }}>
            <div className="flex items-baseline">
              <span style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '42px',
                fontWeight: 500,
                color: '#1A1A1A',
              }}>Or</span>
              <span style={{
                fontFamily: 'Georgia, serif',
                fontSize: '46px',
                fontWeight: 600,
                fontStyle: 'italic',
                color: '#E85D4C',
              }}>This</span>
              <span style={{
                fontFamily: 'Georgia, serif',
                fontSize: '52px',
                fontWeight: 700,
                fontStyle: 'italic',
                color: '#E85D4C',
                marginLeft: '-4px',
              }}>?</span>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '12px' }}>On Light</p>
        </div>

        {/* On Dark Background */}
        <div className="text-center">
          <div style={{
            background: 'linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 100%)',
            padding: '32px 48px',
            borderRadius: '20px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          }}>
            <div className="flex items-baseline">
              <span style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '42px',
                fontWeight: 500,
                color: '#FFFFFF',
              }}>Or</span>
              <span style={{
                fontFamily: 'Georgia, serif',
                fontSize: '46px',
                fontWeight: 600,
                fontStyle: 'italic',
                color: '#FF7A6B',
              }}>This</span>
              <span style={{
                fontFamily: 'Georgia, serif',
                fontSize: '52px',
                fontWeight: 700,
                fontStyle: 'italic',
                color: '#FF7A6B',
                marginLeft: '-4px',
              }}>?</span>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '12px' }}>On Dark</p>
        </div>

        {/* App Icon */}
        <div className="text-center">
          <div style={{
            width: '100px',
            height: '100px',
            background: 'linear-gradient(135deg, #E85D4C 0%, #FF7A6B 100%)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(232, 93, 76, 0.4)',
          }}>
            <span style={{
              fontFamily: 'Georgia, serif',
              fontSize: '60px',
              fontWeight: 700,
              color: '#FFFFFF',
              fontStyle: 'italic',
              marginTop: '-4px',
            }}>?</span>
          </div>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '12px' }}>App Icon</p>
        </div>
      </div>

      {/* Color Swatches */}
      <div className="flex gap-6">
        <div className="text-center">
          <div style={{
            width: '50px',
            height: '50px',
            background: '#E85D4C',
            borderRadius: '10px',
          }} />
          <p style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>Coral</p>
        </div>
        <div className="text-center">
          <div style={{
            width: '50px',
            height: '50px',
            background: '#1A1A1A',
            borderRadius: '10px',
          }} />
          <p style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>Black</p>
        </div>
        <div className="text-center">
          <div style={{
            width: '50px',
            height: '50px',
            background: '#FBF7F4',
            borderRadius: '10px',
            border: '1px solid #E8E8E8',
          }} />
          <p style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>Cream</p>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#999', textAlign: 'center' }}>
        <strong>Fonts:</strong> DM Sans + Playfair Display Italic
      </p>
    </div>
  );
}
