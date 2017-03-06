var logger = require('double-check').logger;
logger.logConfig.display.debug = false;

var acl = require("../lib/acl.js");
var assert  = require('double-check').assert;
var persistence =  acl.createMemoryPersistence();

var writeConcern = acl.createConcern("write", persistence, function(zoneId, resourceId, callback){
    if(zoneId == "root"){
        callback(null, true);
    } else {
        callback(null, false);
    }
});
var readConcern = acl.createConcern("read", persistence, null, function(zoneId, resourceId, callback){
    var allow = writeConcern.allow.async(zoneId,resourceId);
    (function(allow){
        callback(null, allow);
    }).wait(allow);
});


persistence.addZoneParent("user_1", "role_1");
persistence.addZoneParent("user_2", "role_2");
persistence.addZoneParent("role_1", "admin");
persistence.addZoneParent("role_2", "user");
persistence.addResourceParent("r_1", "m_1");
persistence.addResourceParent("r_1", "f_1");
persistence.addResourceParent("r_2", "m_1");
persistence.addResourceParent("r_2", "m_2");
persistence.addResourceParent("r_2", "m_2");
persistence.addResourceParent("m_2", "g_x");

assert.steps("Acl core test",[
    function(next){
        logger.debug("Checking if the zones get the right parents");

        persistence.loadZoneParents("user_1", function(err, res){
            assert.equal(res[0], "user_1");
            assert.equal(res[1], "role_1");
            next();
        });
    },
    function(next){
        persistence.loadZoneParents("user_1", function(err, res){
            assert.equal(res[0], "user_1");
            assert.equal(res[1], "role_1");
            assert.equal(res[2], "admin");
            next();
        });
    },
    function(next){
        logger.debug("Checking the resources are correctly granted");

        writeConcern.grant("admin", "m_1");
        writeConcern.allow("user_1", "r_1", function(err, res){
            if(err){
                assert.fail("Failed with error",err.message);
            }else {
                assert.equal(res, true);
                next()
            }
        });
    },
    function(next){
        writeConcern.allow("user_2", "r_2", function(err, res){
            assert.equal(res, false);
            next();
        });
    },

    function(next){
        writeConcern.grant("user", "g_x");
        writeConcern.allow("user_2", "r_2", function(err, res){
            assert.equal(res, true);
            next();
        });
    },

    function(next){
        writeConcern.grant("user_1", "ggf");
        writeConcern.allow("user_1", "ggf", function(err, res){
            assert.equal(res, true);
            next();
        });
    },
    function(next) {
        readConcern.allow("root", "ggm", function (err, res) {
            assert.equal(res, true);
            next();
        })
    },
    function(next) {
        readConcern.allow("user_1", "ggm", function(err, res) {
            assert.equal(res, false);
            next();
        })
    },function(next) {
        writeConcern.grant("user_1", "ggm");
        readConcern.allow("user_1", "ggm", function(err, res) {
            assert.equal(res, true);
            next();
        })
    }
])
