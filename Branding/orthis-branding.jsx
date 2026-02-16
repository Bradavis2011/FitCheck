import React, { useState } from 'react';

const OrThisBranding = () => {
  const [activeSection, setActiveSection] = useState('overview');

  // Brand Colors
  const colors = {
    // Primary - "Decision Coral" - warm, confident, action-oriented
    coral: '#E85D4C',
    coralLight: '#FF7A6B',
    coralDark: '#C94A3A',
    
    // Secondary - "Confidence Cream" - sophisticated, warm neutral
    cream: '#FBF7F4',
    creamDark: '#F5EDE7',
    
    // Accent - "Clarity Black" - sharp, decisive
    black: '#1A1A1A',
    charcoal: '#2D2D2D',
    
    // Supporting - "Soft Sage" - calming, secondary actions
    sage: '#A8B5A0',
    sageLight: '#C4CFBD',
    
    // Functional
    white: '#FFFFFF',
    gray100: '#F8F8F8',
    gray200: '#E8E8E8',
    gray400: '#9B9B9B',
    gray600: '#666666',
  };

  const Logo = ({ size = 'large', variant = 'full', showTagline = false }) => {
    const sizes = {
      small: { height: 32, fontSize: 20, questionSize: 24 },
      medium: { height: 48, fontSize: 32, questionSize: 40 },
      large: { height: 72, fontSize: 48, questionSize: 60 },
      hero: { height: 120, fontSize: 80, questionSize: 100 },
    };
    
    const s = sizes[size];
    
    if (variant === 'mark') {
      return (
        <div style={{
          width: s.height,
          height: s.height,
          background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
          borderRadius: s.height * 0.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(232, 93, 76, 0.3)',
        }}>
          <span style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: s.questionSize * 0.6,
            fontWeight: 700,
            color: colors.white,
            fontStyle: 'italic',
          }}>?</span>
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: s.fontSize,
            fontWeight: 500,
            color: colors.black,
            letterSpacing: '-0.02em',
          }}>Or</span>
          <span style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: s.fontSize * 1.1,
            fontWeight: 600,
            fontStyle: 'italic',
            color: colors.coral,
            letterSpacing: '-0.01em',
          }}>This</span>
          <span style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: s.questionSize,
            fontWeight: 700,
            fontStyle: 'italic',
            color: colors.coral,
            marginLeft: -4,
            lineHeight: 0.8,
          }}>?</span>
        </div>
        {showTagline && (
          <span style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: s.fontSize * 0.22,
            fontWeight: 400,
            color: colors.gray600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginTop: 8,
          }}>Confidence in every choice</span>
        )}
      </div>
    );
  };

  const ColorSwatch = ({ name, hex, description }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        width: 120,
        height: 120,
        backgroundColor: hex,
        borderRadius: 16,
        boxShadow: hex === colors.white ? 'inset 0 0 0 1px #E8E8E8' : '0 4px 20px rgba(0,0,0,0.1)',
      }} />
      <div>
        <div style={{ 
          fontFamily: '"DM Sans", sans-serif', 
          fontSize: 14, 
          fontWeight: 600,
          color: colors.black 
        }}>{name}</div>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: 12, 
          color: colors.gray600 
        }}>{hex}</div>
        <div style={{ 
          fontFamily: '"DM Sans", sans-serif', 
          fontSize: 11, 
          color: colors.gray400,
          marginTop: 4,
        }}>{description}</div>
      </div>
    </div>
  );

  const Button = ({ variant = 'primary', size = 'medium', children }) => {
    const styles = {
      primary: {
        background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
        color: colors.white,
        border: 'none',
        boxShadow: '0 4px 20px rgba(232, 93, 76, 0.3)',
      },
      secondary: {
        background: colors.white,
        color: colors.coral,
        border: `2px solid ${colors.coral}`,
      },
      ghost: {
        background: 'transparent',
        color: colors.black,
        border: 'none',
      },
    };
    
    const sizeStyles = {
      small: { padding: '8px 16px', fontSize: 14 },
      medium: { padding: '12px 24px', fontSize: 16 },
      large: { padding: '16px 32px', fontSize: 18 },
    };
    
    return (
      <button style={{
        ...styles[variant],
        ...sizeStyles[size],
        fontFamily: '"DM Sans", sans-serif',
        fontWeight: 600,
        borderRadius: 100,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}>
        {children}
      </button>
    );
  };

  const Card = ({ children, style = {} }) => (
    <div style={{
      background: colors.white,
      borderRadius: 24,
      padding: 32,
      boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
      ...style,
    }}>
      {children}
    </div>
  );

  const NavItem = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        fontFamily: '"DM Sans", sans-serif',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        color: active ? colors.coral : colors.gray600,
        background: active ? colors.creamDark : 'transparent',
        border: 'none',
        padding: '10px 20px',
        borderRadius: 100,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  );

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'logo', label: 'Logo' },
    { id: 'colors', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'components', label: 'Components' },
    { id: 'application', label: 'In Use' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.cream,
      fontFamily: '"DM Sans", sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: '24px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${colors.creamDark}`,
        background: colors.cream,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Logo size="small" />
        <nav style={{ display: 'flex', gap: 8 }}>
          {sections.map(s => (
            <NavItem 
              key={s.id}
              label={s.label}
              active={activeSection === s.id}
              onClick={() => setActiveSection(s.id)}
            />
          ))}
        </nav>
      </header>

      {/* Content */}
      <main style={{ padding: '48px 48px 96px' }}>
        
        {/* Overview */}
        {activeSection === 'overview' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 80 }}>
              <Logo size="hero" showTagline />
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: 32,
              marginBottom: 64,
            }}>
              <Card>
                <div style={{ 
                  fontSize: 48, 
                  marginBottom: 16,
                  filter: 'grayscale(0)',
                }}>🤔</div>
                <h3 style={{ 
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 24,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: colors.black,
                }}>The Moment</h3>
                <p style={{ 
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: colors.gray600,
                }}>
                  Standing in front of the mirror, phone in hand, wondering "does this work?" 
                  That split-second of doubt before walking out the door.
                </p>
              </Card>
              
              <Card>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
                <h3 style={{ 
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 24,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: colors.black,
                }}>The Decision</h3>
                <p style={{ 
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: colors.gray600,
                }}>
                  OrThis? transforms uncertainty into confidence. Real-time feedback 
                  from AI and community turns "maybe" into "absolutely."
                </p>
              </Card>
              
              <Card>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                <h3 style={{ 
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 24,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: colors.black,
                }}>The Confidence</h3>
                <p style={{ 
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: colors.gray600,
                }}>
                  Walk out knowing you nailed it. Every outfit, every occasion, 
                  every day — confidence in every choice.
                </p>
              </Card>
            </div>

            <Card style={{ 
              background: `linear-gradient(135deg, ${colors.charcoal} 0%, ${colors.black} 100%)`,
              padding: 48,
            }}>
              <h3 style={{ 
                fontFamily: '"Playfair Display", serif',
                fontSize: 32,
                fontWeight: 600,
                color: colors.white,
                marginBottom: 24,
              }}>Brand Essence</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
                {[
                  { word: 'Decisive', desc: 'Clear answers, not endless scrolling' },
                  { word: 'Warm', desc: 'Supportive, not judgmental' },
                  { word: 'Confident', desc: 'Bold recommendations, not hedging' },
                  { word: 'Real', desc: 'Honest feedback, not flattery' },
                ].map(({ word, desc }) => (
                  <div key={word}>
                    <div style={{ 
                      fontFamily: '"Playfair Display", serif',
                      fontSize: 24,
                      fontStyle: 'italic',
                      color: colors.coral,
                      marginBottom: 8,
                    }}>{word}</div>
                    <div style={{ 
                      fontSize: 14,
                      color: colors.gray400,
                      lineHeight: 1.5,
                    }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Logo */}
        {activeSection === 'logo' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ 
              fontFamily: '"Playfair Display", serif',
              fontSize: 40,
              marginBottom: 48,
              color: colors.black,
            }}>Logo System</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, marginBottom: 48 }}>
              <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <Logo size="hero" showTagline />
              </Card>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Card style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: colors.black,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{
                      fontFamily: '"DM Sans", sans-serif',
                      fontSize: 48,
                      fontWeight: 500,
                      color: colors.white,
                      letterSpacing: '-0.02em',
                    }}>Or</span>
                    <span style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontSize: 48 * 1.1,
                      fontWeight: 600,
                      fontStyle: 'italic',
                      color: colors.coralLight,
                      letterSpacing: '-0.01em',
                    }}>This</span>
                    <span style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontSize: 60,
                      fontWeight: 700,
                      fontStyle: 'italic',
                      color: colors.coralLight,
                      marginLeft: -4,
                      lineHeight: 0.8,
                    }}>?</span>
                  </div>
                </Card>
                
                <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                  <Logo size="small" variant="mark" />
                  <Logo size="medium" variant="mark" />
                  <Logo size="large" variant="mark" />
                </Card>
              </div>
            </div>

            <Card style={{ marginBottom: 48 }}>
              <h3 style={{ 
                fontFamily: '"Playfair Display", serif',
                fontSize: 24,
                marginBottom: 24,
                color: colors.black,
              }}>Logo Construction</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 48 }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: colors.coral, marginBottom: 12 }}>
                    TYPOGRAPHY PAIRING
                  </h4>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: colors.gray600 }}>
                    <strong>"Or"</strong> uses DM Sans Medium — clean, modern, representing the practical side of getting dressed.
                    <br /><br />
                    <strong>"This?"</strong> uses Playfair Display Italic — elegant, expressive, representing personal style and confidence.
                    <br /><br />
                    The contrast creates tension between the everyday question and the transformative answer.
                  </p>
                </div>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: colors.coral, marginBottom: 12 }}>
                    THE QUESTION MARK
                  </h4>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: colors.gray600 }}>
                    Oversized and italicized, the question mark is the soul of the brand. It represents:
                    <br /><br />
                    • The moment of decision<br />
                    • Curiosity and exploration<br />
                    • The invitation to ask for feedback<br />
                    • Forward momentum (the italic lean)
                  </p>
                </div>
              </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {['Hero', 'Large', 'Medium', 'Small'].map((size, i) => (
                <Card key={size} style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: 16, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Logo size={['hero', 'large', 'medium', 'small'][i]} />
                  </div>
                  <div style={{ fontSize: 12, color: colors.gray600 }}>{size}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Colors */}
        {activeSection === 'colors' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ 
              fontFamily: '"Playfair Display", serif',
              fontSize: 40,
              marginBottom: 48,
              color: colors.black,
            }}>Color Palette</h2>

            <Card style={{ marginBottom: 48 }}>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 24,
              }}>PRIMARY</h3>
              <div style={{ display: 'flex', gap: 32 }}>
                <ColorSwatch name="Decision Coral" hex={colors.coral} description="Primary actions, emphasis" />
                <ColorSwatch name="Coral Light" hex={colors.coralLight} description="Gradients, hover states" />
                <ColorSwatch name="Coral Dark" hex={colors.coralDark} description="Active states, depth" />
              </div>
            </Card>

            <Card style={{ marginBottom: 48 }}>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 24,
              }}>NEUTRALS</h3>
              <div style={{ display: 'flex', gap: 32 }}>
                <ColorSwatch name="Confidence Cream" hex={colors.cream} description="Backgrounds" />
                <ColorSwatch name="Cream Dark" hex={colors.creamDark} description="Cards, sections" />
                <ColorSwatch name="Clarity Black" hex={colors.black} description="Text, icons" />
                <ColorSwatch name="Charcoal" hex={colors.charcoal} description="Secondary text" />
              </div>
            </Card>

            <Card style={{ marginBottom: 48 }}>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 24,
              }}>ACCENT</h3>
              <div style={{ display: 'flex', gap: 32 }}>
                <ColorSwatch name="Soft Sage" hex={colors.sage} description="Success, secondary" />
                <ColorSwatch name="Sage Light" hex={colors.sageLight} description="Backgrounds, tags" />
                <ColorSwatch name="Pure White" hex={colors.white} description="Cards, inputs" />
              </div>
            </Card>

            <Card style={{ 
              background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
              padding: 48,
            }}>
              <h3 style={{ 
                fontFamily: '"Playfair Display", serif',
                fontSize: 28,
                color: colors.white,
                marginBottom: 16,
              }}>Why Coral?</h3>
              <p style={{ 
                fontSize: 16,
                lineHeight: 1.7,
                color: 'rgba(255,255,255,0.9)',
                maxWidth: 600,
              }}>
                Coral sits between red's confidence and orange's warmth. It's energetic without being aggressive, 
                feminine without being limiting. It photographs well, stands out in app stores, and creates 
                an emotional connection that feels both exciting and supportive.
              </p>
            </Card>
          </div>
        )}

        {/* Typography */}
        {activeSection === 'typography' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ 
              fontFamily: '"Playfair Display", serif',
              fontSize: 40,
              marginBottom: 48,
              color: colors.black,
            }}>Typography</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32, marginBottom: 48 }}>
              <Card>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: colors.coral,
                  letterSpacing: '0.1em',
                  marginBottom: 24,
                }}>DISPLAY</div>
                <div style={{ 
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: 64,
                  fontWeight: 600,
                  fontStyle: 'italic',
                  color: colors.black,
                  lineHeight: 1.1,
                  marginBottom: 24,
                }}>
                  Playfair Display
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: colors.gray600 }}>
                  Used for headlines, the logo wordmark, and moments of emphasis. 
                  The italic style adds personality and forward momentum.
                </p>
              </Card>

              <Card>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: colors.coral,
                  letterSpacing: '0.1em',
                  marginBottom: 24,
                }}>BODY</div>
                <div style={{ 
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: 64,
                  fontWeight: 500,
                  color: colors.black,
                  lineHeight: 1.1,
                  marginBottom: 24,
                }}>
                  DM Sans
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: colors.gray600 }}>
                  Used for body text, UI elements, and the "Or" in the logo. 
                  Clean and highly legible at all sizes.
                </p>
              </Card>
            </div>

            <Card>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 32,
              }}>TYPE SCALE</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { size: 48, weight: 600, family: 'Playfair Display', label: 'H1 / Hero', sample: 'Which one makes you feel amazing?' },
                  { size: 32, weight: 600, family: 'Playfair Display', label: 'H2 / Section', sample: 'Your Style, Your Rules' },
                  { size: 24, weight: 600, family: 'Playfair Display', label: 'H3 / Card Title', sample: 'Date Night Ready' },
                  { size: 18, weight: 500, family: 'DM Sans', label: 'Body Large', sample: 'Get instant feedback on your outfit choices' },
                  { size: 16, weight: 400, family: 'DM Sans', label: 'Body', sample: 'Upload a photo and let the community decide' },
                  { size: 14, weight: 400, family: 'DM Sans', label: 'Small', sample: 'Posted 2 hours ago • 47 votes' },
                  { size: 12, weight: 600, family: 'DM Sans', label: 'Caption', sample: 'TAP TO COMPARE' },
                ].map(({ size, weight, family, label, sample }) => (
                  <div key={label} style={{ 
                    display: 'flex', 
                    alignItems: 'baseline',
                    borderBottom: `1px solid ${colors.gray200}`,
                    paddingBottom: 16,
                  }}>
                    <div style={{ 
                      width: 120, 
                      fontSize: 12, 
                      color: colors.gray400,
                      fontWeight: 500,
                    }}>{label}</div>
                    <div style={{ 
                      width: 80, 
                      fontSize: 12, 
                      color: colors.gray400,
                      fontFamily: 'monospace',
                    }}>{size}px</div>
                    <div style={{ 
                      flex: 1,
                      fontFamily: family === 'Playfair Display' ? '"Playfair Display", serif' : '"DM Sans", sans-serif',
                      fontSize: size,
                      fontWeight: weight,
                      fontStyle: family === 'Playfair Display' && size > 20 ? 'italic' : 'normal',
                      color: colors.black,
                    }}>{sample}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Components */}
        {activeSection === 'components' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ 
              fontFamily: '"Playfair Display", serif',
              fontSize: 40,
              marginBottom: 48,
              color: colors.black,
            }}>UI Components</h2>

            <Card style={{ marginBottom: 32 }}>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 24,
              }}>BUTTONS</h3>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="primary" size="large">This One!</Button>
                <Button variant="primary" size="medium">Get Feedback</Button>
                <Button variant="secondary" size="medium">Or This?</Button>
                <Button variant="ghost" size="medium">Skip</Button>
              </div>
            </Card>

            <Card style={{ marginBottom: 32 }}>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 24,
              }}>VOTING INTERFACE</h3>
              <div style={{ 
                display: 'flex', 
                gap: 24, 
                alignItems: 'stretch',
                maxWidth: 600,
              }}>
                <div style={{
                  flex: 1,
                  aspectRatio: '3/4',
                  background: `linear-gradient(180deg, ${colors.creamDark} 0%, ${colors.gray200} 100%)`,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  color: colors.gray400,
                  border: `3px solid transparent`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}>
                  <span>Outfit A</span>
                  <div style={{
                    position: 'absolute',
                    bottom: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: colors.coral,
                    color: colors.white,
                    padding: '4px 12px',
                    borderRadius: 100,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>67%</div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: '"Playfair Display", serif',
                    fontSize: 24,
                    fontStyle: 'italic',
                    color: colors.gray400,
                  }}>or</span>
                </div>
                <div style={{
                  flex: 1,
                  aspectRatio: '3/4',
                  background: `linear-gradient(180deg, ${colors.creamDark} 0%, ${colors.gray200} 100%)`,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  color: colors.gray400,
                  cursor: 'pointer',
                }}>
                  <span>Outfit B</span>
                </div>
              </div>
            </Card>

            <Card style={{ marginBottom: 32 }}>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 24,
              }}>TAGS & BADGES</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {['Date Night', 'Work', 'Casual', 'Wedding', 'Brunch', 'Interview'].map(tag => (
                  <span key={tag} style={{
                    background: colors.creamDark,
                    color: colors.charcoal,
                    padding: '6px 14px',
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 500,
                  }}>{tag}</span>
                ))}
                <span style={{
                  background: colors.sageLight,
                  color: '#5A6B52',
                  padding: '6px 14px',
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 500,
                }}>✓ Verified Stylist</span>
                <span style={{
                  background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
                  color: colors.white,
                  padding: '6px 14px',
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 600,
                }}>🔥 Trending</span>
              </div>
            </Card>

            <Card>
              <h3 style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: colors.coral,
                letterSpacing: '0.1em',
                marginBottom: 24,
              }}>DESIGN PRINCIPLES</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
                <div>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>◐</div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: colors.black }}>
                    Generous Radius
                  </h4>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: colors.gray600 }}>
                    Soft, rounded corners (16-24px) feel approachable and modern. Pill-shaped buttons invite tapping.
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>◧</div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: colors.black }}>
                    Confident Whitespace
                  </h4>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: colors.gray600 }}>
                    Let content breathe. Generous padding creates hierarchy and reduces visual stress.
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: colors.black }}>
                    Subtle Depth
                  </h4>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: colors.gray600 }}>
                    Soft shadows and layering create hierarchy without harsh borders. Cards float gently above backgrounds.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Application */}
        {activeSection === 'application' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ 
              fontFamily: '"Playfair Display", serif',
              fontSize: 40,
              marginBottom: 48,
              color: colors.black,
            }}>In Application</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32 }}>
              {/* Phone Mockup */}
              <div style={{
                background: colors.black,
                borderRadius: 40,
                padding: 12,
                boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
              }}>
                <div style={{
                  background: colors.cream,
                  borderRadius: 32,
                  overflow: 'hidden',
                  aspectRatio: '9/19.5',
                }}>
                  {/* Status Bar */}
                  <div style={{
                    height: 44,
                    background: colors.cream,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 8,
                  }}>
                    <div style={{
                      width: 80,
                      height: 24,
                      background: colors.black,
                      borderRadius: 12,
                    }} />
                  </div>
                  
                  {/* App Content */}
                  <div style={{ padding: 16 }}>
                    <Logo size="small" />
                    
                    <div style={{ 
                      marginTop: 24,
                      fontFamily: '"Playfair Display", serif',
                      fontSize: 22,
                      fontStyle: 'italic',
                      color: colors.black,
                      lineHeight: 1.3,
                    }}>
                      Which one for<br />date night?
                    </div>
                    
                    <div style={{ 
                      marginTop: 20,
                      display: 'flex',
                      gap: 12,
                    }}>
                      <div style={{
                        flex: 1,
                        aspectRatio: '3/4',
                        background: `linear-gradient(135deg, ${colors.coralLight}22 0%, ${colors.coral}33 100%)`,
                        borderRadius: 12,
                        border: `2px solid ${colors.coral}`,
                      }} />
                      <div style={{
                        flex: 1,
                        aspectRatio: '3/4',
                        background: colors.gray100,
                        borderRadius: 12,
                      }} />
                    </div>
                    
                    <div style={{
                      marginTop: 16,
                      display: 'flex',
                      gap: 8,
                    }}>
                      <div style={{
                        flex: 1,
                        background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
                        color: colors.white,
                        padding: '12px 16px',
                        borderRadius: 100,
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: 'center',
                      }}>This One! 🔥</div>
                      <div style={{
                        flex: 1,
                        background: colors.white,
                        color: colors.coral,
                        padding: '12px 16px',
                        borderRadius: 100,
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: 'center',
                        border: `2px solid ${colors.coral}`,
                      }}>Or This?</div>
                    </div>
                    
                    <div style={{
                      marginTop: 24,
                      padding: 16,
                      background: colors.white,
                      borderRadius: 16,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ 
                        fontSize: 11, 
                        fontWeight: 600, 
                        color: colors.coral,
                        letterSpacing: '0.1em',
                        marginBottom: 8,
                      }}>AI FEEDBACK</div>
                      <div style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: colors.charcoal,
                      }}>
                        "The wrap dress creates a beautiful silhouette. Pair with gold accessories to elevate the look."
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Brand Applications */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Card>
                  <h3 style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: colors.coral,
                    letterSpacing: '0.1em',
                    marginBottom: 16,
                  }}>APP ICON</h3>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
                    <div style={{
                      width: 120,
                      height: 120,
                      background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
                      borderRadius: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 32px rgba(232, 93, 76, 0.4)',
                    }}>
                      <span style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 64,
                        fontWeight: 700,
                        color: colors.white,
                        fontStyle: 'italic',
                      }}>?</span>
                    </div>
                    <div style={{
                      width: 80,
                      height: 80,
                      background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
                      borderRadius: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 42,
                        fontWeight: 700,
                        color: colors.white,
                        fontStyle: 'italic',
                      }}>?</span>
                    </div>
                    <div style={{
                      width: 60,
                      height: 60,
                      background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 32,
                        fontWeight: 700,
                        color: colors.white,
                        fontStyle: 'italic',
                      }}>?</span>
                    </div>
                  </div>
                </Card>

                <Card style={{
                  background: `linear-gradient(135deg, ${colors.charcoal} 0%, ${colors.black} 100%)`,
                }}>
                  <h3 style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: colors.coral,
                    letterSpacing: '0.1em',
                    marginBottom: 16,
                  }}>SOCIAL CARD</h3>
                  <div style={{
                    background: colors.cream,
                    borderRadius: 16,
                    padding: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <Logo size="medium" />
                      <p style={{
                        marginTop: 12,
                        fontSize: 16,
                        color: colors.gray600,
                      }}>Confidence in every choice</p>
                    </div>
                    <div style={{
                      width: 80,
                      height: 80,
                      background: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.coralLight} 100%)`,
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 48,
                        fontWeight: 700,
                        color: colors.white,
                        fontStyle: 'italic',
                      }}>?</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: colors.coral,
                    letterSpacing: '0.1em',
                    marginBottom: 16,
                  }}>VOICE & TONE</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 12, color: colors.sage, marginBottom: 8, fontWeight: 600 }}>✓ DO</div>
                      <ul style={{ fontSize: 14, lineHeight: 1.8, color: colors.charcoal, paddingLeft: 16 }}>
                        <li>"You've got this!"</li>
                        <li>"Both are gorgeous—here's why..."</li>
                        <li>"The community has spoken 🔥"</li>
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: colors.coralDark, marginBottom: 8, fontWeight: 600 }}>✗ DON'T</div>
                      <ul style={{ fontSize: 14, lineHeight: 1.8, color: colors.charcoal, paddingLeft: 16 }}>
                        <li>"This outfit is wrong"</li>
                        <li>"You should probably change..."</li>
                        <li>"Not flattering"</li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default OrThisBranding;
