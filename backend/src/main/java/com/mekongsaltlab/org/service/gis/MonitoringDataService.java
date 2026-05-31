package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.MonitoringDataResponse;
import com.mekongsaltlab.org.entity.gis.MonitoringDataFile;
import com.mekongsaltlab.org.entity.gis.MonitoringStation;
import com.mekongsaltlab.org.entity.gis.S3Object;
import com.mekongsaltlab.org.repository.gis.MonitoringDataFileRepository;
import com.mekongsaltlab.org.repository.gis.MonitoringStationRepository;
import com.mekongsaltlab.org.repository.gis.S3ObjectRepository;
import com.mekongsaltlab.org.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MonitoringDataService {

    private final MonitoringStationRepository monitoringStationRepository;
    private final MonitoringDataFileRepository monitoringDataFileRepository;
    private final S3ObjectRepository s3ObjectRepository;
    private final S3Service s3Service;
    private final StoragePathService storagePathService;

    @Value("${s3.bucket}")
    private String bucketName;

    public MonitoringDataResponse uploadData(String monitoringCode, String parameter, MultipartFile file, LocalDate date) throws IOException {
        MonitoringStation station = monitoringStationRepository.findByMonitoringCode(monitoringCode)
            .orElseThrow(() -> new IllegalArgumentException("Monitoring station not found: " + monitoringCode));

        int year = date.getYear();
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String s3Key = storagePathService.buildMonitoringPath(monitoringCode, parameter, year, month, day, safeFilename);

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

        MonitoringDataFile dataFile = monitoringDataFileRepository
            .findByMonitoringStationIdAndParameterAndDataYearAndDataMonthAndDataDay(station.getId(), parameter, year, month, day)
            .orElseGet(MonitoringDataFile::new);

        dataFile.setMonitoringStation(station);
        dataFile.setParameter(parameter);
        dataFile.setDataYear(year);
        dataFile.setDataMonth(month);
        dataFile.setDataDay(day);
        dataFile.setS3Object(savedObject);
        dataFile.setFileFormat("CSV");
        if (dataFile.getCreatedAt() == null) {
            dataFile.setCreatedAt(Instant.now());
        }

        return toResponse(monitoringDataFileRepository.save(dataFile));
    }

    public List<MonitoringDataResponse> listData(String monitoringCode, String parameter) {
        MonitoringStation station = monitoringStationRepository.findByMonitoringCode(monitoringCode)
            .orElseThrow(() -> new IllegalArgumentException("Monitoring station not found: " + monitoringCode));

        return monitoringDataFileRepository
            .findByMonitoringStationIdAndParameterOrderByDataYearDescDataMonthDescDataDayDesc(station.getId(), parameter)
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    public List<MonitoringDataResponse> listAllData(String monitoringCode) {
        MonitoringStation station = monitoringStationRepository.findByMonitoringCode(monitoringCode)
            .orElseThrow(() -> new IllegalArgumentException("Monitoring station not found: " + monitoringCode));

        return monitoringDataFileRepository
            .findByMonitoringStationId(station.getId())
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    private MonitoringDataResponse toResponse(MonitoringDataFile dataFile) {
        MonitoringDataResponse response = new MonitoringDataResponse();
        response.setId(dataFile.getId());
        response.setMonitoringStationId(dataFile.getMonitoringStation().getId());
        response.setMonitoringCode(dataFile.getMonitoringStation().getMonitoringCode());
        response.setMonitoringName(dataFile.getMonitoringStation().getName());
        response.setParameter(dataFile.getParameter());
        response.setDataYear(dataFile.getDataYear());
        response.setDataMonth(dataFile.getDataMonth());
        response.setDataDay(dataFile.getDataDay());
        response.setS3Key(dataFile.getS3Object().getS3Key());
        response.setSizeBytes(dataFile.getS3Object().getSizeBytes());
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
