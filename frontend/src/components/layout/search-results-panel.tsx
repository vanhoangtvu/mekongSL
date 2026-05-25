const results = [
  {
    title: "Trạm mưa Cầu Quan",
    meta: "Mưa 24h: 128 mm • Cập nhật 5 phút trước",
    tone: "Nguy cơ cao",
  },
  {
    title: "Trạm thủy văn Cầu Ngang",
    meta: "Mực nước: 2.84 m • Đang tăng nhẹ",
    tone: "Theo dõi",
  },
  {
    title: "Vùng cảnh báo Trà Vinh",
    meta: "Cấp 2 • Bán kính ảnh hưởng 18 km",
    tone: "Cảnh báo",
  },
];

export function SearchResultsPanel() {
  return (
    <aside className="geo-panel geo-results">
      <section className="geo-block">
        <div className="geo-block-head">
          <h2>Kết quả</h2>
          <span>03 mục</span>
        </div>
        <p>
          Danh sách dưới đây mô phỏng cách kết quả được gom theo trạm, vùng và
          cảnh báo liên quan.
        </p>
      </section>

      <div className="geo-result-list">
        {results.map((item) => (
          <article className="geo-result-item" key={item.title}>
            <div>
              <h3>{item.title}</h3>
              <p>{item.meta}</p>
            </div>
            <span>{item.tone}</span>
          </article>
        ))}
      </div>

      <section className="geo-block geo-summary">
        <h3>Tóm tắt tiêu chí</h3>
        <ul>
          <li>Khu vực: Trà Vinh</li>
          <li>Thời gian: 01/05/2026 - 09/05/2026</li>
          <li>Dữ liệu: mưa, mực nước, radar</li>
        </ul>
      </section>
    </aside>
  );
}
