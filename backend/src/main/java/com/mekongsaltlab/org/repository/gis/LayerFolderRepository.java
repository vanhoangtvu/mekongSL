package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.LayerFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LayerFolderRepository extends JpaRepository<LayerFolder, Long> {
    List<LayerFolder> findByLayerIdAndIsDeletedFalse(Long layerId);
    List<LayerFolder> findByParentIdAndIsDeletedFalse(Long parentId);
    Optional<LayerFolder> findByIdAndIsDeletedFalse(Long id);
    Optional<LayerFolder> findByLayerIdAndLogicalPathAndIsDeletedFalse(Long layerId, String logicalPath);
}
