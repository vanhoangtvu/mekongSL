package com.mekongsaltlab.org.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.zip.GZIPOutputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class BackupService {
    
    private final S3Service s3Service;
    
    @Value("${spring.datasource.url}")
    private String dbUrl;
    
    @Value("${spring.datasource.username}")
    private String dbUsername;
    
    @Value("${spring.datasource.password}")
    private String dbPassword;
    
    /**
     * Backup MySQL to S3 every day at 00:00
     */
    @Scheduled(cron = "0 0 0 * * ?")
    public void backupMysqlToS3() {
        log.info("Starting MySQL backup to S3...");
        
        try {
            // 1. Export MySQL to SQL file
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            Path sqlFile = exportMysqlToSql(timestamp);
            
            // 2. Compress SQL file
            Path gzipFile = compressSqlFile(sqlFile);
            
            // 3. Upload to S3
            String s3Key = "backups/mysql/" + timestamp + "_mekong.sql.gz";
            uploadFileToS3(s3Key, gzipFile);
            
            // 4. Cleanup local files
            Files.deleteIfExists(sqlFile);
            Files.deleteIfExists(gzipFile);
            
            log.info("MySQL backup completed successfully: {}", s3Key);
        } catch (Exception e) {
            log.error("Failed to backup MySQL to S3", e);
        }
    }
    
    /**
     * Export MySQL database to SQL file
     */
    private Path exportMysqlToSql(String timestamp) throws IOException, InterruptedException {
        // Extract database name from JDBC URL
        String dbName = extractDatabaseName(dbUrl);
        
        // Create temp file
        Path sqlFile = Files.createTempFile("backup_" + timestamp, ".sql");
        
        // Build mysqldump command
        ProcessBuilder processBuilder = new ProcessBuilder(
            "mysqldump",
            "-h", "127.0.0.1",
            "-u", dbUsername,
            "-p" + dbPassword,
            "--single-transaction",
            "--routines",
            "--triggers",
            dbName
        );
        
        processBuilder.redirectOutput(sqlFile.toFile());
        processBuilder.redirectErrorStream(true);
        
        Process process = processBuilder.start();
        int exitCode = process.waitFor();
        
        if (exitCode != 0) {
            throw new RuntimeException("mysqldump failed with exit code: " + exitCode);
        }
        
        log.info("MySQL exported to: {}", sqlFile);
        return sqlFile;
    }
    
    /**
     * Compress SQL file with GZIP
     */
    private Path compressSqlFile(Path sqlFile) throws IOException {
        Path gzipFile = Path.of(sqlFile.toString() + ".gz");
        
        try (FileInputStream fis = new FileInputStream(sqlFile.toFile());
             FileOutputStream fos = new FileOutputStream(gzipFile.toFile());
             GZIPOutputStream gzos = new GZIPOutputStream(fos)) {
            
            byte[] buffer = new byte[8192];
            int len;
            while ((len = fis.read(buffer)) > 0) {
                gzos.write(buffer, 0, len);
            }
        }
        
        log.info("SQL file compressed: {}", gzipFile);
        return gzipFile;
    }
    
    /**
     * Upload file to S3
     */
    private void uploadFileToS3(String key, Path file) throws IOException {
        try (FileInputStream fis = new FileInputStream(file.toFile())) {
            s3Service.uploadFile(key, fis, Files.size(file));
        }
        log.info("File uploaded to S3: {}", key);
    }
    
    /**
     * Extract database name from JDBC URL
     */
    private String extractDatabaseName(String jdbcUrl) {
        // jdbc:mysql://localhost:3306/mekong -> mekong
        String[] parts = jdbcUrl.split("/");
        String dbNameWithParams = parts[parts.length - 1];
        return dbNameWithParams.split("\\?")[0];
    }
    
    /**
     * Manual backup trigger (for testing or on-demand backup)
     */
    public String triggerManualBackup() {
        try {
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            Path sqlFile = exportMysqlToSql(timestamp);
            Path gzipFile = compressSqlFile(sqlFile);
            
            String s3Key = "backups/mysql/manual_" + timestamp + "_mekong.sql.gz";
            uploadFileToS3(s3Key, gzipFile);
            
            Files.deleteIfExists(sqlFile);
            Files.deleteIfExists(gzipFile);
            
            return s3Key;
        } catch (Exception e) {
            log.error("Manual backup failed", e);
            throw new RuntimeException("Backup failed: " + e.getMessage());
        }
    }
}
