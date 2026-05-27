package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.TagRequest;
import com.mekongsaltlab.org.dto.gis.TagResponse;
import com.mekongsaltlab.org.entity.gis.Tag;
import com.mekongsaltlab.org.entity.gis.TagLink;
import com.mekongsaltlab.org.entity.gis.enums.TagEntityType;
import com.mekongsaltlab.org.repository.gis.TagLinkRepository;
import com.mekongsaltlab.org.repository.gis.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;
    private final TagLinkRepository tagLinkRepository;

    public List<TagResponse> listTags() {
        return tagRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    public TagResponse create(TagRequest request) {
        Tag tag = tagRepository.findByName(request.getName()).orElseGet(Tag::new);
        tag.setName(request.getName());
        if (tag.getCreatedAt() == null) {
            tag.setCreatedAt(Instant.now());
        }
        return toResponse(tagRepository.save(tag));
    }

    public List<TagResponse> listTagsForLayer(Long layerId) {
        return tagLinkRepository.findByEntityTypeAndEntityId(TagEntityType.LAYER, layerId)
            .stream()
            .map(TagLink::getTag)
            .distinct()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    public List<TagResponse> listTagsForDataset(Long datasetId) {
        return tagLinkRepository.findByEntityTypeAndEntityId(TagEntityType.DATASET, datasetId)
            .stream()
            .map(TagLink::getTag)
            .distinct()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    public void addTagToLayer(Long layerId, String tagName) {
        Tag tag = tagRepository.findByName(tagName).orElseGet(() -> {
            Tag created = new Tag();
            created.setName(tagName);
            created.setCreatedAt(Instant.now());
            return tagRepository.save(created);
        });

        if (tagLinkRepository.existsByTagIdAndEntityTypeAndEntityId(tag.getId(), TagEntityType.LAYER, layerId)) {
            return;
        }

        TagLink link = new TagLink();
        link.setTag(tag);
        link.setEntityType(TagEntityType.LAYER);
        link.setEntityId(layerId);
        link.setCreatedAt(Instant.now());
        tagLinkRepository.save(link);
    }

    public void addTagToDataset(Long datasetId, String tagName) {
        Tag tag = tagRepository.findByName(tagName).orElseGet(() -> {
            Tag created = new Tag();
            created.setName(tagName);
            created.setCreatedAt(Instant.now());
            return tagRepository.save(created);
        });

        if (tagLinkRepository.existsByTagIdAndEntityTypeAndEntityId(tag.getId(), TagEntityType.DATASET, datasetId)) {
            return;
        }

        TagLink link = new TagLink();
        link.setTag(tag);
        link.setEntityType(TagEntityType.DATASET);
        link.setEntityId(datasetId);
        link.setCreatedAt(Instant.now());
        tagLinkRepository.save(link);
    }

    private TagResponse toResponse(Tag tag) {
        TagResponse response = new TagResponse();
        response.setId(tag.getId());
        response.setName(tag.getName());
        return response;
    }
}
