package com.mekongsaltlab.org.entity.gis;

import com.mekongsaltlab.org.entity.gis.enums.DynamicSourceType;
import com.mekongsaltlab.org.entity.gis.enums.SegmentSource;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "storage_rule_segment")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StorageRuleSegment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id", nullable = false)
    private StorageRule rule;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false)
    private SegmentSource source;

    @Column(name = "static_value")
    private String staticValue;

    @Column(name = "option_values", columnDefinition = "TEXT")
    private String optionValues;

    @Enumerated(EnumType.STRING)
    @Column(name = "dynamic_source")
    private DynamicSourceType dynamicSource;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "placeholder")
    private String placeholder;
}
