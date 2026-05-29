package com.sau.kaizendesk.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kaizendesk.attachments")
public class AttachmentStorageProperties {

    /** Kök dizin (mutlak veya göreli yol). */
    private String directory = "./data/attachments";

    /** Tek dosya üst sınırı (bayt). */
    private long maxFileSizeBytes = 10 * 1024 * 1024;

    public String getDirectory() {
        return directory;
    }

    public void setDirectory(String directory) {
        this.directory = directory;
    }

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public Path rootPath() {
        return Paths.get(directory).toAbsolutePath().normalize();
    }
}
