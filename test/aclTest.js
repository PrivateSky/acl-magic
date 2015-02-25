var acl = require("../lib/acl.js");

var assert  = require('assert');

var persistence =  acl.createMemoryPersistence();
var writeConcern = acl.createConcern("write", persistence);

var counter = 0 ;

persistence.addZoneParent("user_1", "role_1");

persistence.loadZoneParents("user_1", function(err, res){
    assert.equal(res[0], "role_1");
    counter++;
});

persistence.addZoneParent("user_2", "role_2");

persistence.addZoneParent("role_1", "admin");

persistence.loadZoneParents("user_1", function(err, res){
    assert.equal(res[0], "role_1");
    assert.equal(res[1], "admin");
    counter++;
});

persistence.addZoneParent("role_2", "user");

persistence.addResourceParent("r_1", "m_1");
persistence.addResourceParent("r_1", "f_1");
persistence.addResourceParent("r_2", "m_1");
persistence.addResourceParent("r_2", "m_2");

writeConcern.grant("admin", "m_1");

writeConcern.allow("user_1", "r_1", function(err, res){
        assert.equal(res, true);
        counter++;
});

writeConcern.allow("user_2", "r_2", function(err, res){
    assert.equal(res, false);
    counter++;
});

persistence.addResourceParent("f_1", "g_1");
writeConcern.grant("user", "g_1");

writeConcern.allow("user_2", "r_2", function(err, res){
    assert.equal(res, true);
    counter++;
});


//assert.equal(counter, 5);

/*
var readConcern = acl.createConcern("read", persistence, function(zoneId,resourceId){
    if(writeConcern.allow(zoneId,resourceId)){
        return true;
    }
    return false;
});
*/