package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Comment;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.dto.CommentResponse;
import com.sau.kaizendesk.dto.CreateCommentRequest;
import com.sau.kaizendesk.repository.CommentRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CommentService {

    private final CommentRepository commentRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final TicketAccessService ticketAccessService;
    private final TicketNotificationService ticketNotificationService;
    private final ActivityLogService activityLogService;

    public CommentService(
            CommentRepository commentRepository,
            TicketRepository ticketRepository,
            UserRepository userRepository,
            TicketAccessService ticketAccessService,
            TicketNotificationService ticketNotificationService,
            ActivityLogService activityLogService
    ) {
        this.commentRepository = commentRepository;
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.ticketAccessService = ticketAccessService;
        this.ticketNotificationService = ticketNotificationService;
        this.activityLogService = activityLogService;
    }

    @Transactional
    public CommentResponse addComment(
            Long ticketId,
            CreateCommentRequest request,
            String username,
            boolean isCustomer
    ) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));
        ticketAccessService.requireAccessIfCustomer(ticket, username, isCustomer);

        User author = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

        if (request.isInternal() && isCustomer) {
            throw new IllegalArgumentException("Müşteriler dahili not oluşturamaz");
        }

        Comment comment = new Comment();
        comment.setTicket(ticket);
        comment.setUser(author);
        comment.setMessage(request.getMessage());
        comment.setType(request.isInternal() ? "INTERNAL" : "EXTERNAL");

        Comment savedComment = commentRepository.save(comment);

        // Müşteri external yorum yaptıysa agent'a bildir
        if (isCustomer && !request.isInternal()) {
            try {
                ticketNotificationService.onCustomerCommented(ticket, author);
            } catch (Exception ex) {
                // bildirim hatası yorum kaydını engellemesin
            }
        }

        // @bahsetme — yorumda @kullanıcı geçenlere bildirim gönder
        notifyMentions(request.getMessage(), ticket, author);

        String eventType = request.isInternal() ? "INTERNAL_NOTE" : "COMMENT_ADDED";
        activityLogService.log(eventType, username, ticket, null);

        return mapToResponse(savedComment);
    }

    private static final java.util.regex.Pattern MENTION_PATTERN =
            java.util.regex.Pattern.compile("@([A-Za-z0-9._-]+)");

    private void notifyMentions(String message, Ticket ticket, User author) {
        if (message == null || message.isBlank()) {
            return;
        }
        java.util.regex.Matcher m = MENTION_PATTERN.matcher(message);
        java.util.Set<String> seen = new java.util.HashSet<>();
        while (m.find()) {
            String uname = m.group(1);
            if (!seen.add(uname.toLowerCase())) {
                continue;
            }
            userRepository.findByUsername(uname).ifPresent(u -> {
                if (!u.getUsername().equals(author.getUsername())) {
                    try {
                        ticketNotificationService.onMention(ticket, u, author);
                    } catch (Exception ignored) {
                        // bildirim hatası yorum kaydını engellemesin
                    }
                }
            });
        }
    }

    public List<CommentResponse> getComments(Long ticketId, String username, boolean isCustomer) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));
        ticketAccessService.requireAccessIfCustomer(ticket, username, isCustomer);

        List<Comment> comments = commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);

        return comments.stream()
                .filter(c -> !isCustomer || !c.isInternal())
                .map(this::mapToResponse)
                .toList();
    }

    private CommentResponse mapToResponse(Comment comment) {
        CommentResponse response = new CommentResponse();
        response.setId(comment.getId());
        response.setTicketId(comment.getTicket().getId());
        User author = comment.getUser();
        if (author != null) {
            response.setAuthorName(author.getName());
        }
        response.setMessage(comment.getMessage());
        response.setInternal(comment.isInternal());
        response.setCreatedAt(comment.getCreatedAt());
        return response;
    }
}

