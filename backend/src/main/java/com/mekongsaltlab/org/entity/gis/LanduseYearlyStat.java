package com.mekongsaltlab.org.entity.gis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "landuse_yearly_stats")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LanduseYearlyStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "landuse_key", nullable = false)
    private String landuseKey;

    @Column(nullable = false)
    private Integer year;

    @Column(name = "area_ha", nullable = false)
    private double areaHa;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
