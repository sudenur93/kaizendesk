package com.sau.kaizendesk.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Analiz: txt, docx, xlsx, pdf, png, jpeg. İçerik türü + uzantı ile doğrulama (ikisi de uygun olmalı).
 */
public final class AttachmentMimeRules {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of(".txt", ".docx", ".xlsx", ".pdf", ".png", ".jpeg", ".jpg");

    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of(
                    "text/plain",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/pdf",
                    "image/png",
                    "image/jpeg");

    private AttachmentMimeRules() {
    }

    public static String extensionFromOriginalName(String originalFilename) {
        if (!StringUtils.hasText(originalFilename)) {
            return "";
        }
        String name = originalFilename.replace("\\", "/");
        int slash = name.lastIndexOf('/');
        String base = slash >= 0 ? name.substring(slash + 1) : name;
        int dot = base.lastIndexOf('.');
        if (dot < 0 || dot == base.length() - 1) {
            return "";
        }
        return base.substring(dot).toLowerCase(Locale.ROOT);
    }

    public static void validate(MultipartFile file, long maxBytes) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }
        long size = file.getSize();
        if (size > maxBytes) {
            throw new IllegalArgumentException("File exceeds maximum size");
        }
        if (size <= 0) {
            throw new IllegalArgumentException("File is empty");
        }
        String ext = extensionFromOriginalName(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("Unsupported file type");
        }
        String ct = file.getContentType();
        if (StringUtils.hasText(ct)) {
            String lower = ct.toLowerCase(Locale.ROOT).trim();
            if (!ALLOWED_CONTENT_TYPES.contains(lower) && !"application/octet-stream".equals(lower)) {
                throw new IllegalArgumentException("Unsupported content type");
            }
        }
    }

    private static final Set<String> LOG_KEYWORDS =
            Set.of("error", "exception", "warn", "fail", "stack", "trace", "log", "info", "debug", "fatal");

    /**
     * .txt dosyasının içinde log anahtar kelimeleri arar.
     * Bulunan kelimelerin listesini döner; boş liste = anahtar kelime yok.
     */
    public static List<String> findLogKeywords(InputStream inputStream) throws IOException {
        String content;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            char[] buf = new char[8192];
            int read;
            long total = 0;
            while ((read = reader.read(buf)) != -1 && total < 512_000) {
                sb.append(buf, 0, read);
                total += read;
            }
            content = sb.toString().toLowerCase(Locale.ROOT);
        }
        return LOG_KEYWORDS.stream()
                .filter(content::contains)
                .sorted()
                .toList();
    }

    public static boolean isTextFile(String originalFilename) {
        return ".txt".equals(extensionFromOriginalName(originalFilename));
    }

    public static String safeOriginalFileName(String originalFilename) {
        if (!StringUtils.hasText(originalFilename)) {
            return "upload";
        }
        String name = originalFilename.replace("\\", "/");
        int slash = name.lastIndexOf('/');
        return slash >= 0 ? name.substring(slash + 1) : name;
    }
}
