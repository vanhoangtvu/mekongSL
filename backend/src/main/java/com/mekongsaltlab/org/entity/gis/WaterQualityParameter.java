package com.mekongsaltlab.org.entity.gis;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents one measurement parameter (e.g., pH, EC, Coliform) within a water quality sample.
 */
@Entity
@Table(name = "water_quality_parameter")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WaterQualityParameter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK → water_quality_sample.id */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sample_id", nullable = false)
    private WaterQualitySample sample;

    /** Tên thông số (e.g., "pH", "Coliform", "Clorua(Cl-)") */
    @Column(name = "parameter_name", nullable = false, length = 200)
    private String parameterName;

    /** Đơn vị đo (e.g., "mg/L", "µS/cm", "MPN/100mL") */
    @Column(length = 100)
    private String unit;

    /**
     * Giá trị thô từ file Excel — giữ nguyên kể cả dạng text
     * (e.g., "không phát hiện (LOD=0,005)", "Not detected(LOD=1)", "7.5")
     */
    @Column(name = "value_raw", length = 500)
    private String valueRaw;

    /**
     * Giá trị số (NULL nếu không parse được từ valueRaw).
     * Dùng cho tính toán và so sánh với tiêu chuẩn.
     */
    @Column(name = "value_numeric")
    private Double valueNumeric;

    /**
     * Giới hạn tiêu chuẩn từ file Excel
     * (e.g., "≤ 250", "≥6.0", "5,5-8,5")
     */
    @Column(name = "reference_standard", length = 200)
    private String referenceStandard;

    /**
     * TRUE nếu giá trị vượt tiêu chuẩn. NULL nếu không thể đánh giá
     * (giá trị text như "không phát hiện", hoặc tiêu chuẩn rỗng).
     */
    @Column(name = "is_exceeded")
    private Boolean isExceeded;

    /** Thứ tự hiển thị trong bảng (giữ đúng thứ tự từ file Excel) */
    @Column(name = "sort_order")
    private Integer sortOrder;
}
