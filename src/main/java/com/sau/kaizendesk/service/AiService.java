package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Comment;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.repository.CommentRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

@Service
@Transactional(readOnly = true)
public class AiService {

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL = "llama-3.1-8b-instant";

    private final TicketRepository ticketRepository;
    private final CommentRepository commentRepository;
    private final RestClient restClient;

    @Value("${groq.api-key:}")
    private String apiKey;

    public AiService(TicketRepository ticketRepository, CommentRepository commentRepository) {
        this.ticketRepository = ticketRepository;
        this.commentRepository = commentRepository;
        this.restClient = RestClient.create();
    }

    public String summarizeTicket(Long ticketId) {
        if (apiKey == null || apiKey.isBlank()) {
            return "AI servisi yapılandırılmamış (GROQ_API_KEY eksik).";
        }

        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket bulunamadı: " + ticketId));

        List<Comment> comments = commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);

        StringBuilder sb = new StringBuilder();
        sb.append("Talep No: ").append(ticket.getTicketNo()).append("\n");
        sb.append("Başlık: ").append(ticket.getTitle()).append("\n");
        sb.append("Açıklama: ").append(ticket.getDescription()).append("\n");
        sb.append("Durum: ").append(ticket.getStatus()).append("\n");
        sb.append("Öncelik: ").append(ticket.getPriority()).append("\n\n");

        if (!comments.isEmpty()) {
            sb.append("Konuşma geçmişi:\n");
            for (Comment c : comments) {
                String author = c.getUser() != null ? c.getUser().getUsername() : "Bilinmeyen";
                String type = c.isInternal() ? "[Dahili] " : "";
                sb.append("- ").append(author).append(" ").append(type)
                        .append(": ").append(c.getMessage()).append("\n");
            }
        }

        String prompt = "Aşağıdaki destek talebini Türkçe olarak 3-5 cümleyle özetle. "
                + "Sorunun ne olduğunu, şu anki durumu ve varsa çözümü belirt. "
                + "Teknik olmayan, sade bir dille yaz.\n\n" + sb;

        return callGroq("Sen bir destek sistemi asistanısın.", prompt);
    }

    public String analyzeDashboard(String statsJson) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış.";
        String prompt = "Aşağıdaki destek merkezi istatistiklerini analiz et ve Türkçe olarak 3-4 cümlelik kısa bir yönetici özeti yaz. "
                + "Dikkat çeken noktalara, olumlu/olumsuz trendlere değin. Sade ve net ol.\n\n" + statsJson;
        return callGroq("Sen bir destek merkezi analisti ve yönetim danışmanısın.", prompt);
    }

    public String analyzeTeam(String teamJson) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış.";
        String prompt = "Aşağıdaki destek ekibi performans verilerini analiz et ve Türkçe olarak 3-4 cümlelik bir özet yaz. "
                + "Öne çıkan ajanları, iş yükü dağılımını ve önerileri belirt.\n\n" + teamJson;
        return callGroq("Sen bir ekip performans analisti ve yönetim danışmanısın.", prompt);
    }

    public String analyzeSla(String slaJson) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış.";
        String prompt = "Aşağıdaki SLA verilerini analiz et. Hangi ticket'ların kritik risk altında olduğunu, "
                + "ortak sebepleri ve alınması gereken önlemleri Türkçe olarak 3-4 cümleyle açıkla.\n\n" + slaJson;
        return callGroq("Sen bir SLA ve operasyon risk analisti ve yönetim danışmanısın.", prompt);
    }

    public String suggestPriority(String title, String description) {
        if (apiKey == null || apiKey.isBlank()) return "MEDIUM";

        String prompt = "Aşağıdaki destek talebinin önceliğini belirle. "
                + "Sadece şu dört değerden birini yaz, başka hiçbir şey yazma: LOW, MEDIUM, HIGH, CRITICAL\n\n"
                + "Başlık: " + title + "\n"
                + "Açıklama: " + description;

        String result = callGroq("Sen bir destek sistemi öncelik sınıflandırıcısısın.", prompt).trim();
        if (result.contains("CRITICAL")) return "CRITICAL";
        if (result.contains("HIGH")) return "HIGH";
        if (result.contains("LOW")) return "LOW";
        return "MEDIUM";
    }

    public String suggestReply(Long ticketId) {
        if (apiKey == null || apiKey.isBlank()) {
            return "AI servisi yapılandırılmamış (GROQ_API_KEY eksik).";
        }

        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket bulunamadı: " + ticketId));

        List<Comment> comments = commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);

        StringBuilder sb = new StringBuilder();
        sb.append("Başlık: ").append(ticket.getTitle()).append("\n");
        sb.append("Açıklama: ").append(ticket.getDescription()).append("\n");
        sb.append("Durum: ").append(ticket.getStatus()).append("\n\n");

        if (!comments.isEmpty()) {
            sb.append("Konuşma geçmişi:\n");
            for (Comment c : comments) {
                String author = c.getUser() != null ? c.getUser().getUsername() : "Bilinmeyen";
                sb.append(c.isInternal() ? "[Dahili] " : "").append(author)
                        .append(": ").append(c.getMessage()).append("\n");
            }
        }

        String prompt = "Aşağıdaki destek talebine müşteriye yazılacak profesyonel ve yardımcı bir Türkçe yanıt taslağı oluştur. "
                + "Yanıt kısa, net ve çözüm odaklı olsun. Sadece yanıt metnini yaz, başka açıklama ekleme.\n\n" + sb;

        return callGroq("Sen deneyimli bir müşteri destek uzmanısın.", prompt);
    }

    public String chat(String userMessage, String conversationContext) {
        if (apiKey == null || apiKey.isBlank()) {
            return "AI servisi yapılandırılmamış (GROQ_API_KEY eksik).";
        }

        String system = "Sen KaizenDesk destek portalının yardımcı asistanısın. "
                + "Müşterilerin destek talebi oluşturmasına ve sorunlarını tanımlamasına yardımcı oluyorsun. "
                + "Türkçe konuş, kısa ve net yanıtlar ver. "
                + "Bilmediğin konularda 'Sizi bir destek uzmanına yönlendirebilirim' de.";

        String fullMessage = conversationContext != null && !conversationContext.isBlank()
                ? conversationContext + "\nKullanıcı: " + userMessage
                : userMessage;

        return callGroq(system, fullMessage);
    }

    @SuppressWarnings("unchecked")
    private String callGroq(String systemPrompt, String userMessage) {
        var body = Map.of(
                "model", MODEL,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userMessage)
                ),
                "max_tokens", 512
        );

        try {
            var response = restClient.post()
                    .uri(GROQ_URL)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            var choices = (List<Map<String, Object>>) response.get("choices");
            var message = (Map<String, Object>) choices.get(0).get("message");
            return (String) message.get("content");
        } catch (Exception e) {
            return "Yanıt alınamadı: " + e.getMessage();
        }
    }
}
