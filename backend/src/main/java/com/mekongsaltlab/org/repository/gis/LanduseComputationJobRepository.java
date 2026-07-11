package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.LanduseComputationJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LanduseComputationJobRepository extends JpaRepository<LanduseComputationJob, Long> {

    Optional<LanduseComputationJob> findTopByOrderByCreatedAtDesc();

    List<LanduseComputationJob> findAllByOrderByCreatedAtDesc();
}
