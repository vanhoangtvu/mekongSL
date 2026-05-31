package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.LayerCreateRequest;
import com.mekongsaltlab.org.dto.gis.LayerResponse;
import com.mekongsaltlab.org.dto.gis.LayerUpdateRequest;
import com.mekongsaltlab.org.entity.gis.Dataset;
import com.mekongsaltlab.org.entity.gis.Layer;
import com.mekongsaltlab.org.entity.gis.enums.DataClassType;
import com.mekongsaltlab.org.entity.gis.enums.GisDataType;
import com.mekongsaltlab.org.entity.gis.enums.LayerStatus;
import com.mekongsaltlab.org.entity.gis.enums.LayerType;
import com.mekongsaltlab.org.repository.gis.DatasetRepository;
import com.mekongsaltlab.org.repository.gis.LayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class LayerService {

    private final LayerRepository layerRepository;
    private final DatasetRepository datasetRepository;

    public Page<LayerResponse> list(
        Long datasetId,
        String status,
        String layerType,
        String dataClass,
        String source,
        String province,
        String station,
        String tagName,
        Instant startTime,
        Instant endTime,
        Double minLon,
        Double minLat,
        Double maxLon,
        Double maxLat,
        Pageable pageable
    ) {
        Page<Layer> page;

        if (minLon != null && minLat != null && maxLon != null && maxLat != null) {
            page = layerRepository.searchLayersWithBbox(
                datasetId,
                normalizeEnum(status),
                normalizeEnum(layerType),
                normalizeEnum(dataClass),
                source,
                province,
                station,
                startTime,
                endTime,
                tagName,
                minLon,
                minLat,
                maxLon,
                maxLat,
                pageable
            );
        } else {
            page = layerRepository.searchLayers(
                datasetId,
                normalizeEnum(status),
                normalizeEnum(layerType),
                normalizeEnum(dataClass),
                source,
                province,
                station,
                startTime,
                endTime,
                tagName,
                pageable
            );
        }

        return page.map(this::toResponse);
    }

    public LayerResponse getById(Long id) {
        return layerRepository.findById(id)
            .filter(layer -> Boolean.FALSE.equals(layer.getIsDeleted()))
            .map(this::toResponse)
            .orElse(null);
    }

    public LayerResponse create(LayerCreateRequest request) {
        Dataset dataset = datasetRepository.findById(request.getDatasetId())
            .filter(existing -> Boolean.FALSE.equals(existing.getIsDeleted()))
            .orElse(null);
        if (dataset == null) {
            return null;
        }

        Layer layer = new Layer();
        layer.setDataset(dataset);
        layer.setCategory(request.getCategory());
        layer.setYear(request.getYear());
        layer.setGisDataType(parseGisDataType(request.getGisDataType()));
        layer.setName(request.getName());
        layer.setDescription(request.getDescription());
        layer.setLayerType(parseLayerType(request.getLayerType()));
        layer.setDataClass(parseDataClass(request.getDataClass()));
        layer.setStatus(parseLayerStatus(request.getStatus()));
        layer.setOwnerId(request.getOwnerId());
        layer.setCreatedAt(Instant.now());
        layer.setUpdatedAt(null);
        layer.setIsDeleted(false);

        applyBbox(layer, request.getBboxMinLon(), request.getBboxMinLat(), request.getBboxMaxLon(), request.getBboxMaxLat());
        applyMeta(layer, request);

        return toResponse(layerRepository.save(layer));
    }

    public LayerResponse update(Long id, LayerUpdateRequest request) {
        Layer layer = layerRepository.findById(id).orElse(null);
        if (layer == null || Boolean.TRUE.equals(layer.getIsDeleted())) {
            return null;
        }

        if (request.getCategory() != null) {
            layer.setCategory(request.getCategory());
        }
        if (request.getYear() != null) {
            layer.setYear(request.getYear());
        }
        if (request.getGisDataType() != null) {
            layer.setGisDataType(parseGisDataType(request.getGisDataType()));
        }
        if (request.getName() != null) {
            layer.setName(request.getName());
        }
        if (request.getDescription() != null) {
            layer.setDescription(request.getDescription());
        }
        if (request.getLayerType() != null) {
            layer.setLayerType(parseLayerType(request.getLayerType()));
        }
        if (request.getDataClass() != null) {
            layer.setDataClass(parseDataClass(request.getDataClass()));
        }
        if (request.getStatus() != null) {
            layer.setStatus(parseLayerStatus(request.getStatus()));
        }

        applyBbox(layer, request.getBboxMinLon(), request.getBboxMinLat(), request.getBboxMaxLon(), request.getBboxMaxLat());
        applyMeta(layer, request);

        layer.setUpdatedAt(Instant.now());
        return toResponse(layerRepository.save(layer));
    }

    public boolean softDelete(Long id) {
        Layer layer = layerRepository.findById(id).orElse(null);
        if (layer == null) {
            return false;
        }
        layer.setIsDeleted(true);
        layer.setDeletedAt(Instant.now());
        layerRepository.save(layer);
        return true;
    }

    private void applyBbox(Layer layer, Double minLon, Double minLat, Double maxLon, Double maxLat) {
        if (minLon == null || minLat == null || maxLon == null || maxLat == null) {
            return;
        }
        layer.setMinLon(minLon);
        layer.setMinLat(minLat);
        layer.setMaxLon(maxLon);
        layer.setMaxLat(maxLat);
    }

    private void applyMeta(Layer layer, LayerCreateRequest request) {
        layer.setEpsgCode(request.getEpsgCode());
        layer.setRasterType(request.getRasterType());
        layer.setVectorType(request.getVectorType());
        layer.setResolutionX(request.getResolutionX());
        layer.setResolutionY(request.getResolutionY());
        layer.setObsTimeStart(request.getObsTimeStart());
        layer.setObsTimeEnd(request.getObsTimeEnd());
        layer.setProvince(request.getProvince());
        layer.setStation(request.getStation());
        layer.setSource(request.getSource());
    }

    private void applyMeta(Layer layer, LayerUpdateRequest request) {
        if (request.getEpsgCode() != null) {
            layer.setEpsgCode(request.getEpsgCode());
        }
        if (request.getRasterType() != null) {
            layer.setRasterType(request.getRasterType());
        }
        if (request.getVectorType() != null) {
            layer.setVectorType(request.getVectorType());
        }
        if (request.getResolutionX() != null) {
            layer.setResolutionX(request.getResolutionX());
        }
        if (request.getResolutionY() != null) {
            layer.setResolutionY(request.getResolutionY());
        }
        if (request.getObsTimeStart() != null) {
            layer.setObsTimeStart(request.getObsTimeStart());
        }
        if (request.getObsTimeEnd() != null) {
            layer.setObsTimeEnd(request.getObsTimeEnd());
        }
        if (request.getProvince() != null) {
            layer.setProvince(request.getProvince());
        }
        if (request.getStation() != null) {
            layer.setStation(request.getStation());
        }
        if (request.getSource() != null) {
            layer.setSource(request.getSource());
        }
    }

    private LayerResponse toResponse(Layer layer) {
        LayerResponse response = new LayerResponse();
        response.setId(layer.getId());
        response.setDatasetId(layer.getDataset().getId());
        response.setName(layer.getName());
        response.setDescription(layer.getDescription());
        response.setLayerType(layer.getLayerType() == null ? null : layer.getLayerType().name());
        response.setDataClass(layer.getDataClass() == null ? null : layer.getDataClass().name());
        response.setStatus(layer.getStatus() == null ? null : layer.getStatus().name());
        response.setOwnerId(layer.getOwnerId());
        response.setCreatedAt(layer.getCreatedAt());
        response.setUpdatedAt(layer.getUpdatedAt());

        response.setCategory(layer.getCategory());
        response.setYear(layer.getYear());
        response.setGisDataType(layer.getGisDataType() == null ? null : layer.getGisDataType().name());

        response.setBboxMinLon(layer.getMinLon());
        response.setBboxMinLat(layer.getMinLat());
        response.setBboxMaxLon(layer.getMaxLon());
        response.setBboxMaxLat(layer.getMaxLat());

        response.setEpsgCode(layer.getEpsgCode());
        response.setRasterType(layer.getRasterType());
        response.setVectorType(layer.getVectorType());
        response.setResolutionX(layer.getResolutionX());
        response.setResolutionY(layer.getResolutionY());
        response.setObsTimeStart(layer.getObsTimeStart());
        response.setObsTimeEnd(layer.getObsTimeEnd());
        response.setProvince(layer.getProvince());
        response.setStation(layer.getStation());
        response.setSource(layer.getSource());

        return response;
    }

    private LayerType parseLayerType(String value) {
        if (value == null) {
            return LayerType.RASTER;
        }
        return LayerType.valueOf(normalizeEnum(value));
    }

    private DataClassType parseDataClass(String value) {
        if (value == null) {
            return DataClassType.RAW;
        }
        return DataClassType.valueOf(normalizeEnum(value));
    }

    private LayerStatus parseLayerStatus(String value) {
        if (value == null) {
            return LayerStatus.ACTIVE;
        }
        return LayerStatus.valueOf(normalizeEnum(value));
    }

    private GisDataType parseGisDataType(String value) {
        if (value == null) {
            return null;
        }
        return GisDataType.valueOf(normalizeEnum(value));
    }

    private String normalizeEnum(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }
}
