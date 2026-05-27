package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.Dataset;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface DatasetRepository extends JpaRepository<Dataset, Long> {
    List<Dataset> findByOwnerIdAndIsDeletedFalse(Long ownerId);
    Page<Dataset> findByIsDeletedFalse(Pageable pageable);
}
