/**
 * Created by ciprian on 20.02.2017.
 */

var logger = require('double-check').logger;
logger.logConfig.display.debug = false;

var acl = require("../lib/acl.js");

var container = require('safebox').container;
var apersistence = require('apersistence');
var redisClient = require('redis').createClient();
var fs = require('fs');
var assert = require('double-check').assert;


container.resolve("redisClient", redisClient);

container.declareDependency("redisPersistence",["redisClient"],function(outOfService,redisClient){
    if(outOfService){
        logger.debug("Redis persistence failed");
    }else{
        logger.debug("Initialising Redis persistence...");
        redisPersistence = apersistence.createRedisPersistence(redisClient);
        return redisPersistence;
    }
});

acl.enableACLConfigurator();
acl.enableACLChecker();

var testAlreadyRan = false;
container.declareDependency("delayedChecksTest",['aclConfigurator','aclChecker'],function(outOfService,aclConfigurator,aclChecker){
    if(!outOfService && !testAlreadyRan){
        assert.callback("Delayed checks test",function(end){
            testAlreadyRan = true;
            runTest(aclConfigurator,aclChecker,redisClient,end);
        });
    }
});





function runTest(aclConfigurator,aclChecker,redisClient,end){
    var testRules = [
        {
            "contextType": "swarm",
            "context": "swarm1",
            "subcontextType": "ctor",
            "subcontext": "ctor1",
            "zone": "zone0",
            "action": "execution",
            "type":"white_list"
        },
        {
            "contextType": "swarm",
            "context": "swarm1",
            "subcontextType": "ctor",
            "subcontext": "ctor1",
            "zone": "zone1",
            "action": "execution",
            "type":"black_list"
        }
    ];

    var userZones = {
        "user1":["zone1","zone2"],
        "user2":["zone1"],
        "user3":["zone2"],
        "zone1":["zone0"],
        "zone2":["zone0"]
    };

    var resourceToAccess = ["swarm", "swarm1", "ctor", "ctor1", "execution"];

    var testCases = [{
        "user":"user1",
        "expectedResult":false
    },{
        "user":"user2",
        "expectedResult":false
    },{
        "user":"user3",
        "expectedResult":true
    },{
        "user":"user4",
        "expectedResult":false
    }];

    insertRules(function(err,result){
        if(err){
            assert.fail("Failed to persist rules\nErrors encountered:\n",err);
        }else{
            var testsPassed = 0;
            createUserZones();

            logger.debug("Disabling redisClient");
            container.outOfService("redisClient");
            setTimeout(function(){
                logger.debug("Resolving redisClient");
                container.resolve("redisClient",redisClient);
            },300);

            testCases.forEach(function(testCase){
                runTestCase(testCase,function(err,result){
                    if(err){
                        assert.fail(err.message);
                    }else{
                        assert.equal(result,testCase["expectedResult"],"delayedChecksTest failed for user "+testCase["user"])
                        testsPassed++;
                        if(testsPassed===testCases.length){
                            end();
                            aclConfigurator.flushExistingRules(function(err,result){
                                redisClient.quit();
                            })
                        }

                    }
                })
            })
        }
    });

    function insertRules(callback) {
        var rulesAdded = 0;
        var errors = [];
        testRules.forEach(function(rule){
            aclConfigurator.addRule(rule,false,function(err,result){
                if(err){
                    errors.push(err);
                }else{
                    rulesAdded++;
                }
                if(rulesAdded+errors.length===testRules.length) {
                    if(errors.length>0){
                        callback(errors);
                    }else {
                        callback();
                    }
                }
            })
        })
    }

    function  createUserZones(){
        for(var child in userZones){
            userZones[child].forEach(function(parent){
                aclConfigurator.addZoneParent(child,parent);
            });
        }
    }

    function runTestCase(testCase,callback){
        aclChecker.apply({},resourceToAccess.concat([testCase['user'],callback]));
    }
}
