module:hook("muc-occupant-left", function(event)
  local barejid = event.occupant.bare_jid;
  local role =  event.room:get_affiliation(barejid);
  local statistics_enabled = module:get_option_boolean('enable_statistics');
  if role == "owner" then
    local room = event.room:get_name();
    event.room:destroy();
    event.room:clear();
    if statistics_enabled then
      local utctimestamp = os.date("!%Y-%m-%dT%XZ");
      fireStatisticsEvent(utctimestamp, room);
    end
  end
end)

function fireStatisticsEvent(timestamp, room)

  prosody.unlock_globals();
  local http = require("socket.http");
  local mime = require("mime");

  local rabbit_url = module:get_option_string('rabbit_url');
  local rabbit_username = module:get_option_string('rabbit_username');
  local rabbit_password = module:get_option_string('rabbit_password');
  local rabbit_user = rabbit_username .. [[:]] .. rabbit_password;
  local message = [[ {\"eventType\":\"STOP_VIDEO_CALL\",\"videoCallUuid\":\"]] .. room .. [[\",\"timestamp\":\"]] .. timestamp .. [[\"}]];
  local payload = [[ {"properties":{}, "routing_key":"STOP_VIDEO_CALL", "payload":"]] .. message .. [[", "payload_encoding":"string"} ]];
  local response_body = { }

  local res, httpcode, response_headers, status = http.request
  {
    url = rabbit_url,
    method = "POST",
    headers =
    {
      ["Authorization"] = "Basic " .. (mime.b64(rabbit_user)),
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
