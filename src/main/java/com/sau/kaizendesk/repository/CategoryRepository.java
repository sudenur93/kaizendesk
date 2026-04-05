package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.Category;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByProduct_IdOrderByNameAsc(Long productId);
}
