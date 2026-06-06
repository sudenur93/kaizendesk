package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.service.UserService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/security")
public class PublicSecurityController {

    private final UserService userService;

    public PublicSecurityController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login-failed")
    public ResponseEntity<Void> notifyLoginFailed(@RequestBody Map<String, String> body) {
        String usernameOrEmail = body.getOrDefault("usernameOrEmail", "");
        userService.notifyLoginFailures(usernameOrEmail);
        return ResponseEntity.accepted().build();
    }
}
