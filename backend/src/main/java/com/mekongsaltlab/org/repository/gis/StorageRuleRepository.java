package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.StorageRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StorageRuleRepository extends JpaRepository<StorageRule, Long> {
    List<StorageRule> findByIsActiveTrueOrderByCreatedAtAsc();
}
