/**
 * Created by ciprian on 16.02.2017.
 */

var logger = require('double-check').logger;
logger.logConfig.display.debug = false;

var acl = require("../lib/acl.js");
var container = require('safebox').container;
var apersistence = require('apersistence');
var redisClient = require('redis').createClient();
var fs = require('fs');



container.resolve("redisClient",redisClient);


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

var assert = require('double-check').assert;


container.declareDependency("accessResourcesTest",['aclConfigurator','aclChecker'],function(outOfService,aclConfigurator,aclChecker){
    if(outOfService){
        assert.fail("Could not run 'accessResourcesTest'\nDependencies were not met");
    }else{

        assert.callback("Access exceptions test",function(testFinished){
            runTest(aclConfigurator,aclChecker,testFinished);
        })
    }
});


function runTest(aclConfigurator,aclChecker,testFinished){
    var testRules = [
        {
            "contextType": "swarm",
            "context": "swarm1",
            "zone": "user",
            "action": "execution",
            "type":"white_list"
        },
        {
            "contextType": "swarm",
            "context": "swarm1",
            "subcontextType": "ctor",
            "subcontext": "ctor1",
            "zone": "user",
            "action": "execution",
            "type":"black_list"
        }
    ];

    var resourceToAccess = ["swarm", "swarm1", "ctor", "ctor1", "execution"];

    var testCases = [{
        "user":"user",
        "expectedResult":false,
        "resource": ["swarm", "swarm1", "ctor", "ctor1", "execution"]
        },{
        "user":"user",
        "expectedResult":true,
        "resource": ["swarm", "swarm1", "ctor", "ctor2", "execution"]
        }];

    insertRules(function(err,result){
        if(err){
            assert.fail("Failed to persist rules\nErrors encountered:\n",err);
        }else{
            var testsPassed = 0;
            testCases.forEach(function(testCase){
                runTestCase(testCase,function(err,result){
                    if(err){
                        assert.fail(err.message);
                    }else{
                        assert.equal(result,testCase["expectedResult"],"accessResourcesTest failed for user "+testCase["user"])
                        testsPassed++;
                        if(testsPassed===testCases.length){
                            testFinished();
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

    function runTestCase(testCase,callback){
        aclChecker.apply({},testCase.resource.concat([testCase["user"],callback]));
    }
}
