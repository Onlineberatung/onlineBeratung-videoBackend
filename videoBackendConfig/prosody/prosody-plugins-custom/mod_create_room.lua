-- Create room
-- this module looks if the room already exits or if the user is allowed to create a room by reading the jwt token "moderator" key.
local jid_split = require 'util.jid'.split;
local json = require "cjson";
local basexx = require "basexx";

local main_muc_service = prosody.hosts[module:get_host()].modules.muc;

module:log('info', "[VI] Plugin mod_create_room loaded");

module:hook_global("post-jitsi-authentication", function(session)
    module:log('info', "[VI] Post jitsi authentication hook");

    if session.auth_token then
        module:log('info', "[VI] Token found");
        local tokenData = parse_token(session.auth_token)
        if tokenData then
            -- Check if room already exists
            for room in main_muc_service.all_rooms() do
                local node = jid_split(room.jid);
                if tokenData['room'] == node then
                    module:log('info', "[VI] Room already exists");
                    return nil;
                end
            end

            -- Check if user is moderator
            if tokenData['moderator'] then
                module:log('info', "[VI] User is moderator");
                return nil;
            end
        end
    end

    module:log('info', "[VI] User not allowed to create the room!");
    return {
        res = false;
        error = "cancel";
        reason = "User not allowed to create room";
    }
end);

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
