package com.sau.kaizendesk;

import com.sau.kaizendesk.config.AttachmentStorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AttachmentStorageProperties.class)
public class KaizenDeskApplication {

    public static void main(String[] args) {
        SpringApplication.run(KaizenDeskApplication.class, args);
    }
}
