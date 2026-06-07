import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "../../../../components/layout/app-header";
import { AppFooter } from "../../../../components/layout/app-footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://14.227.143.142:8084/api";

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl: string;
  images: string[];
  tags: string;
  published: boolean;
  featured: boolean;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
}

async function getArticle(slug: string): Promise<NewsArticle | null> {
  try {
    const res = await fetch(`${API_URL}/articles/public/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Bài viết không tìm thấy" };
  return {
    title: `${article.title} - WebGIS`,
    description: article.excerpt || article.title,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="app-container public-home">
      <AppHeader />
      <main className="page-shell news-detail-page">
        <div className="news-detail-breadcrumb">
          <Link href="/news">Tin tức</Link>
          <span className="news-detail-breadcrumb-sep">→</span>
          <span>{article.category}</span>
          <span className="news-detail-breadcrumb-sep">→</span>
          <span className="news-detail-breadcrumb-current">{article.title}</span>
        </div>

        <article className="news-detail-article">
          <header className="news-detail-header">
            <span className="news-card-category">{article.category}</span>
            <time className="news-detail-date">{formatDate(article.createdAt)}</time>
            <h1 className="news-detail-title">{article.title}</h1>
            <p className="news-detail-author">Tác giả: {article.authorName}</p>
          </header>

          {article.featured && <span className="news-detail-featured">Nổi bật</span>}

          {article.imageUrl && (
            <div className="news-detail-image">
              <img src={article.imageUrl} alt={article.title} />
            </div>
          )}

          {article.images && article.images.length > 0 && (
            <div className="news-detail-gallery">
              <h3 className="news-detail-gallery-title">Thư viện ảnh</h3>
              <div className="news-detail-gallery-grid">
                {article.images.map((img, i) => (
                  <div key={i} className="news-detail-gallery-item">
                    <img src={img} alt={`${article.title} - Ảnh ${i + 1}`} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {article.excerpt && (
            <p className="news-detail-excerpt">{article.excerpt}</p>
          )}

          <div
            className="news-detail-content"
            dangerouslySetInnerHTML={{ __html: article.content || "" }}
          />

          {article.tags && (
            <div className="news-detail-tags">
              {article.tags.split(",").filter(Boolean).map((tag) => (
                <span key={tag} className="news-tag">{tag.trim()}</span>
              ))}
            </div>
          )}

          <div className="news-detail-footer">
            <Link href="/news" className="news-detail-back">
              ← Quay lại tin tức
            </Link>
          </div>
        </article>
      </main>
      <AppFooter />
    </div>
  );
}
