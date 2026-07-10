package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.LanduseYearlyStat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LanduseYearlyStatRepository extends JpaRepository<LanduseYearlyStat, Long> {
    List<LanduseYearlyStat> findByLanduseKeyOrderByYearAsc(String landuseKey);
    Optional<LanduseYearlyStat> findByLanduseKeyAndYear(String landuseKey, Integer year);
    boolean existsByLanduseKeyAndYear(String landuseKey, Integer year);
}
