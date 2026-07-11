package com.mekongsaltlab.org.entity.gis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "landuse_computation_job")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LanduseComputationJob {

    public enum Status {
        PENDING,
        RUNNING,
        COMPLETED,
        FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "triggered_by", length = 100)
    private String triggeredBy;

    @Column(name = "total_keys")
    private Integer totalKeys = 0;

    @Column(name = "completed_keys")
    private Integer completedKeys = 0;

    @Column(name = "total_years")
    private Integer totalYears = 0;

    @Column(name = "completed_years")
    private Integer completedYears = 0;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "progress_detail", columnDefinition = "JSON")
    private String progressDetail;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
