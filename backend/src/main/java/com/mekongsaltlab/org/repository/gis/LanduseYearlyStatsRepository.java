package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.LanduseYearlyStats;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LanduseYearlyStatsRepository extends JpaRepository<LanduseYearlyStats, Long> {

    List<LanduseYearlyStats> findByLanduseKeyOrderByYearAsc(String landuseKey);

    Optional<LanduseYearlyStats> findByLanduseKeyAndYear(String landuseKey, Integer year);

    void deleteByLanduseKey(String landuseKey);

    boolean existsByLanduseKeyAndYear(String landuseKey, Integer year);
}
