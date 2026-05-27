package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.Tag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TagRepository extends JpaRepository<Tag, Long> {
    Optional<Tag> findByName(String name);
}
