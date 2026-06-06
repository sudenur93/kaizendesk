package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.UserRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    List<User> findByRole(UserRole role);
}
