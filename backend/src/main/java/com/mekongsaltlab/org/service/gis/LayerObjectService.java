package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.LayerObjectResponse;
import com.mekongsaltlab.org.dto.gis.S3ObjectCreateRequest;
import com.mekongsaltlab.org.dto.gis.S3ObjectResponse;
import com.mekongsaltlab.org.dto.gis.SignedUrlResponse;
import com.mekongsaltlab.org.entity.gis.Layer;
import com.mekongsaltlab.org.entity.gis.LayerObject;
import com.mekongsaltlab.org.entity.gis.S3Object;
import com.mekongsaltlab.org.entity.gis.enums.ObjectRole;
import com.mekongsaltlab.org.repository.gis.LayerObjectRepository;
import com.mekongsaltlab.org.repository.gis.LayerRepository;
import com.mekongsaltlab.org.repository.gis.S3ObjectRepository;
import com.mekongsaltlab.org.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

import com.mekongsaltlab.org.repository.gis.LayerFolderRepository;
import com.mekongsaltlab.org.entity.gis.LayerFolder;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;


@Service
@RequiredArgsConstructor
public class LayerObjectService {

    private final S3ObjectRepository s3ObjectRepository;
    private final LayerObjectRepository layerObjectRepository;
    private final LayerRepository layerRepository;
    private final LayerFolderRepository folderRepository;
    private final S3Service s3Service;
    private final StoragePathService storagePathService;

    @Value("${s3.bucket}")
    private String bucketName;

    public LayerObjectResponse uploadFile(Long layerId, Long folderId, String category, MultipartFile file) throws IOException {
        return uploadFile(layerId, folderId, category, file, false);
    }

    public LayerObjectResponse uploadFile(Long layerId, Long folderId, String category, MultipartFile file, boolean overwrite) throws IOException {
        Layer layer = layerRepository.findById(layerId).orElse(null);
        if (layer == null || Boolean.TRUE.equals(layer.getIsDeleted())) {
            throw new IllegalArgumentException("Layer not found");
        }

        LayerFolder folder = null;
        String logicalPath = "root";
        if (folderId != null) {
            folder = folderRepository.findByIdAndIsDeletedFalse(folderId)
                .orElseThrow(() -> new IllegalArgumentException("Folder not found"));
            logicalPath = folder.getLogicalPath();
            if (logicalPath.startsWith("/")) {
                logicalPath = logicalPath.substring(1);
            }
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        String safeFilename = sanitizeFilename(originalFilename);

        String s3Key = storagePathService.buildGisPath(layer, safeFilename);

        s3Service.uploadFile(s3Key, file, overwrite);

        S3Object s3Object = s3ObjectRepository
            .findByBucketAndS3Key(bucketName, s3Key)
            .orElseGet(S3Object::new);

        s3Object.setBucket(bucketName);
        s3Object.setS3Key(s3Key);
        s3Object.setSizeBytes(file.getSize());
        s3Object.setContentType(file.getContentType());
        if (s3Object.getCreatedAt() == null) {
            s3Object.setCreatedAt(Instant.now());
        }
        s3Object.setUploadedAt(Instant.now());
        s3Object.setIsDeleted(false);
        S3Object savedObject = s3ObjectRepository.save(s3Object);

        ObjectRole role = ObjectRole.DATA;
        LayerObject existing = layerObjectRepository
            .findFirstByLayerIdAndS3ObjectIdAndRole(layerId, savedObject.getId(), role)
            .orElse(null);

        LayerObject mapping = existing != null ? existing : new LayerObject();
        mapping.setLayer(layer);
        mapping.setFolder(folder);
        mapping.setS3Object(savedObject);
        mapping.setRole(role);
        if (mapping.getId() == null) {
            mapping.setCreatedAt(Instant.now());
        }

        return toLayerObjectResponse(layerObjectRepository.save(mapping));
    }

    private String sanitizeFilename(String filename) {
        return filename.replaceAll("[^a-zA-Z0-9_\\-\\.]", "_");
    }

    public LayerObjectResponse registerObject(Long layerId, S3ObjectCreateRequest request) {
        Layer layer = layerRepository.findById(layerId).orElse(null);
        if (layer == null || Boolean.TRUE.equals(layer.getIsDeleted())) {
            return null;
        }

        S3Object s3Object = s3ObjectRepository
            .findByBucketAndS3Key(bucketName, request.getS3Key())
            .orElseGet(S3Object::new);

        s3Object.setBucket(bucketName);
        s3Object.setS3Key(request.getS3Key());
        s3Object.setSizeBytes(request.getSizeBytes() == null ? 0L : request.getSizeBytes());
        s3Object.setContentType(request.getContentType());
        s3Object.setEtag(request.getEtag());
        s3Object.setChecksumSha256(request.getChecksumSha256());
        s3Object.setStorageClass(request.getStorageClass());
        s3Object.setVersionId(request.getVersionId());
        if (s3Object.getCreatedAt() == null) {
            s3Object.setCreatedAt(Instant.now());
        }
        s3Object.setUploadedAt(Instant.now());
        s3Object.setIsDeleted(false);

        S3Object savedObject = s3ObjectRepository.save(s3Object);

        ObjectRole role = parseRole(request.getRole());
        LayerObject existing = layerObjectRepository
            .findFirstByLayerIdAndS3ObjectIdAndRole(layerId, savedObject.getId(), role)
            .orElse(null);
        if (existing != null) {
            return toLayerObjectResponse(existing);
        }

        LayerObject mapping = new LayerObject();
        mapping.setLayer(layer);
        mapping.setS3Object(savedObject);
        mapping.setRole(role);
        mapping.setCreatedAt(Instant.now());

        LayerObject savedMapping = layerObjectRepository.save(mapping);
        return toLayerObjectResponse(savedMapping);
    }

    public List<LayerObjectResponse> listLayerObjects(Long layerId) {
        return layerObjectRepository.findByLayerId(layerId)
            .stream()
            .filter(mapping -> mapping.getS3Object() != null && Boolean.FALSE.equals(mapping.getS3Object().getIsDeleted()))
            .map(this::toLayerObjectResponse)
            .collect(Collectors.toList());
    }

    public S3ObjectResponse getObject(Long objectId) {
        return s3ObjectRepository.findById(objectId)
            .filter(obj -> Boolean.FALSE.equals(obj.getIsDeleted()))
            .map(this::toObjectResponse)
            .orElse(null);
    }

    public SignedUrlResponse createSignedUrl(Long objectId, long expiresSeconds) {
        S3Object s3Object = s3ObjectRepository.findById(objectId)
            .filter(obj -> Boolean.FALSE.equals(obj.getIsDeleted()))
            .orElse(null);
        if (s3Object == null) {
            return null;
        }

        Duration expiresIn = Duration.ofSeconds(Math.max(60, expiresSeconds));
        String url = s3Service.createSignedGetUrl(s3Object.getS3Key(), expiresIn);

        SignedUrlResponse response = new SignedUrlResponse();
        response.setUrl(url);
        response.setExpiresAt(Instant.now().plus(expiresIn));
        return response;
    }

    public boolean softDeleteObject(Long objectId) {
        S3Object s3Object = s3ObjectRepository.findById(objectId).orElse(null);
        if (s3Object == null) {
            return false;
        }
        s3Object.setIsDeleted(true);
        s3Object.setDeletedAt(Instant.now());
        s3ObjectRepository.save(s3Object);
        return true;
    }

    private LayerObjectResponse toLayerObjectResponse(LayerObject mapping) {
        LayerObjectResponse response = new LayerObjectResponse();
        response.setId(mapping.getId());
        response.setLayerId(mapping.getLayer().getId());
        response.setObjectId(mapping.getS3Object().getId());
        response.setRole(mapping.getRole() == null ? null : mapping.getRole().name());
        response.setS3Key(mapping.getS3Object().getS3Key());
        response.setSizeBytes(mapping.getS3Object().getSizeBytes());
        response.setContentType(mapping.getS3Object().getContentType());
        response.setCreatedAt(mapping.getCreatedAt());
        return response;
    }

    private ObjectRole parseRole(String value) {
        if (value == null || value.trim().isEmpty()) {
            return ObjectRole.DATA;
        }
        try {
            return ObjectRole.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return ObjectRole.DATA;
        }
    }

    private S3ObjectResponse toObjectResponse(S3Object s3Object) {
        S3ObjectResponse response = new S3ObjectResponse();
        response.setId(s3Object.getId());
        response.setBucket(s3Object.getBucket());
        response.setS3Key(s3Object.getS3Key());
        response.setSizeBytes(s3Object.getSizeBytes());
        response.setContentType(s3Object.getContentType());
        response.setEtag(s3Object.getEtag());
        response.setChecksumSha256(s3Object.getChecksumSha256());
        response.setStorageClass(s3Object.getStorageClass());
        response.setVersionId(s3Object.getVersionId());
        response.setCreatedAt(s3Object.getCreatedAt());
        response.setUploadedAt(s3Object.getUploadedAt());
        return response;
    }
}
