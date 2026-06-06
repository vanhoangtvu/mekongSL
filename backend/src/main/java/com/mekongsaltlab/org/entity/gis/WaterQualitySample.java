package com.mekongsaltlab.org.entity.gis;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Represents one water quality sampling session at a specific manual station on a specific date.
 * Each sample can have multiple parameters (pH, EC, Salinity, etc.)
 */
@Entity
@Table(
    name = "water_quality_sample",
    indexes = {
        @Index(name = "idx_wq_sample_station_date", columnList = "station_db_id, sample_date")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WaterQualitySample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK → manual_station.id */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "station_db_id", nullable = false)
    private ManualStation station;

    /** Ngày lấy mẫu - nhập thủ công trước khi import */
    @Column(name = "sample_date", nullable = false)
    private LocalDate sampleDate;

    /** Bản sao loại trạm tại thời điểm lấy mẫu (groundwater / surface_water) */
    @Column(name = "station_type", nullable = false, length = 50)
    private String stationType;

    /** Mô tả vùng từ tiêu đề Excel (e.g., "CLEAN BRACKISH WATER") */
    @Column(name = "zone_description", length = 500)
    private String zoneDescription;

    /** Tiêu chuẩn áp dụng (e.g., "QCVN09:2023/BTNMT") */
    @Column(name = "qcvn_standard", length = 100)
    private String qcvnStandard;

    /** Chuỗi tiêu đề gốc từ dòng đầu file Excel, dùng để tra cứu / debug */
    @Column(name = "raw_header", columnDefinition = "TEXT")
    private String rawHeader;

    /** Ghi chú tùy chọn của người import */
    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "imported_at", nullable = false)
    private Instant importedAt = Instant.now();

    /** Tài khoản thực hiện import */
    @Column(name = "imported_by", length = 200)
    private String importedBy;

    /** Danh sách thông số đo của lần lấy mẫu này */
    @OneToMany(mappedBy = "sample", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<WaterQualityParameter> parameters;
}
