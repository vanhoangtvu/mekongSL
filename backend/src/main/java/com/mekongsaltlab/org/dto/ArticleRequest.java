package com.mekongsaltlab.org.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ArticleRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 255, message = "Title must be less than 255 characters")
    private String title;

    @Size(max = 255, message = "Slug must be less than 255 characters")
    private String slug;

    private String excerpt;

    private String content;

    @NotBlank(message = "Category is required")
    private String category;

    private String imageUrl;

    private List<String> images;

    private String tags;

    private Boolean published;

    private Boolean featured;
}
