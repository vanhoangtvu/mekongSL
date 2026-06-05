package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.WaterQualityParameter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WaterQualityParameterRepository extends JpaRepository<WaterQualityParameter, Long> {

    /** Lấy tất cả thông số của 1 sample, theo thứ tự sortOrder */
    List<WaterQualityParameter> findBySampleIdOrderBySortOrder(Long sampleId);

    /** Xóa tất cả thông số của 1 sample */
    @Modifying
    @Query("DELETE FROM WaterQualityParameter p WHERE p.sample.id = :sampleId")
    void deleteBySampleId(@Param("sampleId") Long sampleId);
}
