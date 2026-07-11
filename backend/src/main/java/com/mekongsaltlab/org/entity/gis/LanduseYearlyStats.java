package com.mekongsaltlab.org.entity.gis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "landuse_yearly_stats", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"landuse_key", "year"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LanduseYearlyStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "landuse_key", nullable = false, length = 255)
    private String landuseKey;

    @Column(nullable = false)
    private Integer year;

    @Column(name = "area_ha", nullable = false)
    private Double areaHa;

    @Column(name = "class_pixels", nullable = false)
    private Long classPixels;

    @Column(name = "total_pixels", nullable = false)
    private Long totalPixels;

    @Column(nullable = false)
    private Double percentage;

    @Column(name = "image_width", nullable = false)
    private Integer imageWidth;

    @Column(name = "image_height", nullable = false)
    private Integer imageHeight;

    @Column(name = "pixel_area_m2", nullable = false)
    private Double pixelAreaM2;

    @Column(name = "s3_key", nullable = false, length = 512)
    private String s3Key;

    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
