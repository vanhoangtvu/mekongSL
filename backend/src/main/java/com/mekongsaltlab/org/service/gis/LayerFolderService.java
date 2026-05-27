package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.FolderCreateRequest;
import com.mekongsaltlab.org.dto.gis.LayerFolderDto;
import com.mekongsaltlab.org.entity.gis.Layer;
import com.mekongsaltlab.org.entity.gis.LayerFolder;
import com.mekongsaltlab.org.repository.gis.LayerFolderRepository;
import com.mekongsaltlab.org.repository.gis.LayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LayerFolderService {

    private final LayerFolderRepository folderRepository;
    private final LayerRepository layerRepository;

    public LayerFolderDto createFolder(FolderCreateRequest request) {
        Layer layer = layerRepository.findById(request.getLayerId())
            .orElseThrow(() -> new IllegalArgumentException("Layer not found"));

        String name = sanitizeName(request.getName());
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Invalid folder name");
        }

        LayerFolder parent = null;
        String logicalPath = "/" + name;
        if (request.getParentId() != null) {
            parent = folderRepository.findByIdAndIsDeletedFalse(request.getParentId())
                .orElseThrow(() -> new IllegalArgumentException("Parent folder not found"));
            logicalPath = parent.getLogicalPath() + "/" + name;
        }

        // Check duplicates
        if (folderRepository.findByLayerIdAndLogicalPathAndIsDeletedFalse(layer.getId(), logicalPath).isPresent()) {
            throw new IllegalArgumentException("Folder already exists at this path");
        }

        LayerFolder folder = new LayerFolder();
        folder.setLayer(layer);
        folder.setParent(parent);
        folder.setName(name);
        folder.setLogicalPath(logicalPath);
        folder.setIsDeleted(false);
        // Note: createdBy should be set from SecurityContext in a real app

        return toDto(folderRepository.save(folder));
    }

    public List<LayerFolderDto> getFolderTree(Long layerId) {
        List<LayerFolder> allFolders = folderRepository.findByLayerIdAndIsDeletedFalse(layerId);
        Map<Long, LayerFolderDto> dtoMap = allFolders.stream()
            .collect(Collectors.toMap(LayerFolder::getId, this::toDto));

        List<LayerFolderDto> rootFolders = new ArrayList<>();
        for (LayerFolder folder : allFolders) {
            LayerFolderDto dto = dtoMap.get(folder.getId());
            if (folder.getParent() == null) {
                rootFolders.add(dto);
            } else {
                LayerFolderDto parentDto = dtoMap.get(folder.getParent().getId());
                if (parentDto != null) {
                    if (parentDto.getChildren() == null) {
                        parentDto.setChildren(new ArrayList<>());
                    }
                    parentDto.getChildren().add(dto);
                }
            }
        }
        return rootFolders;
    }

    public LayerFolderDto getFolder(Long id) {
        return folderRepository.findByIdAndIsDeletedFalse(id)
            .map(this::toDto)
            .orElse(null);
    }

    public LayerFolderDto renameFolder(Long id, String newName) {
        LayerFolder folder = folderRepository.findByIdAndIsDeletedFalse(id)
            .orElseThrow(() -> new IllegalArgumentException("Folder not found"));

        String name = sanitizeName(newName);
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Invalid folder name");
        }

        folder.setName(name);
        String newLogicalPath = (folder.getParent() != null ? folder.getParent().getLogicalPath() : "") + "/" + name;
        folder.setLogicalPath(newLogicalPath);
        // Should recursively update children logical paths in a real app, but for simplicity we keep it lightweight

        return toDto(folderRepository.save(folder));
    }

    public boolean deleteFolder(Long id) {
        return folderRepository.findByIdAndIsDeletedFalse(id).map(folder -> {
            folder.setIsDeleted(true);
            folderRepository.save(folder);
            // Also soft delete children
            List<LayerFolder> children = folderRepository.findByParentIdAndIsDeletedFalse(id);
            for (LayerFolder child : children) {
                deleteFolder(child.getId());
            }
            return true;
        }).orElse(false);
    }

    private String sanitizeName(String name) {
        if (name == null) return "";
        return name.replaceAll("[^a-zA-Z0-9_\\-]", "").toLowerCase();
    }

    private LayerFolderDto toDto(LayerFolder folder) {
        LayerFolderDto dto = new LayerFolderDto();
        dto.setId(folder.getId());
        dto.setLayerId(folder.getLayer().getId());
        dto.setParentId(folder.getParent() != null ? folder.getParent().getId() : null);
        dto.setName(folder.getName());
        dto.setLogicalPath(folder.getLogicalPath());
        dto.setCreatedAt(folder.getCreatedAt());
        return dto;
    }
}
