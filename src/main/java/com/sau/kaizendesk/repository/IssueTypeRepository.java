package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.IssueType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IssueTypeRepository extends JpaRepository<IssueType, Long> {

    List<IssueType> findAllByIdIn(Collection<Long> ids);

    List<IssueType> findByCategory_IdAndActiveTrueOrderByNameAsc(Long categoryId);
}
