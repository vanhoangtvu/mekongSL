package com.mekongsaltlab.org.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class ArticleResponse {
    private Long id;
    private String title;
    private String slug;
    private String excerpt;
    private String content;
    private String category;
    private String imageUrl;
    private List<String> images;
    private String tags;
    private boolean published;
    private boolean featured;
    private String authorName;
    private Long authorId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
