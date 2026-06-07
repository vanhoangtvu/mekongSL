package com.mekongsaltlab.org.repository;

import com.mekongsaltlab.org.entity.Article;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArticleRepository extends JpaRepository<Article, Long> {

    List<Article> findAllByOrderByCreatedAtDesc();

    Page<Article> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<Article> findByPublishedTrueOrderByCreatedAtDesc();

    Page<Article> findByPublishedTrueOrderByCreatedAtDesc(Pageable pageable);

    List<Article> findByPublishedTrueAndCategoryOrderByCreatedAtDesc(String category);

    Page<Article> findByPublishedTrueAndCategoryOrderByCreatedAtDesc(String category, Pageable pageable);

    Optional<Article> findBySlug(String slug);

    Optional<Article> findBySlugAndPublishedTrue(String slug);

    boolean existsBySlug(String slug);

    long countByPublishedTrue();
}
