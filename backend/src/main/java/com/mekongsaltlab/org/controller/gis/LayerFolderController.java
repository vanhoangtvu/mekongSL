package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.FolderCreateRequest;
import com.mekongsaltlab.org.dto.gis.LayerFolderDto;
import com.mekongsaltlab.org.service.gis.LayerFolderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gis")
@RequiredArgsConstructor
public class LayerFolderController {

    private final LayerFolderService folderService;

    @PostMapping("/folders")
    public ResponseEntity<LayerFolderDto> createFolder(@RequestBody FolderCreateRequest request) {
        try {
            return ResponseEntity.ok(folderService.createFolder(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/layers/{layerId}/folders/tree")
    public ResponseEntity<List<LayerFolderDto>> getFolderTree(@PathVariable Long layerId) {
        return ResponseEntity.ok(folderService.getFolderTree(layerId));
    }

    @GetMapping("/folders/{id}")
    public ResponseEntity<LayerFolderDto> getFolder(@PathVariable Long id) {
        LayerFolderDto dto = folderService.getFolder(id);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @PatchMapping("/folders/{id}")
    public ResponseEntity<LayerFolderDto> renameFolder(
        @PathVariable Long id,
        @RequestBody Map<String, String> request
    ) {
        try {
            return ResponseEntity.ok(folderService.renameFolder(id, request.get("name")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/folders/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable Long id) {
        if (!folderService.deleteFolder(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
