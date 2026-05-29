package com.sau.kaizendesk.dto;

import com.sau.kaizendesk.domain.enums.TicketPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public class CreateTicketRequest {

    @NotBlank
    @Size(max = 255)
    private String title;

    @NotBlank
    @Size(max = 2000)
    private String description;

    @NotNull
    private TicketPriority priority;

    @NotNull
    private Long productId;

    @NotNull
    private Long categoryId;

    @NotEmpty
    private List<Long> issueTypeIds;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TicketPriority getPriority() {
        return priority;
    }

    public void setPriority(TicketPriority priority) {
        this.priority = priority;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public List<Long> getIssueTypeIds() {
        return issueTypeIds;
    }

    public void setIssueTypeIds(List<Long> issueTypeIds) {
        this.issueTypeIds = issueTypeIds;
    }
}
