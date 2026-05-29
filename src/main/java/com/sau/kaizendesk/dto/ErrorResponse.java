package com.sau.kaizendesk.dto;

import java.time.Instant;
import java.util.Map;

/**
 * Tek tip API hata gövdesi (analiz: standart response formatı).
 */
public class ErrorResponse {

	private Instant timestamp;
	private int status;
	private String error;
	private String message;
	private Map<String, String> fieldErrors;

	public static ErrorResponse of(int status, String error, String message) {
		ErrorResponse r = new ErrorResponse();
		r.setTimestamp(Instant.now());
		r.setStatus(status);
		r.setError(error);
		r.setMessage(message);
		return r;
	}

	public Instant getTimestamp() {
		return timestamp;
	}

	public void setTimestamp(Instant timestamp) {
		this.timestamp = timestamp;
	}

	public int getStatus() {
		return status;
	}

	public void setStatus(int status) {
		this.status = status;
	}

	public String getError() {
		return error;
	}

	public void setError(String error) {
		this.error = error;
	}

	public String getMessage() {
		return message;
	}

	public void setMessage(String message) {
		this.message = message;
	}

	public Map<String, String> getFieldErrors() {
		return fieldErrors;
	}

	public void setFieldErrors(Map<String, String> fieldErrors) {
		this.fieldErrors = fieldErrors;
	}
}
