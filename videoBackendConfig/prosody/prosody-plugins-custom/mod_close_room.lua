local is_healthcheck_room = module:require "util".is_healthcheck_room
local jid_node = require "util.jid".node;
local timer = require "util.timer"

-- How many seconds the room waits for owner to come back before it destroys the room
local MIN = module:get_option_number("conference_timeout", 20)
local statistics_enabled = module:get_option_boolean('enable_statistics')
local TIMEOUT = MIN

module:log('info', "[VI] Plugin mod_close_room loaded");

module:hook("muc-occupant-left", function(event)
  local room = event.room
  local mods = room:each_affiliation("owner");
  local leaver = event.occupant.bare_jid;
  local a = 0;
  local b = 0;

  -- count owner exepting leaver
  for mod in mods do
    a = a + 1;
    if mod == leaver then
      -- set leaver to outcast if he was under owners
      room:set_affiliation(true, leaver, "outcast");
      a = a - 1;
    end
  end

  if a == 1 then
    -- disable room temporary so owner could join again
    room:set_members_only(false);

    if is_healthcheck_room(room.jid) then
      return
    end

    module:log('info', "[VI] Moderator left room %s. Room will be closed in %s secs.", room.jid, TIMEOUT);

    timer.add_task(TIMEOUT, function()
      if is_healthcheck_room(room.jid) then
        return
      end

      -- count owner
      for mod in mods do
        b = b + 1;
      end

      -- if only single owner presented (focus@jitsi.meet) kick all others
      if b == 1 then
        -- destroy and clear the room
        room:destroy();
        room:clear();
        module:log('info', "[VI] Room %s terminated!", room.jid);

        if statistics_enabled then
          local utctimestamp = os.date("!%Y-%m-%dT%XZ");
          fireStatisticsEvent(utctimestamp, jid_node(room.jid));
        end
      else
        -- If owner is back (reload, rejoin) keep up the room
        module:log('info', "[VI] Moderator has rejoined room %s. Room will not be terminated.", room.jid);
      end
    end)
  end
end)

function fireStatisticsEvent(timestamp, room)
  if room ~= nil then
    module:log('info', "[VI] Fire statistics for room %s.", room);
    prosody.unlock_globals();

    local json = require('cjson');
    local req = require("net.http");
    local mime = require("mime");

    local rabbit_url = module:get_option_string('rabbit_url');
    local rabbit_username = module:get_option_string('rabbit_username');
    local rabbit_password = module:get_option_string('rabbit_password');
    local rabbit_user = rabbit_username .. [[:]] .. rabbit_password;

    local jsonRequest = json.encode({
        ["properties"]={},
        ["routing_key"]="STOP_VIDEO_CALL",
        ["payload"]=json.encode({
            ["eventType"]="STOP_VIDEO_CALL",
            ["videoCallUuid"]=room,
            ["timestamp"]=timestamp
        }),
        ["payload_encoding"]="string"
    });

    module:log("error", "[VI] Statistics event json (len: %s): %s", jsonRequest:len(), jsonRequest);

    req.request( rabbit_url, {
      method = "POST",
      body = jsonRequest,
      headers = {
        ["Authorization"] = "Basic " .. (mime.b64(rabbit_user)),
        ["Content-Type"] = "application/json",
        ["Content-Length"] = jsonRequest:len()
      }},
      function(res, httpcode)
        if httpcode > 200 then
          module:log("error", "[VI] Could not fire statistics event for room %s: %s", room, httpcode);
          module:log("error", "[VI] Statistics event payload: %s", jsonRequest);
        else
            module:log("info", "[VI] Statistics fire succeed!");
        end
      end
    )
  else
    module:log('info', "[VI] Fire statistics failed because of missing room.");
  end
end
