-- Token moderation
-- this module looks for a field on incoming JWT tokens called "moderator".
-- If it is true the user is added to the room as a moderator, otherwise they are set to a normal user.
-- Note this may well break other affiliation based features like banning or login-based admins
local jid_bare = require "util.jid".bare;
local json = require "cjson";
local basexx = require "basexx";
local um_is_admin = require "core.usermanager".is_admin;

local function is_admin(jid)
    return um_is_admin(jid, module.host);
end

local LOGLEVEL = "info";

module:log(LOGLEVEL, "[VI] Plugin mod_token_moderation loaded");

module:hook("muc-occupant-pre-join", function(event)
    setupAffiliation(event.room, event.origin, event.stanza)
end, -2);

function setupAffiliation(room, origin, stanza)
    if room.destroying or room._data.destroyed then
        return;
    end

    if origin.auth_token then
        -- Extract token body and decode it
        local dotFirst = origin.auth_token:find("%.");
        if dotFirst then
            local dotSecond = origin.auth_token:sub(dotFirst + 1):find("%.");
            if dotSecond then
                local bodyB64 = origin.auth_token:sub(dotFirst + 1, dotFirst + dotSecond - 1);
                local body = json.decode(basexx.from_url64(bodyB64));
                local jid = jid_bare(stanza.attr.from);

                -- If outcast affiliation presented do not handle token again
                if room:get_affiliation(jid) == "outcast" then
                    module:log(LOGLEVEL, "[VI] Token outcast");
                    return;
                end;

                -- If user is a moderator or an admin, set their affiliation to be an owner
                if body["moderator"] == true or is_admin(jid) then
                    module:log(LOGLEVEL, "[VI] Hook mod_token_moderation owner");
                    room:set_affiliation(true, jid, 'owner');
                else
                    module:log(LOGLEVEL, "[VI] Hook mod_token_moderation none");
                    room:set_affiliation(true, jid, 'none');
                end;
            end;
        end;
    end;
end;
