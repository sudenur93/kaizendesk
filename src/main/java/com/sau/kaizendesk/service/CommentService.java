package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Comment;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.dto.CommentResponse;
import com.sau.kaizendesk.dto.CreateCommentRequest;
import com.sau.kaizendesk.repository.CommentRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CommentService {

    private final CommentRepository commentRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;

    public CommentService(
            CommentRepository commentRepository,
            TicketRepository ticketRepository,
            UserRepository userRepository
    ) {
        this.commentRepository = commentRepository;
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public CommentResponse addComment(Long ticketId, CreateCommentRequest request) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));

        User author = userRepository.findById(1L)
                .orElseThrow(() -> new IllegalArgumentException("User not found: 1"));

        Comment comment = new Comment();
        comment.setTicket(ticket);
        comment.setUser(author);
        comment.setMessage(request.getMessage());

        Comment savedComment = commentRepository.save(comment);

        CommentResponse response = new CommentResponse();
        response.setId(savedComment.getId());
        response.setTicketId(savedComment.getTicket().getId());
        response.setAuthorName(author.getName());
        response.setMessage(savedComment.getMessage());
        response.setCreatedAt(savedComment.getCreatedAt());

        return response;
    }

    public List<CommentResponse> getComments(Long ticketId) {
        ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));

        List<Comment> comments = commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
        List<CommentResponse> responses = new ArrayList<>();

        for (Comment comment : comments) {
            CommentResponse response = new CommentResponse();
            response.setId(comment.getId());
            response.setTicketId(comment.getTicket().getId());

            User user = comment.getUser();
            if (user != null) {
                response.setAuthorName(user.getName());
            }

            response.setMessage(comment.getMessage());
            response.setCreatedAt(comment.getCreatedAt());

            responses.add(response);
        }

        return responses;
    }
}

