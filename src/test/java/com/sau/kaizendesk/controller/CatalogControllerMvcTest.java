package com.sau.kaizendesk.controller;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sau.kaizendesk.config.SecurityConfig;
import com.sau.kaizendesk.dto.ProductSummaryResponse;
import com.sau.kaizendesk.service.CatalogService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = CatalogController.class)
@Import(SecurityConfig.class)
class CatalogControllerMvcTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	CatalogService catalogService;

	@MockitoBean
	JwtDecoder jwtDecoder;

	@Test
	void listProducts_withoutAuth_returns401() throws Exception {
		mockMvc.perform(get("/api/v1/products"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void listProducts_asCustomer_returns200() throws Exception {
		ProductSummaryResponse p = new ProductSummaryResponse();
		p.setId(1L);
		p.setName("Test");
		when(catalogService.listActiveProducts()).thenReturn(List.of(p));

		mockMvc.perform(get("/api/v1/products")
						.with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(1))
				.andExpect(jsonPath("$[0].name").value("Test"));
	}
}
