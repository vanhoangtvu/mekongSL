import { GeoDisplaySettings } from "./geo-display-settings";

const navItems = [
  "Tìm kiếm",
  "Bộ dữ liệu",
  "Tiêu chí bổ sung",
  "Kết quả",
];

export function GeoSearchHeader() {
  return (
    <header className="geo-header">
      <div className="geo-header-copy">
        <p className="geo-eyebrow">Hệ thống tra cứu dữ liệu không gian</p>
        <h1 className="geo-title">Environment Data For Mekong</h1>
        <p className="geo-lead">
          Tra cứu dữ liệu khí tượng, thủy văn, bản đồ và cảnh báo theo khu vực,
          thời gian, nguồn dữ liệu và ngưỡng vận hành.
        </p>
      </div>

      <div className="geo-header-actions">
        <nav aria-label="Điều hướng chính" className="geo-tabs">
          {navItems.map((item, index) => (
            <a className={`geo-tab ${index === 0 ? "is-active" : ""}`} href="#" key={item}>
              {item}
            </a>
          ))}
        </nav>

        <GeoDisplaySettings />
      </div>
    </header>
  );
}
