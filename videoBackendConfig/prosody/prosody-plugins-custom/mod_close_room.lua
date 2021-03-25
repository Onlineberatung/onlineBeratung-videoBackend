module:hook("muc-occupant-left", function(event)
    local barejid = event.occupant.bare_jid;
    local role =  event.room:get_affiliation(barejid);
    if role == "owner" then
      event.room:destroy();
      event.room:clear();
    end
end)
