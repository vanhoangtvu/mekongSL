export default function Loading() {
  return (
    <main className="page-shell">
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 50%, #f0fdfa 100%)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gap: '24px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2563eb, #0891b2)',
                }}
              />
              <div style={{ display: 'grid', gap: '10px', width: '100%' }}>
                <div style={{ height: '22px', width: '260px', borderRadius: '999px', background: '#e5e7eb' }} />
                <div style={{ height: '14px', width: '180px', borderRadius: '999px', background: '#eef2f7' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ height: '48px', borderRadius: '12px', background: '#f3f4f6' }} />
              <div style={{ height: '48px', borderRadius: '12px', background: '#f3f4f6' }} />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ height: '38px', width: '88px', borderRadius: '999px', background: '#e5e7eb' }} />
              <div style={{ height: '38px', width: '56px', borderRadius: '999px', background: '#eef2f7' }} />
              <div style={{ height: '38px', width: '56px', borderRadius: '999px', background: '#eef2f7' }} />
              <div style={{ height: '38px', width: '56px', borderRadius: '999px', background: '#eef2f7' }} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              padding: '24px',
            }}
          >
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ height: '20px', width: '180px', borderRadius: '999px', background: '#e5e7eb' }} />
              <div style={{ height: '20px', width: '100%', borderRadius: '999px', background: '#f3f4f6' }} />
              <div style={{ height: '20px', width: '92%', borderRadius: '999px', background: '#f3f4f6' }} />
              <div style={{ height: '20px', width: '96%', borderRadius: '999px', background: '#f3f4f6' }} />
              <div style={{ height: '20px', width: '88%', borderRadius: '999px', background: '#f3f4f6' }} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}