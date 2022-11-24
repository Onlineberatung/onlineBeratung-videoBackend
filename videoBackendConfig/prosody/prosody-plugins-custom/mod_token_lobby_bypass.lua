--- Plugin to allow users to bypass lobby based on attribute in JWT.
---
--- This module should be added to the main muc component.
---

local LOGLEVEL = "info";

local muc_util = module:require "muc/util";
local valid_affiliations = muc_util.valid_affiliations;
local is_healthcheck_room = module:require "util".is_healthcheck_room;

module:log(LOGLEVEL, "[VI] Plugin mod_token_lobby_bypass loaded");

module:hook("muc-occupant-pre-join", function (event)
    module:log(LOGLEVEL, "[VI] Hook mod_token_lobby_bypass muc-occupant-pre-join");

    local room, occupant, stanza = event.room, event.occupant, event.stanza;

    if is_healthcheck_room(room.jid) then
        return;
    end

    if room._data.lobbyroom == nil then
        module:log(LOGLEVEL, "[VI] skip room with no active lobby - %s", room.jid)
        return;
    end

    local invitee = stanza.attr.from;
    local affiliation = room:get_affiliation(invitee);

    if affiliation ~= 'owner' then
        module:log(LOGLEVEL, "[VI] Skip user %s with affiliation - %s", occupant.bare_jid, affiliation)
        return
    end

    module:log(LOGLEVEL, "[VI] Bypassing lobby for room %s occupant %s", room.jid, occupant.bare_jid);
    occupant.role = 'moderator';
end, -3);
--- Run just before lobby(priority -4) and members_only (-5).
--- Must run after token_verification (99), max_occupants (10), allowners (2).