package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Category;
import com.sau.kaizendesk.domain.entity.IssueType;
import com.sau.kaizendesk.domain.entity.Product;
import com.sau.kaizendesk.dto.CategorySummaryResponse;
import com.sau.kaizendesk.dto.IssueTypeSummaryResponse;
import com.sau.kaizendesk.dto.ProductSummaryResponse;
import com.sau.kaizendesk.repository.CategoryRepository;
import com.sau.kaizendesk.repository.IssueTypeRepository;
import com.sau.kaizendesk.repository.ProductRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IssueTypeRepository issueTypeRepository;

    public CatalogService(
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            IssueTypeRepository issueTypeRepository
    ) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.issueTypeRepository = issueTypeRepository;
    }

    public List<ProductSummaryResponse> listActiveProducts() {
        return productRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(this::toProductSummary)
                .toList();
    }

    public List<CategorySummaryResponse> listCategoriesByProductId(Long productId) {
        productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        return categoryRepository.findByProduct_IdOrderByNameAsc(productId).stream()
                .map(this::toCategorySummary)
                .toList();
    }

    public List<IssueTypeSummaryResponse> listActiveIssueTypesByCategoryId(Long categoryId) {
        categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Category not found: " + categoryId));
        return issueTypeRepository.findByCategory_IdAndActiveTrueOrderByNameAsc(categoryId).stream()
                .map(this::toIssueTypeSummary)
                .toList();
    }

    private ProductSummaryResponse toProductSummary(Product p) {
        ProductSummaryResponse r = new ProductSummaryResponse();
        r.setId(p.getId());
        r.setName(p.getName());
        return r;
    }

    private CategorySummaryResponse toCategorySummary(Category c) {
        CategorySummaryResponse r = new CategorySummaryResponse();
        r.setId(c.getId());
        r.setName(c.getName());
        r.setProductId(c.getProduct() != null ? c.getProduct().getId() : null);
        return r;
    }

    private IssueTypeSummaryResponse toIssueTypeSummary(IssueType t) {
        IssueTypeSummaryResponse r = new IssueTypeSummaryResponse();
        r.setId(t.getId());
        r.setName(t.getName());
        r.setRequiresDescription(t.isRequiresDescription());
        r.setCategoryId(t.getCategory() != null ? t.getCategory().getId() : null);
        return r;
    }
}
