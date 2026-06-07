package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.S3Object;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Map;

public interface S3ObjectRepository extends JpaRepository<S3Object, Long> {
    Optional<S3Object> findByBucketAndS3Key(String bucket, String s3Key);
    Optional<S3Object> findByChecksumSha256(String checksumSha256);

    @Query("SELECT SUM(o.sizeBytes) FROM S3Object o WHERE o.isDeleted = false")
    Long getTotalSizeBytes();

    @Query("SELECT o.s3Key as key, o.sizeBytes as size FROM S3Object o WHERE o.isDeleted = false")
    List<Map<String, Object>> getAllObjectMetadata();
}
