package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.DatasetCreateRequest;
import com.mekongsaltlab.org.dto.gis.DatasetResponse;
import com.mekongsaltlab.org.dto.gis.DatasetUpdateRequest;
import com.mekongsaltlab.org.entity.gis.Dataset;
import com.mekongsaltlab.org.repository.gis.DatasetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class DatasetService {

    private final DatasetRepository datasetRepository;

    public Page<DatasetResponse> list(Pageable pageable) {
        return datasetRepository.findByIsDeletedFalse(pageable).map(this::toResponse);
    }

    public DatasetResponse getById(Long id) {
        return datasetRepository.findById(id)
            .filter(dataset -> Boolean.FALSE.equals(dataset.getIsDeleted()))
            .map(this::toResponse)
            .orElse(null);
    }

    public DatasetResponse create(DatasetCreateRequest request) {
        Dataset dataset = new Dataset();
        dataset.setName(request.getName());
        dataset.setDescription(request.getDescription());
        dataset.setOwnerId(request.getOwnerId());
        dataset.setCreatedAt(Instant.now());
        dataset.setUpdatedAt(null);
        dataset.setIsDeleted(false);
        return toResponse(datasetRepository.save(dataset));
    }

    public DatasetResponse update(Long id, DatasetUpdateRequest request) {
        Dataset dataset = datasetRepository.findById(id).orElse(null);
        if (dataset == null) {
            return null;
        }
        if (request.getName() != null) {
            dataset.setName(request.getName());
        }
        if (request.getDescription() != null) {
            dataset.setDescription(request.getDescription());
        }
        dataset.setUpdatedAt(Instant.now());
        return toResponse(datasetRepository.save(dataset));
    }

    public boolean softDelete(Long id) {
        Dataset dataset = datasetRepository.findById(id).orElse(null);
        if (dataset == null) {
            return false;
        }
        dataset.setIsDeleted(true);
        dataset.setDeletedAt(Instant.now());
        datasetRepository.save(dataset);
        return true;
    }

    private DatasetResponse toResponse(Dataset dataset) {
        DatasetResponse response = new DatasetResponse();
        response.setId(dataset.getId());
        response.setName(dataset.getName());
        response.setDescription(dataset.getDescription());
        response.setOwnerId(dataset.getOwnerId());
        response.setCreatedAt(dataset.getCreatedAt());
        response.setUpdatedAt(dataset.getUpdatedAt());
        return response;
    }
}
