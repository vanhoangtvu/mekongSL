package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.LayerObjectResponse;
import com.mekongsaltlab.org.dto.gis.S3ObjectCreateRequest;
import com.mekongsaltlab.org.dto.gis.S3ObjectResponse;
import com.mekongsaltlab.org.dto.gis.SignedUrlResponse;
import com.mekongsaltlab.org.service.gis.LayerObjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@RestController
@RequestMapping("/api/gis")
@RequiredArgsConstructor
public class LayerObjectController {

    private final LayerObjectService layerObjectService;

    @PostMapping("/layers/{layerId}/upload-file")
    public ResponseEntity<?> uploadFile(
        @PathVariable Long layerId,
        @RequestParam(required = false) Long folderId,
        @RequestParam(required = false) String category,
        @RequestParam("file") MultipartFile file
    ) {
        try {
            LayerObjectResponse response = layerObjectService.uploadFile(layerId, folderId, category, file);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Failed to upload file");
        }
    }

    @PostMapping("/layers/{layerId}/objects")
    public ResponseEntity<LayerObjectResponse> registerObject(
        @PathVariable Long layerId,
        @RequestBody S3ObjectCreateRequest request
    ) {
        LayerObjectResponse response = layerObjectService.registerObject(layerId, request);
        if (response == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/layers/{layerId}/objects")
    public ResponseEntity<List<LayerObjectResponse>> listLayerObjects(@PathVariable Long layerId) {
        return ResponseEntity.ok(layerObjectService.listLayerObjects(layerId));
    }

    @GetMapping("/objects/{objectId}")
    public ResponseEntity<S3ObjectResponse> getObject(@PathVariable Long objectId) {
        S3ObjectResponse response = layerObjectService.getObject(objectId);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/objects/{objectId}/signed-url")
    public ResponseEntity<SignedUrlResponse> signedUrl(
        @PathVariable Long objectId,
        @RequestParam(defaultValue = "300") long expires
    ) {
        SignedUrlResponse response = layerObjectService.createSignedUrl(objectId, expires);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/objects/{objectId}")
    public ResponseEntity<Void> deleteObject(@PathVariable Long objectId) {
        if (!layerObjectService.softDeleteObject(objectId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
