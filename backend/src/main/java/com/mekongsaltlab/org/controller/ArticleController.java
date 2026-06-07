package com.mekongsaltlab.org.controller;

import com.mekongsaltlab.org.dto.ArticleRequest;
import com.mekongsaltlab.org.dto.ArticleResponse;
import com.mekongsaltlab.org.service.ArticleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping
public class ArticleController {

    private final ArticleService articleService;

    @GetMapping("/api/articles/public")
    public ResponseEntity<?> listPublicArticles(
            @RequestParam(required = false) String category,
            @PageableDefault(size = 9) Pageable pageable) {
        Page<ArticleResponse> page = articleService.listPublicArticles(category, pageable);
        return ResponseEntity.ok(page);
    }

    @GetMapping("/api/articles/public/{slug}")
    public ResponseEntity<ArticleResponse> getPublicArticle(@PathVariable String slug) {
        return ResponseEntity.ok(articleService.getPublicArticleBySlug(slug));
    }

    @GetMapping("/api/articles")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<?> listArticles(@PageableDefault(size = 20) Pageable pageable) {
        Page<ArticleResponse> page = articleService.listArticles(pageable);
        return ResponseEntity.ok(page);
    }

    @GetMapping("/api/articles/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<ArticleResponse> getArticle(@PathVariable Long id) {
        return ResponseEntity.ok(articleService.getArticle(id));
    }

    @PostMapping("/api/articles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ArticleResponse> createArticle(@Valid @RequestBody ArticleRequest request) {
        return ResponseEntity.ok(articleService.createArticle(request));
    }

    @PutMapping("/api/articles/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ArticleResponse> updateArticle(
            @PathVariable Long id,
            @Valid @RequestBody ArticleRequest request) {
        return ResponseEntity.ok(articleService.updateArticle(id, request));
    }

    @DeleteMapping("/api/articles/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> deleteArticle(@PathVariable Long id) {
        articleService.deleteArticle(id);
        return ResponseEntity.ok(Map.of("message", "Article deleted successfully"));
    }
}
