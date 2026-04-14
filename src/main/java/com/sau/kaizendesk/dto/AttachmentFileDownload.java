package com.sau.kaizendesk.dto;

import org.springframework.core.io.Resource;

public record AttachmentFileDownload(String originalFileName, String contentType, Resource resource) {}
