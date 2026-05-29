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

/**
 * Google Gemini API ile yapay zeka özelliklerini sağlayan servis.
 *
 * API anahtarı GEMINI_API_KEY ortam değişkeninden (veya .env dosyasından) okunur.
 * Anahtar eksikse tüm metodlar hata üretmek yerine açıklayıcı bir mesaj döner.
 *
 * Desteklenen özellikler:
 *   summarizeTicket     → Bilet + yorumları Türkçe özetler (3-5 cümle)
 *   suggestPriority     → Başlık ve açıklamaya göre LOW/MEDIUM/HIGH/CRITICAL önerir
 *   suggestReply        → Müşteriye yazılacak yanıt taslağı oluşturur
 *   chat                → Destek asistanı sohbet botu (konuşma bağlamıyla)
 *   findSimilarTickets  → Benzer biletleri JSON formatında listeler (max 5)
 *   analyzeDashboard    → Dashboard istatistiklerini analiz eder
 *   analyzeTeam         → Ekip performansını değerlendirir
 *   analyzeSla          → SLA verilerini yorumlar
 */
@Service
@Transactional(readOnly = true)
public class AiService {

    /** Gemini 2.5 Flash Lite modeli — hız/maliyet dengesi için tercih edilmiştir. */
    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

    private final TicketRepository ticketRepository;
    private final CommentRepository commentRepository;
    private final RestClient restClient;

    @Value("${gemini.api-key:}")
    private String apiKey;

    public AiService(TicketRepository ticketRepository, CommentRepository commentRepository) {
        this.ticketRepository = ticketRepository;
        this.commentRepository = commentRepository;
        this.restClient = RestClient.create();
    }

    public String summarizeTicket(Long ticketId) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış (GEMINI_API_KEY eksik).";

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
                sb.append(c.isInternal() ? "[Dahili] " : "").append(author)
                        .append(": ").append(c.getMessage()).append("\n");
            }
        }

        String prompt = "Aşağıdaki destek talebini Türkçe olarak 3-5 cümleyle özetle. "
                + "Sorunun ne olduğunu, şu anki durumu ve varsa çözümü belirt. "
                + "Teknik olmayan, sade bir dille yaz.\n\n" + sb;

        return callGemini(prompt);
    }

    public String suggestPriority(String title, String description) {
        if (apiKey == null || apiKey.isBlank()) return "MEDIUM";

        String prompt = "Aşağıdaki destek talebinin önceliğini belirle. "
                + "Sadece şu dört değerden birini yaz, başka hiçbir şey yazma: LOW, MEDIUM, HIGH, CRITICAL\n\n"
                + "Başlık: " + title + "\n"
                + "Açıklama: " + description;

        String result = callGemini(prompt).trim();
        if (result.contains("CRITICAL")) return "CRITICAL";
        if (result.contains("HIGH")) return "HIGH";
        if (result.contains("LOW")) return "LOW";
        return "MEDIUM";
    }

    public String suggestReply(Long ticketId) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış (GEMINI_API_KEY eksik).";

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
                + "Yanıt kısa, net ve çözüm odaklı olsun. Sadece yanıt metnini yaz.\n\n" + sb;

        return callGemini(prompt);
    }

    public String chat(String userMessage, String conversationContext) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış (GEMINI_API_KEY eksik).";

        String system = "Sen KaizenDesk destek portalının yardımcı asistanısın. "
                + "Müşterilerin destek talebi oluşturmasına ve sorunlarını tanımlamasına yardımcı oluyorsun. "
                + "Türkçe konuş, kısa ve net yanıtlar ver. "
                + "Bilmediğin konularda 'Sizi bir destek uzmanına yönlendirebilirim' de.";

        String fullMessage = conversationContext != null && !conversationContext.isBlank()
                ? conversationContext + "\nKullanıcı: " + userMessage
                : userMessage;

        return callGemini(system + "\n\n" + fullMessage);
    }

    public String findSimilarTickets(Long ticketId) {
        if (apiKey == null || apiKey.isBlank()) return "[]";

        Ticket target = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket bulunamadı: " + ticketId));

        List<Ticket> others = ticketRepository.findAll().stream()
                .filter(t -> !t.getId().equals(ticketId))
                .filter(t -> t.getTitle() != null)
                .limit(80)
                .toList();

        if (others.isEmpty()) return "[]";

        StringBuilder sb = new StringBuilder();
        sb.append("Hedef talep:\n");
        sb.append("ID: ").append(target.getId()).append(", Başlık: ").append(target.getTitle());
        if (target.getDescription() != null) sb.append(", Açıklama: ").append(target.getDescription(), 0, Math.min(200, target.getDescription().length()));
        sb.append("\n\nDiğer talepler listesi:\n");
        for (Ticket t : others) {
            sb.append("ID:").append(t.getId()).append(" | ").append(t.getTitle());
            if (t.getDescription() != null) sb.append(" | ").append(t.getDescription(), 0, Math.min(100, t.getDescription().length()));
            sb.append("\n");
        }

        String prompt = "Aşağıdaki hedef talebe benzer olan talepleri listeden bul. "
                + "Benzerlik kriterleri: aynı sorun türü, benzer anahtar kelimeler, aynı sistem/ürün. "
                + "En fazla 5 benzer talep döndür. "
                + "SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma:\n"
                + "[{\"id\":123,\"reason\":\"Kısa sebep\"},{\"id\":456,\"reason\":\"Kısa sebep\"}]\n\n"
                + sb;

        return callGemini(prompt);
    }

    public String analyzeDashboard(String statsJson) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış.";
        String prompt = "Aşağıdaki destek merkezi istatistiklerini analiz et ve Türkçe olarak 3-4 cümlelik kısa bir yönetici özeti yaz. "
                + "Dikkat çeken noktalara, olumlu/olumsuz trendlere değin. Sade ve net ol.\n\n" + statsJson;
        return callGemini(prompt);
    }

    public String analyzeTeam(String teamJson) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış.";
        String prompt = "Aşağıdaki destek ekibi performans verilerini analiz et ve Türkçe olarak 3-4 cümlelik bir özet yaz. "
                + "Öne çıkan ajanları, iş yükü dağılımını ve önerileri belirt.\n\n" + teamJson;
        return callGemini(prompt);
    }

    public String analyzeSla(String slaJson) {
        if (apiKey == null || apiKey.isBlank()) return "AI servisi yapılandırılmamış.";
        String prompt = "Aşağıdaki SLA verilerini analiz et. Hangi ticket'ların kritik risk altında olduğunu, "
                + "ortak sebepleri ve alınması gereken önlemleri Türkçe olarak 3-4 cümleyle açıkla.\n\n" + slaJson;
        return callGemini(prompt);
    }

    /**
     * Gemini API'ye HTTP POST isteği gönderir ve metin yanıtını döner.
     * Gemini yanıt yapısı: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
     * Herhangi bir hata durumunda exception fırlatmak yerine kullanıcı dostu mesaj döner.
     */
    @SuppressWarnings("unchecked")
    private String callGemini(String prompt) {
        var body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                )
        );

        try {
            var response = restClient.post()
                    .uri(GEMINI_URL + "?key=" + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            // Yanıt JSON ağacından metin içeriğini çıkar
            var candidates = (List<Map<String, Object>>) response.get("candidates");
            var content = (Map<String, Object>) candidates.get(0).get("content");
            var parts = (List<Map<String, Object>>) content.get("parts");
            return (String) parts.get(0).get("text");
        } catch (Exception e) {
            return "Yanıt alınamadı: " + e.getMessage();
        }
    }
}
