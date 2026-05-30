export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>⚽ WC2026 Prediction Game</h1>
      <p>Scaffold đang chạy. Game dự đoán FIFA World Cup 2026 — point ảo, không cá cược tiền thật.</p>
      <ul>
        <li>Healthcheck: <code>/api/health</code></li>
        <li>API mẫu (stub): <code>POST /api/v1/predictions</code></li>
        <li>Tài liệu: <code>docs/prd/</code> · <code>docs/solution-design/</code></li>
      </ul>
      <p>Bước kế: implement theo ưu tiên P0 (auth → pipeline → scoring/settle → leaderboard).</p>
    </main>
  );
}
