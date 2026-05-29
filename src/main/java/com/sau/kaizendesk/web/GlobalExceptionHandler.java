package com.sau.kaizendesk.web;

import com.sau.kaizendesk.dto.ErrorResponse;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Uygulama genelinde tüm controller hatalarını standart JSON formatına dönüştüren merkezi hata yöneticisi.
 *
 * Yakalanan exception türleri ve HTTP yanıtları:
 *   MethodArgumentNotValidException  → 400 + alan bazlı hata mesajları (fieldErrors)
 *   ResponseStatusException          → HTTP kodu korunur
 *   AccessDeniedException            → 403 Forbidden
 *   IllegalStateException            → 500 Internal Server Error
 *   IllegalArgumentException         → 404 Not Found (mesajda "not found/bulunamadı" varsa) veya 400 Bad Request
 *   Exception (diğer tüm hatalar)    → 500 Internal Server Error
 *
 * ResponseEntityExceptionHandler uzatılır: Spring MVC'nin kendi validation exception'larının
 * /error yolu yerine bu sınıf tarafından formatlanmasını sağlar.
 * @Order(HIGHEST_PRECEDENCE) ile diğer handler'lardan önce çalışır.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(
			MethodArgumentNotValidException ex,
			HttpHeaders headers,
			HttpStatusCode status,
			WebRequest request
	) {
		Map<String, String> fieldErrors = new HashMap<>();
		ex.getBindingResult().getFieldErrors()
				.forEach(fe -> fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
		ErrorResponse body = ErrorResponse.of(
				HttpStatus.BAD_REQUEST.value(),
				"Validation Failed",
				"İstek doğrulaması başarısız"
		);
		body.setFieldErrors(fieldErrors);
		return new ResponseEntity<>(body, headers, HttpStatus.BAD_REQUEST);
	}

	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
		HttpStatus http = HttpStatus.valueOf(ex.getStatusCode().value());
		ErrorResponse body = ErrorResponse.of(
				http.value(),
				http.getReasonPhrase(),
				ex.getReason() != null ? ex.getReason() : http.getReasonPhrase()
		);
		return ResponseEntity.status(http).body(body);
	}

	@ExceptionHandler(AccessDeniedException.class)
	public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
		ErrorResponse body = ErrorResponse.of(
				HttpStatus.FORBIDDEN.value(),
				"Forbidden",
				ex.getMessage() != null ? ex.getMessage() : "Bu kaynağa erişim yetkiniz yok"
		);
		return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
	}

	@ExceptionHandler(IllegalStateException.class)
	public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex) {
		String msg = ex.getMessage() != null ? ex.getMessage() : "İşlem tamamlanamadı";
		ErrorResponse body = ErrorResponse.of(
				HttpStatus.INTERNAL_SERVER_ERROR.value(),
				HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
				msg
		);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
	}

	/**
	 * IllegalArgumentException: mesaj içeriğine göre 404 veya 400 döner.
	 * Servis katmanında "not found" veya "bulunamadı" içeren mesajlar kaynak bulunamadı olarak işaretlenir.
	 */
	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
		String msg = ex.getMessage() != null ? ex.getMessage() : "Geçersiz istek";
		boolean notFound = msg.contains("not found") || msg.contains("Not found") || msg.contains("bulunamadı");
		HttpStatus status = notFound ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
		ErrorResponse body = ErrorResponse.of(
				status.value(),
				status.getReasonPhrase(),
				msg
		);
		return ResponseEntity.status(status).body(body);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
		ErrorResponse body = ErrorResponse.of(
				HttpStatus.INTERNAL_SERVER_ERROR.value(),
				"Internal Server Error",
				"Beklenmeyen bir hata oluştu"
		);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
	}
}
