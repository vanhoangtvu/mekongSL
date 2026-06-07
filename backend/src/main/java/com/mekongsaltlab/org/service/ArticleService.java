package com.mekongsaltlab.org.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mekongsaltlab.org.dto.ArticleRequest;
import com.mekongsaltlab.org.dto.ArticleResponse;
import com.mekongsaltlab.org.entity.Article;
import com.mekongsaltlab.org.entity.User;
import com.mekongsaltlab.org.repository.ArticleRepository;
import com.mekongsaltlab.org.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArticleService {

    private final ArticleRepository articleRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final S3Service s3Service;

    @Value("${s3.bucket}")
    private String bucketName;

    @Transactional(readOnly = true)
    public List<ArticleResponse> listArticles() {
        return articleRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<ArticleResponse> listArticles(Pageable pageable) {
        return articleRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<ArticleResponse> listPublicArticles(String category) {
        List<Article> articles;
        if (category != null && !category.isBlank()) {
            articles = articleRepository.findByPublishedTrueAndCategoryOrderByCreatedAtDesc(category);
        } else {
            articles = articleRepository.findByPublishedTrueOrderByCreatedAtDesc();
        }
        return articles.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<ArticleResponse> listPublicArticles(String category, Pageable pageable) {
        Page<Article> articles;
        if (category != null && !category.isBlank()) {
            articles = articleRepository.findByPublishedTrueAndCategoryOrderByCreatedAtDesc(category, pageable);
        } else {
            articles = articleRepository.findByPublishedTrueOrderByCreatedAtDesc(pageable);
        }
        return articles.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ArticleResponse getArticle(Long id) {
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Article not found"));
        return toResponse(article);
    }

    @Transactional(readOnly = true)
    public ArticleResponse getPublicArticleBySlug(String slug) {
        Article article = articleRepository.findBySlugAndPublishedTrue(slug)
                .orElseThrow(() -> new RuntimeException("Article not found"));
        return toResponse(article);
    }

    @Transactional
    public ArticleResponse createArticle(ArticleRequest request) {
        User author = resolveAuthenticatedUser();

        String baseSlug = generateSlug(request);
        String slug = baseSlug;
        int counter = 1;
        while (articleRepository.existsBySlug(slug)) {
            slug = baseSlug + "-" + counter++;
        }

        Article article = new Article();
        applyRequest(article, request);
        article.setSlug(slug);
        article.setAuthor(author);
        article.setCreatedAt(LocalDateTime.now());
        articleRepository.save(article);

        return toResponse(article);
    }

    @Transactional
    public ArticleResponse updateArticle(Long id, ArticleRequest request) {
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Article not found"));

        String baseSlug = request.getSlug() != null && !request.getSlug().isBlank()
                ? request.getSlug().trim()
                : toSlug(request.getTitle());
        
        String slug = baseSlug;
        int counter = 1;
        
        // If the slug changed, check for duplicates (excluding current article)
        if (!slug.equals(article.getSlug())) {
            while (articleRepository.existsBySlug(slug)) {
                slug = baseSlug + "-" + counter++;
            }
        }

        applyRequest(article, request);
        article.setSlug(slug);
        articleRepository.save(article);

        return toResponse(article);
    }

    @Transactional
    public void deleteArticle(Long id) {
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Article not found"));
        
        // 1. Collect all S3 keys to delete
        List<String> keysToDelete = new java.util.ArrayList<>();
        
        // Featured Image
        if (article.getImageUrl() != null) {
            String key = extractS3Key(article.getImageUrl());
            if (key != null) keysToDelete.add(key);
        }
        
        // Gallery Images
        if (article.getImages() != null) {
            try {
                List<String> gallery = objectMapper.readValue(article.getImages(), new TypeReference<List<String>>() {});
                for (String url : gallery) {
                    String key = extractS3Key(url);
                    if (key != null) keysToDelete.add(key);
                }
            } catch (JsonProcessingException e) {
                log.error("Failed to parse gallery images for deletion: {}", e.getMessage());
            }
        }
        
        // Content Images (Parsing from HTML blocks)
        if (article.getContent() != null) {
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("<img[^>]+src=\"([^\"]+)\"");
            java.util.regex.Matcher matcher = pattern.matcher(article.getContent());
            while (matcher.find()) {
                String key = extractS3Key(matcher.group(1));
                if (key != null) keysToDelete.add(key);
            }
        }
        
        // 2. Delete files from S3
        for (String key : keysToDelete) {
            try {
                // Check if file belongs to this article context (optional safety)
                if (key.startsWith("news-images/") || key.startsWith("uploads/")) {
                    s3Service.deleteFile(key);
                    log.info("Deleted orphaned S3 file on article deletion: {}", key);
                }
            } catch (Exception e) {
                log.error("Failed to delete S3 file during article cleanup: {}", key, e);
            }
        }

        // 3. Delete from MySQL
        articleRepository.delete(article);
    }

    private String extractS3Key(String url) {
        if (url == null || url.isBlank()) return null;
        // Expected format: https://backup.hci.vn/{bucket}/{key}
        String prefix = "https://backup.hci.vn/" + bucketName + "/";
        if (url.startsWith(prefix)) {
            return url.substring(prefix.length());
        }
        // Fallback for various S3 URL formats
        if (url.contains("/" + bucketName + "/")) {
            return url.substring(url.indexOf("/" + bucketName + "/") + bucketName.length() + 2);
        }
        return null;
    }

    private void applyRequest(Article article, ArticleRequest request) {
        article.setTitle(request.getTitle().trim());
        article.setExcerpt(request.getExcerpt());
        article.setContent(request.getContent());
        article.setCategory(request.getCategory());
        article.setImageUrl(request.getImageUrl());
        article.setTags(request.getTags());
        article.setPublished(request.getPublished() != null && request.getPublished());
        article.setFeatured(request.getFeatured() != null && request.getFeatured());
        if (request.getImages() != null) {
            try { article.setImages(objectMapper.writeValueAsString(request.getImages())); }
            catch (JsonProcessingException e) { throw new RuntimeException("Failed to serialize images", e); }
        } else {
            article.setImages(null);
        }
    }

    private String generateSlug(ArticleRequest request) {
        if (request.getSlug() != null && !request.getSlug().isBlank()) {
            return request.getSlug().trim();
        }
        return toSlug(request.getTitle());
    }

    public static String toSlug(String input) {
        if (input == null || input.isBlank()) return "";
        String normalized = Normalizer.normalize(input.trim(), Normalizer.Form.NFD);
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        String slug = pattern.matcher(normalized)
                .replaceAll("")
                .replaceAll("đ", "d")
                .replaceAll("Đ", "D")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
        return slug;
    }

    private User resolveAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("Unauthorized");
        }
        return userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException("User not found"));
    }

    private ArticleResponse toResponse(Article article) {
        List<String> imagesList;
        try {
            imagesList = article.getImages() != null
                    ? objectMapper.readValue(article.getImages(), new TypeReference<List<String>>() {})
                    : null;
        } catch (JsonProcessingException e) {
            imagesList = null;
        }

        return new ArticleResponse(
                article.getId(),
                article.getTitle(),
                article.getSlug(),
                article.getExcerpt(),
                article.getContent(),
                article.getCategory(),
                article.getImageUrl(),
                imagesList,
                article.getTags(),
                Boolean.TRUE.equals(article.getPublished()),
                Boolean.TRUE.equals(article.getFeatured()),
                article.getAuthor().getUsername(),
                article.getAuthor().getId(),
                article.getCreatedAt(),
                article.getUpdatedAt()
        );
    }
}
