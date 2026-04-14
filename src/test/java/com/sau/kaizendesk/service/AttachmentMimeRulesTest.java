package com.sau.kaizendesk.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class AttachmentMimeRulesTest {

    @Test
    void validate_rejectsBadExtension() {
        var f = new MockMultipartFile("file", "x.exe", "application/octet-stream", new byte[] {1});
        assertThatThrownBy(() -> AttachmentMimeRules.validate(f, 1_000_000))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported");
    }

    @Test
    void validate_acceptsTxt() {
        var f = new MockMultipartFile("file", "a.txt", "text/plain", new byte[] {65});
        AttachmentMimeRules.validate(f, 1_000_000);
    }
}
