package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.CategorySummaryResponse;
import com.sau.kaizendesk.dto.IssueTypeSummaryResponse;
import com.sau.kaizendesk.dto.ProductSummaryResponse;
import com.sau.kaizendesk.service.CatalogService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping("/products")
    public ResponseEntity<List<ProductSummaryResponse>> listProducts() {
        return ResponseEntity.ok(catalogService.listActiveProducts());
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping("/products/{productId}/categories")
    public ResponseEntity<List<CategorySummaryResponse>> listCategories(@PathVariable Long productId) {
        return ResponseEntity.ok(catalogService.listCategoriesByProductId(productId));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping("/categories/{categoryId}/issue-types")
    public ResponseEntity<List<IssueTypeSummaryResponse>> listIssueTypes(@PathVariable Long categoryId) {
        return ResponseEntity.ok(catalogService.listActiveIssueTypesByCategoryId(categoryId));
    }
}
