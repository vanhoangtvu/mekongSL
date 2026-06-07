import Link from "next/link";
import { Metadata } from "next";
import { AppHeader } from "../../../components/layout/app-header";
import { AppFooter } from "../../../components/layout/app-footer";

export const metadata: Metadata = {
  title: "Tin tức & Cập nhật - WebGIS",
  description: "Cập nhật các tin tức, sự kiện và thông báo mới nhất từ hệ thống WebGIS.",
};

// Mock data cho tin tức
const MOCK_NEWS = [
  {
    id: "1",
    title: "Phát hành phiên bản hệ thống giám sát thủy văn 2.0",
    excerpt: "Hệ thống giám sát thủy văn Mekong chính thức cập nhật phiên bản 2.0 với nhiều tính năng mới, bao gồm cải thiện độ chính xác dữ liệu và tối ưu hóa giao diện hiển thị.",
    date: "2026-06-05",
    category: "Cập nhật hệ thống",
    imageUrl: "https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&q=80&w=600&h=400",
  },
  {
    id: "2",
    title: "Công bố dữ liệu thời tiết tháng 5/2026",
    excerpt: "Báo cáo tổng hợp dữ liệu thời tiết khu vực đồng bằng sông Cửu Long tháng 5 đã được cập nhật lên hệ thống. Người dùng có thể tải xuống trong mục Data Ops.",
    date: "2026-06-02",
    category: "Dữ liệu",
    imageUrl: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&q=80&w=600&h=400",
  },
  {
    id: "3",
    title: "Bảo trì định kỳ cụm máy chủ khu vực miền Nam",
    excerpt: "Thông báo bảo trì định kỳ cụm máy chủ dữ liệu vào cuối tuần này. Một số dịch vụ có thể gián đoạn trong khoảng thời gian từ 00:00 đến 04:00 Chủ Nhật.",
    date: "2026-05-28",
    category: "Thông báo",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=600&h=400",
  },
  {
    id: "4",
    title: "Hội thảo: Ứng dụng WebGIS trong quản lý tài nguyên nước",
    excerpt: "Kính mời quý đối tác và người dùng tham dự hội thảo trực tuyến về việc ứng dụng công nghệ WebGIS hiện đại trong việc quản lý và phân tích tài nguyên nước bền vững.",
    date: "2026-05-20",
    category: "Sự kiện",
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=600&h=400",
  },
  {
    id: "5",
    title: "Tích hợp bản đồ vệ tinh độ phân giải cao mới",
    excerpt: "Hệ thống vừa tích hợp thêm lớp bản đồ vệ tinh độ phân giải cao, hỗ trợ phân tích biến động sử dụng đất chính xác hơn theo thời gian thực.",
    date: "2026-05-15",
    category: "Tính năng mới",
    imageUrl: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600&h=400",
  },
  {
    id: "6",
    title: "Hướng dẫn xuất dữ liệu theo chuẩn định dạng mới",
    excerpt: "Tài liệu hướng dẫn chi tiết các bước xuất dữ liệu từ trạm Ecowitt và các trạm thủy văn Mekong theo định dạng chuẩn quốc tế vừa được ban hành.",
    date: "2026-05-10",
    category: "Hướng dẫn",
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=600&h=400",
  },
];

export default function NewsPage() {
  return (
    <div className="app-container public-home">
      <AppHeader />
      <main className="page-shell news-page">
        <div className="news-header">
          <h1 className="news-title">Tin tức & Cập nhật</h1>
          <p className="news-subtitle">
            Theo dõi các sự kiện, tính năng mới và thông báo quan trọng từ hệ thống.
          </p>
        </div>

        <div className="news-filters">
          <button className="news-filter-btn is-active">Tất cả</button>
          <button className="news-filter-btn">Hệ thống</button>
          <button className="news-filter-btn">Dữ liệu</button>
          <button className="news-filter-btn">Sự kiện</button>
        </div>

        <div className="news-grid">
          {MOCK_NEWS.map((news) => (
            <article key={news.id} className="news-card">
              <div className="news-card-image">
                <img src={news.imageUrl} alt={news.title} loading="lazy" />
                <span className="news-card-category">{news.category}</span>
              </div>
              <div className="news-card-content">
                <time dateTime={news.date} className="news-card-date">
                  {new Date(news.date).toLocaleDateString("vi-VN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2 className="news-card-title">
                  <Link href={`/news/${news.id}`}>{news.title}</Link>
                </h2>
                <p className="news-card-excerpt">{news.excerpt}</p>
                <Link href={`/news/${news.id}`} className="news-card-readmore">
                  Đọc tiếp
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
