package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.TagLink;
import com.mekongsaltlab.org.entity.gis.enums.TagEntityType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TagLinkRepository extends JpaRepository<TagLink, Long> {
    List<TagLink> findByEntityTypeAndEntityId(TagEntityType entityType, Long entityId);
    boolean existsByTagIdAndEntityTypeAndEntityId(Long tagId, TagEntityType entityType, Long entityId);
}
