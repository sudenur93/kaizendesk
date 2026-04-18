package com.sau.kaizendesk;

import com.sau.kaizendesk.config.AttachmentStorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableConfigurationProperties(AttachmentStorageProperties.class)
@EnableAsync
public class KaizenDeskApplication {

    public static void main(String[] args) {
        SpringApplication.run(KaizenDeskApplication.class, args);
    }
}
