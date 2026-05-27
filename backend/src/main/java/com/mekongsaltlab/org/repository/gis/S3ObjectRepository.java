package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.S3Object;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface S3ObjectRepository extends JpaRepository<S3Object, Long> {
    Optional<S3Object> findByBucketAndS3Key(String bucket, String s3Key);
    Optional<S3Object> findByChecksumSha256(String checksumSha256);
}
