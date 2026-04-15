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

    public CommentService(
            CommentRepository commentRepository,
            TicketRepository ticketRepository,
            UserRepository userRepository,
            TicketAccessService ticketAccessService
    ) {
        this.commentRepository = commentRepository;
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.ticketAccessService = ticketAccessService;
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
        return mapToResponse(savedComment);
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

