package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.LayerCreateRequest;
import com.mekongsaltlab.org.dto.gis.LayerRenderResponse;
import com.mekongsaltlab.org.dto.gis.LayerResponse;
import com.mekongsaltlab.org.dto.gis.LayerUpdateRequest;
import com.mekongsaltlab.org.dto.gis.SignedUrlResponse;
import com.mekongsaltlab.org.entity.gis.LayerObject;
import com.mekongsaltlab.org.entity.gis.enums.ObjectRole;
import com.mekongsaltlab.org.repository.gis.LayerObjectRepository;
import com.mekongsaltlab.org.service.gis.LayerObjectService;
import com.mekongsaltlab.org.service.gis.LayerService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/gis/layers")
@RequiredArgsConstructor
public class LayerController {

    private final LayerService layerService;
    private final LayerObjectService layerObjectService;
    private final LayerObjectRepository layerObjectRepository;

    @GetMapping
    public ResponseEntity<Page<LayerResponse>> list(
        @RequestParam(required = false) Long datasetId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String layerType,
        @RequestParam(required = false) String dataClass,
        @RequestParam(required = false) String source,
        @RequestParam(required = false) String province,
        @RequestParam(required = false) String station,
        @RequestParam(required = false) String tag,
        @RequestParam(required = false) Instant startTime,
        @RequestParam(required = false) Instant endTime,
        @RequestParam(required = false) Double minLon,
        @RequestParam(required = false) Double minLat,
        @RequestParam(required = false) Double maxLon,
        @RequestParam(required = false) Double maxLat,
        Pageable pageable
    ) {
        return ResponseEntity.ok(layerService.list(
            datasetId,
            status,
            layerType,
            dataClass,
            source,
            province,
            station,
            tag,
            startTime,
            endTime,
            minLon,
            minLat,
            maxLon,
            maxLat,
            pageable
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LayerResponse> get(@PathVariable Long id) {
        LayerResponse response = layerService.getById(id);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<LayerResponse> create(@RequestBody LayerCreateRequest request) {
        LayerResponse response = layerService.create(request);
        if (response == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<LayerResponse> update(@PathVariable Long id, @RequestBody LayerUpdateRequest request) {
        LayerResponse response = layerService.update(id, request);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!layerService.softDelete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/render")
    public ResponseEntity<LayerRenderResponse> render(
        @PathVariable Long id,
        @RequestParam(defaultValue = "300") long expires
    ) {
        LayerResponse layer = layerService.getById(id);
        if (layer == null) {
            return ResponseEntity.notFound().build();
        }

        LayerRenderResponse response = new LayerRenderResponse();
        response.setId(layer.getId());
        response.setName(layer.getName());
        response.setLayerType(layer.getLayerType());
        response.setDataClass(layer.getDataClass());
        response.setStatus(layer.getStatus());
        response.setEpsgCode(layer.getEpsgCode());
        response.setSource(layer.getSource());

        response.setBboxMinLon(layer.getBboxMinLon());
        response.setBboxMinLat(layer.getBboxMinLat());
        response.setBboxMaxLon(layer.getBboxMaxLon());
        response.setBboxMaxLat(layer.getBboxMaxLat());

        LayerObject mapping = layerObjectRepository
            .findFirstByLayerIdAndRole(id, ObjectRole.DATA)
            .orElse(null);
        if (mapping != null) {
            response.setObjectId(mapping.getS3Object().getId());
            response.setS3Key(mapping.getS3Object().getS3Key());
            SignedUrlResponse signedUrl = layerObjectService.createSignedUrl(mapping.getS3Object().getId(), expires);
            response.setSignedUrl(signedUrl == null ? null : signedUrl.getUrl());
        }

        return ResponseEntity.ok(response);
    }
}
