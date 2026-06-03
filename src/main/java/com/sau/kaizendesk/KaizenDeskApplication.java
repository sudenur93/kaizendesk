package com.sau.kaizendesk;

import com.sau.kaizendesk.config.AttachmentStorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

// jBPM/Kogito Spring Boot starter autoconfiguration kullanmaz; runtime bean'lerini
// component-scan ile sağlar. Bu yüzden aşağıdaki paketler tarama kapsamına alınır:
//  - org.kie.kogito.app    : codegen üretimi (Application, Processes, ProcessConfig, ConfigBean...)
//  - org.kie.kogito.process : KogitoBeanProducer (UnitOfWorkManager, JobsService, CorrelationService...)
//  - org.kie.kogito.spring  : SpringIdentityProvider (IdentityProvider)
//  - org.drools.bpmn2       : BPMN'den üretilen süreç sınıfları (TicketFlowProcess, TicketFlowResource...)
@SpringBootApplication(scanBasePackages = {
        "com.sau.kaizendesk",
        "org.kie.kogito.app",
        "org.kie.kogito.process",
        "org.kie.kogito.spring",
        "org.drools.bpmn2"
})
@EnableConfigurationProperties(AttachmentStorageProperties.class)
@EnableAsync
@EnableScheduling
public class KaizenDeskApplication {

    public static void main(String[] args) {
        SpringApplication.run(KaizenDeskApplication.class, args);
    }
}
