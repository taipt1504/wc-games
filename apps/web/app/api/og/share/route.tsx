import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const name = searchParams.get('name') || 'Player';
  const roi = searchParams.get('roi') || '0';
  const won = searchParams.get('won') || '0';
  const settled = searchParams.get('settled') || '0';
  const rank = searchParams.get('rank') || '—';
  const tier = searchParams.get('tier') || 'Bronze';
  const streak = searchParams.get('streak') || '';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(160deg, #070B16 0%, #0D1626 60%, #091220 100%)',
          padding: '60px 72px',
          fontFamily: 'sans-serif',
          color: '#E8EDF5',
        }}
      >
        {/* GOLAZO wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              display: 'flex',
              background: '#2BE08A',
              borderRadius: 10,
              padding: '6px 14px',
              fontSize: 22,
              fontWeight: 900,
              color: '#070B16',
              letterSpacing: '0.08em',
            }}
          >
            GOLAZO
          </div>
          <div style={{ display: 'flex', fontSize: 18, color: '#7B8DAE', letterSpacing: '0.04em' }}>
            World Cup Predictions
          </div>
        </div>

        {/* Player name + tier */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 900, color: '#E8EDF5', lineHeight: 1 }}>
            {name}
          </div>
          <div
            style={{
              display: 'flex',
              background: '#FFC83D22',
              border: '1px solid #FFC83D55',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 18,
              fontWeight: 700,
              color: '#FFC83D',
            }}
          >
            {tier}
          </div>
        </div>

        {/* Rank */}
        <div style={{ display: 'flex', fontSize: 20, color: '#3FC0F0', marginBottom: 48 }}>
          Global rank #{rank}
        </div>

        {/* Big stat row */}
        <div style={{ display: 'flex', gap: 48, marginBottom: 48 }}>
          {/* ROI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 80, fontWeight: 900, color: '#2BE08A', lineHeight: 1 }}>
              +{roi}%
            </div>
            <div style={{ display: 'flex', fontSize: 20, color: '#7B8DAE', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ROI
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', width: 2, height: 80, background: '#1E2D4A', alignSelf: 'center' }} />

          {/* Record */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 80, fontWeight: 900, color: '#E8EDF5', lineHeight: 1 }}>
              {won}<span style={{ color: '#3A4D6A' }}>/{settled}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 20, color: '#7B8DAE', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Won / Settled
            </div>
          </div>
        </div>

        {/* Streak badge (conditional) */}
        {streak && streak !== '0' ? (
          <div style={{ display: 'flex', marginBottom: 48 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#FFC83D18',
                border: '1px solid #FFC83D44',
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 24,
                fontWeight: 700,
                color: '#FFC83D',
              }}
            >
              🔥 {streak}-bet win streak
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', marginBottom: 48 }} />
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            borderTop: '1px solid #1E2D4A',
            paddingTop: 24,
            fontSize: 16,
            color: '#3A4D6A',
          }}
        >
          wc-game · virtual points only · golazo.gg
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
