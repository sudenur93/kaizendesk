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
                <div style="background:#f7f6f3;padding:40px 0;font-family:'Inter','Segoe UI',Arial,sans-serif">
                  <div style="max-width:560px;margin:0 auto">
                    <!-- Brand bar -->
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
                      <div style="width:28px;height:28px;border-radius:7px;background:#15130f;\
                color:#f7f6f3;display:inline-flex;align-items:center;justify-content:center;\
                font-weight:700;font-size:13px;letter-spacing:-0.02em;position:relative">
                        KD
                        <span style="position:absolute;right:3px;bottom:3px;width:6px;height:6px;\
                border-radius:50%;background:#c8202a"></span>
                      </div>
                      <span style="font-weight:600;font-size:14px;color:#15130f;letter-spacing:-0.01em">KaizenDesk</span>
                    </div>
                    <!-- Card -->
                    <div style="background:#fff;border:1px solid rgba(20,18,14,0.10);\
                border-radius:12px;overflow:hidden">
                      <!-- Accent top bar -->
                      <div style="height:3px;background:#c8202a"></div>
                      <div style="padding:28px 32px">
                        <h2 style="margin:0 0 14px;font-size:18px;font-weight:600;\
                color:#15130f;letter-spacing:-0.02em;line-height:1.2">%s</h2>
                        <p style="margin:0;font-size:14px;color:#4a4740;line-height:1.65">%s</p>
                      </div>
                      <!-- Footer -->
                      <div style="padding:16px 32px;border-top:1px solid rgba(20,18,14,0.08);\
                background:#fafaf8">
                        <p style="margin:0;font-size:11.5px;color:#8a867d">
                          Bu e-posta KaizenDesk sistemi tarafından otomatik gönderilmiştir.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                """.formatted(title, body);
    }
}
