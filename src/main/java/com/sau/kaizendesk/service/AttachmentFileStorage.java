package com.sau.kaizendesk.service;

import com.sau.kaizendesk.config.AttachmentStorageProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AttachmentFileStorage implements InitializingBean {

    private final Path root;

    public AttachmentFileStorage(AttachmentStorageProperties properties) {
        this.root = properties.rootPath();
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        Files.createDirectories(root);
    }

    public Path resolveStoredFile(Long ticketId, String storedFileName) {
        validateRelativeFileName(storedFileName);
        Path ticketDir = root.resolve(ticketId.toString()).normalize();
        Path target = ticketDir.resolve(storedFileName).normalize();
        if (!target.startsWith(ticketDir)) {
            throw new IllegalArgumentException("Invalid path");
        }
        return target;
    }

    public void store(Long ticketId, String storedFileName, InputStream inputStream) throws IOException {
        validateRelativeFileName(storedFileName);
        Path ticketDir = root.resolve(ticketId.toString()).normalize();
        Files.createDirectories(ticketDir);
        Path target = ticketDir.resolve(storedFileName).normalize();
        if (!target.startsWith(ticketDir)) {
            throw new IllegalArgumentException("Invalid path");
        }
        Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
    }

    public boolean exists(Long ticketId, String storedFileName) {
        return Files.isRegularFile(resolveStoredFile(ticketId, storedFileName));
    }

    private static void validateRelativeFileName(String storedFileName) {
        if (!StringUtils.hasText(storedFileName)
                || storedFileName.contains("/")
                || storedFileName.contains("\\")
                || storedFileName.contains("..")) {
            throw new IllegalArgumentException("Invalid stored file name");
        }
    }
}
