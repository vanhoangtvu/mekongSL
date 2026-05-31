package com.mekongsaltlab.org.entity.gis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "monitoring_data_file")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MonitoringDataFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "monitoring_station_id", nullable = false)
    private MonitoringStation monitoringStation;

    @Column(nullable = false)
    private String parameter;

    @Column(name = "data_year", nullable = false)
    private Integer dataYear;

    @Column(name = "data_month", nullable = false)
    private Integer dataMonth;

    @Column(name = "data_day", nullable = false)
    private Integer dataDay;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "s3_object_id", nullable = false)
    private S3Object s3Object;

    @Column(name = "file_format", nullable = false)
    private String fileFormat = "CSV";

    @Column(name = "record_count")
    private Integer recordCount;

    @Column(name = "data_start_at")
    private Instant dataStartAt;

    @Column(name = "data_end_at")
    private Instant dataEndAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
