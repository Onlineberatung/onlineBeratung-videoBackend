local is_healthcheck_room = module:require "util".is_healthcheck_room
local jid_node = require "util.jid".node;
local timer = require "util.timer"

-- How many seconds the room waits for owner to come back before it destroys the room
local MIN = module:get_option_number("conference_timeout", 20)
local statistics_enabled = module:get_option_boolean('enable_statistics')
local TIMEOUT = MIN
local LOGLEVEL = "info";

module:log(LOGLEVEL, "[VI] Plugin mod_close_room loaded");

module:hook("muc-occupant-joined", function(event)
  module:log(LOGLEVEL, "[VI] Plugin mod_close_room muc-occupant-joined");

  local room, occupant = event.room, event.occupant;
  local affiliation = room:get_affiliation(occupant.bare_jid)

  if not room._data.presentedOwners then
    room._data.presentedOwners = {}
  end

  -- ToDo: maybe use "core.usermanager".is_admin for identification of instant admins like focus
  if affiliation == 'owner' and jid_node(occupant.bare_jid) ~= 'focus' then
    local presentedOwnerIndex = 0
    for key, value in pairs(room._data.presentedOwners) do
      if value == occupant.bare_jid then
        presentedOwnerIndex = key
      end
    end

    if presentedOwnerIndex == 0 then
        module:log(LOGLEVEL, "[VI] Moderator with affiliation %s joined %s", affiliation, room.jid);
        table.insert(room._data.presentedOwners, occupant.bare_jid);
    end
  end
end)

function tablelength(T)
  local count = 0
  for _ in pairs(T) do count = count + 1 end
  return count
end

module:hook("muc-occupant-left", function(event)
  module:log(LOGLEVEL, "[VI] Plugin mod_close_room muc-occupant-left");

  local room, occupant = event.room, event.occupant
  local affiliation = room:get_affiliation(occupant.bare_jid)

  if not room._data.presentedOwners then
    room._data.presentedOwners = {}
  end

  if tablelength(room._data.presentedOwners) > 0 then
    -- ToDo: maybe use "core.usermanager".is_admin for identification of instant admins like focus
    if affiliation == 'owner' and jid_node(occupant.bare_jid) ~= 'focus' then
      local presentedOwnerIndex = 0
      for key, value in pairs(room._data.presentedOwners) do
        module:log(LOGLEVEL, "[VI] Check %s == %s", value, occupant.bare_jid);
        if value == occupant.bare_jid then
          presentedOwnerIndex = key
        end
      end

      if presentedOwnerIndex ~= 0 then
        module:log(LOGLEVEL, "[VI] User with affiliation %s left %s", affiliation, room.jid);
        table.remove(room._data.presentedOwners, presentedOwnerIndex)
      end
    end

    if tablelength(room._data.presentedOwners) <= 0 then
      if is_healthcheck_room(room.jid) then
        return
      end

      module:log(LOGLEVEL, "[VI] No Moderators left in room %s. Room will be closed in %s secs.", room.jid, TIMEOUT);

      timer.add_task(TIMEOUT, function()
        if is_healthcheck_room(room.jid) then
          return
        end

        -- if no owner is presented kick all others
        if tablelength(room._data.presentedOwners) == 0 then
          -- destroy and clear the room
          room:destroy();
          room:clear();
          module:log(LOGLEVEL, "[VI] Room %s terminated!", room.jid);

          if statistics_enabled then
            local utctimestamp = os.date("!%Y-%m-%dT%XZ");
            fireStatisticsEvent(utctimestamp, jid_node(room.jid));
          end
        else
          -- If owner is back (reload, rejoin) keep up the room
          module:log(LOGLEVEL, "[VI] A Moderator has rejoined the room %s. Room will not be terminated.", room.jid);
        end
      end)
    end
  end
end)

function fireStatisticsEvent(timestamp, room)
  if room ~= nil then
    module:log(LOGLEVEL, "[VI] Fire statistics for room %s.", room);
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
    module:log(LOGLEVEL, "[VI] Fire statistics failed because of missing room.");
  end
end