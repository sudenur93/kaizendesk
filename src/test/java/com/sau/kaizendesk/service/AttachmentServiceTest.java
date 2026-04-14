package com.sau.kaizendesk.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sau.kaizendesk.config.AttachmentStorageProperties;
import com.sau.kaizendesk.domain.entity.Attachment;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.repository.AttachmentRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class AttachmentServiceTest {

    @TempDir Path tempDir;

    @Mock
    TicketRepository ticketRepository;
    @Mock
    TicketAccessService ticketAccessService;
    @Mock
    AttachmentRepository attachmentRepository;
    @Mock
    UserRepository userRepository;

    AttachmentFileStorage attachmentFileStorage;
    AttachmentStorageProperties properties;
    AttachmentService attachmentService;

    @BeforeEach
    void setUp() throws Exception {
        properties = new AttachmentStorageProperties();
        properties.setDirectory(tempDir.toString());
        properties.setMaxFileSizeBytes(1024 * 1024);
        attachmentFileStorage = new AttachmentFileStorage(properties);
        attachmentFileStorage.afterPropertiesSet();
        attachmentService =
                new AttachmentService(
                        ticketRepository,
                        ticketAccessService,
                        attachmentRepository,
                        userRepository,
                        attachmentFileStorage,
                        properties);
    }

    @Test
    void upload_storesFileAndRow() throws IOException {
        Ticket ticket = new Ticket();
        ticket.setId(3L);
        User u = new User();
        u.setId(9L);
        u.setUsername("alice");
        when(ticketRepository.findById(3L)).thenReturn(Optional.of(ticket));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(u));
        when(attachmentRepository.save(any(Attachment.class)))
                .thenAnswer(
                        inv -> {
                            Attachment a = inv.getArgument(0);
                            a.setId(100L);
                            return a;
                        });

        var file = new MockMultipartFile("file", "note.txt", "text/plain", "hello".getBytes());
        var r = attachmentService.upload(3L, file, "alice", false);
        assertThat(r.getId()).isEqualTo(100L);
        assertThat(r.getOriginalFileName()).isEqualTo("note.txt");

        ArgumentCaptor<Attachment> cap = ArgumentCaptor.forClass(Attachment.class);
        verify(attachmentRepository).save(cap.capture());
        String stored = cap.getValue().getStoredFileName();
        assertThat(stored).endsWith(".txt");
        Path onDisk = tempDir.resolve("3").resolve(stored);
        assertThat(Files.readString(onDisk)).isEqualTo("hello");
    }

    @Test
    void download_wrongTicket_returns404() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(new Ticket()));
        when(attachmentRepository.findByIdAndTicket_Id(5L, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> attachmentService.download(1L, 5L, "a", false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Attachment not found");
    }

    @Test
    void getAttachments_returnsList() {
        Ticket ticket = new Ticket();
        ticket.setId(2L);
        when(ticketRepository.findById(2L)).thenReturn(Optional.of(ticket));
        Attachment a = new Attachment();
        a.setId(1L);
        a.setTicket(ticket);
        a.setOriginalFileName("x.pdf");
        a.setStoredFileName("s.pdf");
        a.setFileSizeBytes(10L);
        User u = new User();
        u.setId(8L);
        a.setUploadedBy(u);
        when(attachmentRepository.findByTicket_IdOrderByCreatedAtDesc(2L)).thenReturn(List.of(a));

        var list = attachmentService.getAttachments(2L, "bob", false);
        assertThat(list).hasSize(1);
        assertThat(list.getFirst().getOriginalFileName()).isEqualTo("x.pdf");
    }
}
