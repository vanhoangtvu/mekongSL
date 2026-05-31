package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.StorageRuleSegment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StorageRuleSegmentRepository extends JpaRepository<StorageRuleSegment, Long> {
    List<StorageRuleSegment> findByRuleIdOrderBySortOrderAsc(Long ruleId);
}
