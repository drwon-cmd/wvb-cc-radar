import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'wvb-cc-radar — Claude Code Ecosystem Daily Digest';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#02030a',
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(62,207,197,0.18) 0%, transparent 55%), radial-gradient(circle at 85% 85%, rgba(245,166,35,0.10) 0%, transparent 55%)',
          padding: '96px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '9999px',
              backgroundColor: '#3ecfc5',
            }}
          />
          <div
            style={{
              fontSize: '28px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#3ecfc5',
            }}
          >
            REC · Daily Digest
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '92px',
            fontWeight: 800,
            color: '#f5f7fa',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          WVB CC Radar
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '36px',
            color: 'rgba(245,247,250,0.6)',
            marginTop: '24px',
          }}
        >
          Claude Code 생태계 트렌드 레이더
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '26px',
            color: '#F5A623',
            marginTop: '48px',
          }}
        >
          curated by Wilt Venture Builder
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
