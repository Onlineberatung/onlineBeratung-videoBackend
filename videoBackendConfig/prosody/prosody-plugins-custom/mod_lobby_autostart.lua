-- This module auto-activates lobby for all rooms.
--
-- IMPORTANT: do not use this unless you have some mechanism for moderators to bypass the lobby, otherwise everybody
--            stops at the lobby with nobody to admit them.
--
-- This module should be added to the main virtual host domain.
-- It assumes you have properly configured the muc_lobby_rooms module and lobby muc component.
--
--

local LOGLEVEL = "info";

local util = module:require "util";
local is_healthcheck_room = util.is_healthcheck_room;

module:log(LOGLEVEL, "[VI] Plugin mod_lobby_autostart loaded");

module:hook("muc-room-pre-create", function(event)
    module:log(LOGLEVEL, "[VI] Hook mod_lobby_autostart muc-room-pre-create");

    local room = event.room;

    if is_healthcheck_room(room.jid) then
        return;
    end

    module:log(LOGLEVEL, "[VI] Create lobby room");
    prosody.events.fire_event("create-persistent-lobby-room", { room = room; });
end, -2);