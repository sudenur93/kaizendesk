package com.sau.kaizendesk;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost/.well-known/jwks.json"
})
class KaizenDeskApplicationTests {

	@Test
	void contextLoads() {
	}

}
