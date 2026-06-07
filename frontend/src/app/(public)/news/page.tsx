import Link from "next/link";
import { Metadata } from "next";
import { AppHeader } from "../../../components/layout/app-header";
import { AppFooter } from "../../../components/layout/app-footer";

export const metadata: Metadata = {
  title: "Tin tức & Cập nhật - WebGIS",
  description: "Cập nhật các tin tức, sự kiện và thông báo mới nhất từ hệ thống WebGIS.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://14.227.143.142:8084/api";

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl: string;
  tags: string;
  published: boolean;
  featured: boolean;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
}

interface NewsPage {
  content: NewsArticle[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface SpringPageData {
  content: NewsArticle[];
  page: { number: number; size: number; totalElements: number; totalPages: number };
}

async function getNews(category?: string, page = 0): Promise<NewsPage> {
  const url = new URL(`${API_URL}/articles/public`);
  if (category) url.searchParams.set("category", category);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", "9");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 9 };
    const springPage: SpringPageData = await res.json();
    return {
      content: springPage.content,
      number: springPage.page.number,
      size: springPage.page.size,
      totalElements: springPage.page.totalElements,
      totalPages: springPage.page.totalPages,
    };
  } catch {
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 9 };
  }
}

const CATEGORIES = ["Tất cả", "Cập nhật hệ thống", "Dữ liệu", "Thông báo", "Sự kiện", "Tính năng mới", "Hướng dẫn"];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category || "";
  const currentPage = Math.max(0, parseInt(params.page || "0", 10) || 0);
  const { content: articles, totalPages, number: pageNum } = await getNews(activeCategory || undefined, currentPage);

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
          {CATEGORIES.map((cat) => {
            const isActive = cat === "Tất cả" ? !activeCategory : activeCategory === cat;
            const href = cat === "Tất cả" ? "/news" : `/news?category=${encodeURIComponent(cat)}`;
            return (
              <Link
                key={cat}
                href={href}
                className={`news-filter-btn${isActive ? " is-active" : ""}`}
              >
                {cat}
              </Link>
            );
          })}
        </div>

        <div className="news-grid">
          {articles.length === 0 ? (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
              Chưa có bài viết nào.
            </p>
          ) : (
            articles.map((news) => (
              <article key={news.id} className="news-card">
                <div className="news-card-image">
                  {news.imageUrl ? (
                    <img src={news.imageUrl} alt={news.title} loading="lazy" />
                  ) : (
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--surface)", color: "var(--text-muted)",
                      fontSize: "3rem"
                    }}>
                      📰
                    </div>
                  )}
                  <span className="news-card-category">{news.category}</span>
                  {news.featured && <span className="news-card-featured">Nổi bật</span>}
                </div>
                <div className="news-card-content">
                  <time dateTime={news.createdAt} className="news-card-date">
                    {formatDate(news.createdAt)}
                  </time>
                  <h2 className="news-card-title">
                    <Link href={`/news/${news.slug}`}>{news.title}</Link>
                  </h2>
                  <p className="news-card-excerpt">{news.excerpt}</p>
                  {news.tags && <div className="news-card-tags">{news.tags.split(",").filter(Boolean).map((tag) => <span key={tag} className="news-tag">{tag.trim()}</span>)}</div>}
                  <Link href={`/news/${news.slug}`} className="news-card-readmore">
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
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="news-pagination">
            {pageNum > 0 && (
              <Link
                href={activeCategory ? `/news?category=${encodeURIComponent(activeCategory)}&page=${pageNum - 1}` : `/news?page=${pageNum - 1}`}
                className="news-page-btn"
              >
                ← Trang trước
              </Link>
            )}
            <span className="news-page-info">Trang {pageNum + 1} / {totalPages}</span>
            {pageNum < totalPages - 1 && (
              <Link
                href={activeCategory ? `/news?category=${encodeURIComponent(activeCategory)}&page=${pageNum + 1}` : `/news?page=${pageNum + 1}`}
                className="news-page-btn"
              >
                Trang sau →
              </Link>
            )}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
