-- Create room
-- this module looks if the room already exits or if the user is allowed to create a room by reading the jwt token "moderator" key.
local jid_split = require 'util.jid'.split;
local jid_bare = require "util.jid".bare;
local st = require "util.stanza"
local json = require "cjson";
local basexx = require "basexx";
local um_is_admin = require "core.usermanager".is_admin;
local formdecode = require "util.http".formdecode;

local main_muc_service = prosody.hosts[module:get_host()].modules.muc;

local function is_admin(jid)
    return um_is_admin(jid, module.host);
end

module:hook_global("bosh-session", function(event)
    is_create_room_allowed_by_token(event);
end);

module:hook_global("websocket-session", function(event)
    is_create_room_allowed_by_token(event);
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

-- Check if token on request exits
function is_create_room_allowed_by_token(event)
    local session, request = event.session, event.request;
    local query = request.url.query;

    -- If token exits check if room from token already created
    if query ~= nil then
        local params = formdecode(query);

        if params.token then
            local tokenData = parse_token(params.token)
            if tokenData then
                -- Check if room already exists
                for room in main_muc_service.all_rooms() do
                    local node = jid_split(room.jid);
                    if tokenData['room'] == node then
                        session.create_room_allowed_by_token = true;
                        return;
                    end
                end

                -- Check if user is moderator
                if tokenData['moderator'] then
                    session.create_room_allowed_by_token = true;
                    return;
                end
            end
        end
    end

    session.create_room_allowed_by_token = false;
    return;
end

-- ToDo: This is fired to late after pressing join on prejoin page it would be better to be fired in is_create_room_allowed_by_token
module:hook("muc-room-pre-create", function(event)
    local origin, stanza = event.origin, event.stanza, event.room;
    local jid = jid_bare(stanza.attr.from);

    if origin.create_room_allowed_by_token == true or is_admin(jid) then
        return;
    end

    origin.send(st.error_reply(stanza, "cancel", "not-allowed", "Room creation is restricted", module.host));
    return true;
end);

