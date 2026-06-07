-- V003: Create articles table for News management
-- Enables admin to CRUD news articles displayed on public /news page

CREATE TABLE IF NOT EXISTS articles (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT DEFAULT NULL,
  content TEXT DEFAULT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Tin tức',
  image_url VARCHAR(500) DEFAULT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  author_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  KEY idx_articles_published (published),
  KEY idx_articles_category (category),
  KEY idx_articles_slug (slug),
  KEY idx_articles_created_at (created_at),
  CONSTRAINT fk_articles_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
