function truncate(tag, timestamp, record)
  local log = record["log"]
  if log ~= nil then
    local max_len = 200
    if string.len(log) > max_len then
      record["log"] = string.sub(log, 1, max_len)
    end
  end

  return 1, timestamp, record
end

