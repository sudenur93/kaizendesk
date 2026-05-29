function truncate(tag, timestamp, record)
  local max_len = 2000
  -- JSON parse sonrası mesaj "message" alanında; eski format için "log" da kontrol edilir
  for _, field in ipairs({ "message", "log" }) do
    local val = record[field]
    if val ~= nil and string.len(val) > max_len then
      record[field] = string.sub(val, 1, max_len)
    end
  end

  return 1, timestamp, record
end

