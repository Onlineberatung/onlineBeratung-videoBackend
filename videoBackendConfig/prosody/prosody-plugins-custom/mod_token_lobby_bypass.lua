--- Plugin to allow users to bypass lobby based on attribute in JWT.
---
--- This module should be added to the main muc component.
---

local LOGLEVEL = "info";

local muc_util = module:require "muc/util";
local json = require "cjson";
local basexx = require "basexx";
local jid_bare = require "util.jid".bare;
local valid_affiliations = muc_util.valid_affiliations;
local is_healthcheck_room = module:require "util".is_healthcheck_room;

module:log(LOGLEVEL, "[VI] Plugin mod_token_lobby_bypass loaded");

module:hook("muc-occupant-pre-join", function (event)
    module:log(LOGLEVEL, "[VI] Hook mod_token_lobby_bypass muc-occupant-pre-join");

    local room, occupant, stanza, origin = event.room, event.occupant, event.stanza, event.origin;

    if is_healthcheck_room(room.jid) then
        return;
    end

    if room._data.lobbyroom == nil then
        module:log(LOGLEVEL, "[VI] Skip room with no active lobby - %s", room.jid)
        return;
    end

    if not origin.auth_token or origin.auth_token == nil then
        module:log(LOGLEVEL, "[VI] Skip user without token %s", occupant.bare_jid)
        return;
    end;

    local tokenData = parse_token(origin.auth_token)
    if not tokenData or tokenData == nil then
        module:log(LOGLEVEL, "[VI] Token parse failed for user %s", occupant.bare_jid)
        return;
    end;

    if not tokenData.moderator or tokenData.moderator ~= true then
        module:log(LOGLEVEL, "[VI] Skip user with no token - %s", occupant.bare_jid)
        return;
    end;

    module:log(LOGLEVEL, "[VI] Bypassing lobby for room %s occupant %s", room.jid, occupant.bare_jid);

    occupant.role = 'moderator';

    -- set affiliation to "member" if not yet assigned by other plugins
    local affiliation = room:get_affiliation(occupant.bare_jid);
    if valid_affiliations[affiliation or "none"] < valid_affiliations.member then
        module:log(LOGLEVEL, "Setting affiliation for %s -> owner", occupant.bare_jid);
        room:set_affiliation("token_plugin", occupant.bare_jid, 'owner');
    end
end, -3);
--- Run just before lobby(priority -4) and members_only (-5).
--- Must run after token_verification (99), max_occupants (10), allowners (2).

function parse_token(token)
    local dotFirst = token:find("%.");
    if dotFirst then
        local dotSecond = token:sub(dotFirst + 1):find("%.");
        if dotSecond then
            local bodyB64 = token:sub(dotFirst + 1, dotFirst + dotSecond - 1);
            return json.decode(basexx.from_url64(bodyB64));
        end;
    end;

    return nil;
end