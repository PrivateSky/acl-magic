var acl = require("../lib/acl.js");

var assert  = require('assert');

var persistence =  acl.createMemoryPersistence();
var writeConcern = acl.createConcern("write", persistence, function(zoneId, resourceId, callback){
    if(zoneId == "root"){
        callback(null, true);
    } else {
        callback(null, false);
    }
});

var counter = 0 ;

persistence.addZoneParent("user_1", "role_1");

persistence.loadZoneParents("user_1", function(err, res){
    assert.equal(res[0], "user_1");
    assert.equal(res[1], "role_1");
    counter++;
});

persistence.addZoneParent("user_2", "role_2");

persistence.addZoneParent("role_1", "admin");

persistence.loadZoneParents("user_1", function(err, res){
    assert.equal(res[0], "user_1");
    assert.equal(res[1], "role_1");
    assert.equal(res[2], "admin");
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

    persistence.addResourceParent("m_2", "g_x");
    writeConcern.grant("user", "g_x");

    writeConcern.allow("user_2", "r_2", function(err, res){
        assert.equal(res, true);
        counter++;
    });
});

writeConcern.grant("user_1", "ggf");
writeConcern.allow("user_1", "ggf", function(err, res){
    assert.equal(res, true);
    counter++;
});



var readConcern = acl.createConcern("read", persistence, null, function(zoneId, resourceId, callback){
    var allow = writeConcern.allow.async(zoneId,resourceId);
    (function(allow){
        callback(null, allow);
    }).wait(allow);
});


readConcern.allow("root", "ggm", function(err, res){
    assert.equal(res, true);
    counter++;
});


readConcern.allow("user_1", "ggm", function(err, res){
    assert.equal(res, false);
    counter++;
    writeConcern.grant("user_1", "ggm");
    readConcern.allow("user_1", "ggm", function(err, res) {
        assert.equal(res, true);
        counter++;
    });
});


setTimeout(function(){
    assert.equal(counter, 9);
    console.log("Success!");
}, 1000);
