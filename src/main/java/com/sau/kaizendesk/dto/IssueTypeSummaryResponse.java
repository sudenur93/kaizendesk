package com.sau.kaizendesk.dto;

public class IssueTypeSummaryResponse {

    private Long id;
    private Long categoryId;
    private String name;
    private boolean requiresDescription;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isRequiresDescription() {
        return requiresDescription;
    }

    public void setRequiresDescription(boolean requiresDescription) {
        this.requiresDescription = requiresDescription;
    }
}
