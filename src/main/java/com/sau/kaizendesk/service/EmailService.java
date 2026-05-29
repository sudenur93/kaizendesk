package com.sau.kaizendesk.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * HTML e-posta gönderimini sağlayan servis.
 *
 * Gönderim @Async ile arka planda yapılır — ana işlem bloklanmaz.
 * SMTP ayarları application.yml'dan gelir; geliştirme ortamında MailHog (port 1025) kullanılır.
 * Gönderim başarısız olursa hata loglanır; exception fırlatılmaz (best-effort).
 *
 * E-posta şablonu: KaizenDesk mor başlıklı sade HTML tasarımı.
 * Tetikleyici: TicketNotificationService.persist() her yeni bildirimde bu servisi çağırır.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${kaizendesk.mail.from:no-reply@kaizendesk.local}") String fromAddress
    ) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    /**
     * HTML formatında e-posta gönderir.
     * @Async sayesinde çağıran thread bloklanmaz; ayrı bir thread pool'da çalışır.
     */
    @Async
    public void send(String to, String subject, String title, String body) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(buildHtml(title, body), true);
            mailSender.send(msg);
            log.info("E-posta gönderildi: to={}, subject={}", to, subject);
        } catch (MessagingException ex) {
            log.error("E-posta gönderilemedi: to={}, subject={}", to, subject, ex);
        }
    }

    private static String buildHtml(String title, String body) {
        return """
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;\
                padding:24px;border:1px solid #e0e0e0;border-radius:8px">
                  <div style="background:#6c3ec1;color:#fff;padding:16px 24px;\
                border-radius:8px 8px 0 0;margin:-24px -24px 24px -24px">
                    <h2 style="margin:0;font-size:20px">KaizenDesk</h2>
                  </div>
                  <h3 style="color:#333;margin-top:0">%s</h3>
                  <p style="color:#555;line-height:1.6">%s</p>
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
                  <p style="color:#999;font-size:12px">Bu e-posta KaizenDesk sistemi tarafından otomatik gönderilmiştir.</p>
                </div>
                """.formatted(title, body);
    }
}
