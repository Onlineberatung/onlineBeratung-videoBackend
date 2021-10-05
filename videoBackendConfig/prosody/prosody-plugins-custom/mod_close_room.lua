module:hook("muc-occupant-left", function(event)
  local barejid = event.occupant.bare_jid;
  local role =  event.room:get_affiliation(barejid);
  if role == "owner" then
    local room = event.room:get_name();
    event.room:clear();
    local utctimestamp = os.date("!%Y-%m-%dT%XZ");
    fireStatisticsEvent(utctimestamp, room);
  end
end)

function fireStatisticsEvent(timestamp, room)

  prosody.unlock_globals();
  local http = require("socket.http");
  local mime = require("mime");

  local message = [[ {\"eventType\":\"STOP_VIDEO_CALL\",\"videoCallUuid\":\"]] .. room .. [[\",\"timestamp\":\"]] .. timestamp .. [[\"}]];
  local path = "http://45.12.48.12:15672/api/exchanges/%2F/statistics.topic/publish";
  local payload = [[ {"properties":{}, "routing_key":"STOP_VIDEO_CALL", "payload":"]] .. message .. [[", "payload_encoding":"string"} ]];
  local response_body = { }

  local res, httpcode, response_headers, status = http.request
  {
    url = path,
    method = "POST",
    headers =
    {
      ["Authorization"] = "Basic " .. (mime.b64("statistics:XmbV2B3U!PztJuW")),
      ["Content-Type"] = "application/json",
      ["Content-Length"] = payload:len()
    },
    source = ltn12.source.string(payload),
    sink = ltn12.sink.table(response_body)
  }

  if httpcode > 200 then
    module:log("error", "Could not fire statistics event for room %s: %s", room, status);
    module:log("error", "Statistics event payload: %s", payload);
  end

end

