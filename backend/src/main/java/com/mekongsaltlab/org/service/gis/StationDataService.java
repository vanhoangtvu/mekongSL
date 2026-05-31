package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.StationDataResponse;
import com.mekongsaltlab.org.dto.gis.SignedUrlResponse;
import com.mekongsaltlab.org.entity.gis.S3Object;
import com.mekongsaltlab.org.entity.gis.Station;
import com.mekongsaltlab.org.entity.gis.StationDataFile;
import com.mekongsaltlab.org.repository.gis.S3ObjectRepository;
import com.mekongsaltlab.org.repository.gis.StationDataFileRepository;
import com.mekongsaltlab.org.repository.gis.StationRepository;
import com.mekongsaltlab.org.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StationDataService {

    private final StationRepository stationRepository;
    private final StationDataFileRepository stationDataFileRepository;
    private final S3ObjectRepository s3ObjectRepository;
    private final S3Service s3Service;
    private final StoragePathService storagePathService;

    @Value("${s3.bucket}")
    private String bucketName;

    public StationDataResponse uploadData(String stationDataType, String stationCode,
                                          String parameter, MultipartFile file,
                                          LocalDate date, String time) throws IOException {
        Station station = stationRepository.findByStationCode(stationCode)
            .orElseGet(() -> {
                Station newStation = new Station();
                newStation.setStationCode(stationCode);
                newStation.setName("Trạm " + stationCode);
                newStation.setIsActive(true);
                newStation.setCreatedAt(Instant.now());
                return stationRepository.save(newStation);
            });

        int year = date.getYear();
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String s3Key = storagePathService.buildStationPath(
            stationDataType, stationCode, parameter, year, month, day, time, safeFilename);

        s3Service.uploadFile(s3Key, file);

        S3Object s3Object = s3ObjectRepository
            .findByBucketAndS3Key(bucketName, s3Key)
            .orElseGet(S3Object::new);

        s3Object.setBucket(bucketName);
        s3Object.setS3Key(s3Key);
        s3Object.setSizeBytes(file.getSize());
        s3Object.setContentType(file.getContentType());
        if (s3Object.getCreatedAt() == null) {
            s3Object.setCreatedAt(Instant.now());
        }
        s3Object.setUploadedAt(Instant.now());
        s3Object.setIsDeleted(false);
        S3Object savedObject = s3ObjectRepository.save(s3Object);

        StationDataFile dataFile = stationDataFileRepository
            .findByStationIdAndParameterAndDataYearAndDataMonthAndDataDay(station.getId(), parameter, year, month, day)
            .orElseGet(StationDataFile::new);

        dataFile.setStation(station);
        dataFile.setParameter(parameter);
        dataFile.setDataYear(year);
        dataFile.setDataMonth(month);
        dataFile.setDataDay(day);
        dataFile.setS3Object(savedObject);
        dataFile.setFileFormat("CSV");
        if (dataFile.getCreatedAt() == null) {
            dataFile.setCreatedAt(Instant.now());
        }

        return toResponse(stationDataFileRepository.save(dataFile));
    }

    public StationDataResponse getById(Long id) {
        return stationDataFileRepository.findById(id)
            .map(this::toResponse)
            .orElse(null);
    }

    public List<StationDataResponse> listData(String stationCode, String parameter) {
        return stationRepository.findByStationCode(stationCode)
            .map(station -> stationDataFileRepository
                .findByStationIdAndParameterOrderByDataYearDescDataMonthDescDataDayDesc(station.getId(), parameter)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList()))
            .orElse(List.of());
    }

    public List<StationDataResponse> listAllData(String stationCode) {
        return stationRepository.findByStationCode(stationCode)
            .map(station -> stationDataFileRepository
                .findByStationId(station.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList()))
            .orElse(List.of());
    }

    public boolean deleteById(Long id) {
        StationDataFile dataFile = stationDataFileRepository.findById(id).orElse(null);
        if (dataFile == null) return false;

        S3Object s3Object = dataFile.getS3Object();
        s3Object.setIsDeleted(true);
        s3Object.setDeletedAt(Instant.now());
        s3ObjectRepository.save(s3Object);

        stationDataFileRepository.delete(dataFile);
        return true;
    }

    public SignedUrlResponse getSignedUrl(Long id, long expiresSeconds) {
        StationDataFile dataFile = stationDataFileRepository.findById(id).orElse(null);
        if (dataFile == null) return null;

        String s3Key = dataFile.getS3Object().getS3Key();
        Duration expiresIn = Duration.ofSeconds(Math.max(60, expiresSeconds));
        String url = s3Service.createSignedGetUrl(s3Key, expiresIn);

        SignedUrlResponse response = new SignedUrlResponse();
        response.setUrl(url);
        response.setExpiresAt(Instant.now().plus(expiresIn));
        return response;
    }

    private StationDataResponse toResponse(StationDataFile dataFile) {
        StationDataResponse response = new StationDataResponse();
        response.setId(dataFile.getId());
        response.setStationId(dataFile.getStation().getId());
        response.setStationCode(dataFile.getStation().getStationCode());
        response.setStationName(dataFile.getStation().getName());
        response.setParameter(dataFile.getParameter());
        response.setDataYear(dataFile.getDataYear());
        response.setDataMonth(dataFile.getDataMonth());
        response.setDataDay(dataFile.getDataDay());
        response.setS3Key(dataFile.getS3Object().getS3Key());
        response.setSizeBytes(dataFile.getS3Object().getSizeBytes());
        response.setContentType(dataFile.getS3Object().getContentType());
        response.setFileFormat(dataFile.getFileFormat());
        response.setRecordCount(dataFile.getRecordCount());
        response.setCreatedAt(dataFile.getCreatedAt());
        return response;
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) return "unknown.csv";
        return filename.replaceAll("[^a-zA-Z0-9_\\-\\.]", "_");
    }
}
