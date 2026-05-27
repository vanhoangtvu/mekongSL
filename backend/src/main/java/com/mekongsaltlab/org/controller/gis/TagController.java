package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.TagRequest;
import com.mekongsaltlab.org.dto.gis.TagResponse;
import com.mekongsaltlab.org.service.gis.TagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/gis")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @GetMapping("/tags")
    public ResponseEntity<List<TagResponse>> listTags() {
        return ResponseEntity.ok(tagService.listTags());
    }

    @PostMapping("/tags")
    public ResponseEntity<TagResponse> create(@RequestBody TagRequest request) {
        return ResponseEntity.ok(tagService.create(request));
    }

    @PostMapping("/layers/{layerId}/tags")
    public ResponseEntity<Void> addTagToLayer(@PathVariable Long layerId, @RequestBody TagRequest request) {
        tagService.addTagToLayer(layerId, request.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/layers/{layerId}/tags")
    public ResponseEntity<List<TagResponse>> listLayerTags(@PathVariable Long layerId) {
        return ResponseEntity.ok(tagService.listTagsForLayer(layerId));
    }

    @PostMapping("/datasets/{datasetId}/tags")
    public ResponseEntity<Void> addTagToDataset(@PathVariable Long datasetId, @RequestBody TagRequest request) {
        tagService.addTagToDataset(datasetId, request.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/datasets/{datasetId}/tags")
    public ResponseEntity<List<TagResponse>> listDatasetTags(@PathVariable Long datasetId) {
        return ResponseEntity.ok(tagService.listTagsForDataset(datasetId));
    }
}
