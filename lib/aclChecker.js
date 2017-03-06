/**
 * Created by ciprian on 23.01.2017.
 */

/*
    acl_checker will provide a global function, checkAccess, that will be imported in all adapters through the autolib thing
 */


var acl = require('./acl');
var container = require("safebox").container;
var aclRules = {};
var accessQueue = [];
var concerns = {};

var logger = require('double-check').logger;


function imediateCheck(contextType,contextValue,subcontectType,subcontextValue,action,zone,callback) {
    /*
     Check whether the user appears on the black list. If so, deny access.
     Check then on the white list. If he appears, allow access.
     Else deny access.

     This system functions as a white list with exceptions. Basicaly you can add
     'white rules' with broad coverage, and use a few 'black rules' to amend the
     white rules.

     The system is logically equivalent with a pure 'white list' or a pure 'black list',
     but has the advantage that it is more user friendly with less rules to add and
     a more intuitive approach.


     TO DO: After some time the buffer can overflow. In those cases, the checker should become
            out of service or start resolving the calls with 'error'.
     */

    switch (contextType) {
        case "swarm":
            checkSwarmAccess(contextValue, subcontectType, subcontextValue, action,zone, callback);
            break;
        case "table":
            callback(new Error("Not implemented yet"));
    }
}

function delayedCheck(contextType,contextValue,subcontectType,subcontextValue,action,zone,callback){
    accessQueue.push(arguments);
}

function getConcernsForAction(action,ruleType){
    // dummy for now... in time might implement some action-concern associations
    var relevantConcerns = [action];
    if(!concerns[ruleType]){
        concerns[ruleType] = {}
    }

    return relevantConcerns.map(function(concern){
        if(!concerns[ruleType][concern]){
            concerns[ruleType][concern] = acl.createConcern(concern, aclRules[ruleType]);
        }
        return concerns[ruleType][concern]
    })
}

function checkSwarmAccess(swarmName,subcontextType,subcontextValue,action,zone,callback){
    check("black_list",function(err,result){
        if (err) {
            callback(err);
        } else if (result === true) {
            callback(undefined, false);
        } else {
            check("white_list",callback);
        }
    });


    function check(listType,callback){
        createExplicitResourceId("swarm",swarmName,subcontextType,subcontextValue,aclRules[listType],function(err,resourceId) {
            if(err){
                callback(err);
            }else {
                var concerns = getConcernsForAction(action, listType);
                checkConcerns(resourceId, concerns, callback);
            }
        })
    }
    function checkConcerns(resourceId,concerns,callback){
        var validConcerns = [];
        var rejections = [];
        concerns.forEach(function(concern){
            concern.allow(zone,resourceId,function(err,res){
                if(err){
                    rejections.push(err);
                }else if(res === false) {
                    rejections.push(concern);
                }
                else{
                    validConcerns.push(concern);
                }

                if(rejections.length+validConcerns.length === concerns.length){
                    if(rejections.length>0){
                        callback(undefined,false);
                    }else{
                        callback(undefined,true);
                    }
                }
            })
        });
    }
}

function createExplicitResourceId(contextType,contextValue,subcontectType,subcontextValue,persistence,callback){
    var id = "all";
    var finalId = "all";
    var returnedCallbacks = 0;
    var errors = [];
    var possibleIds = [];

    for (var i = 0; i < 4; i++) {
        if (arguments[i]) {
            id = id + "/" + arguments[i];
            possibleIds.push(id);
        } else {
            break;
        }
    }

    possibleIds.forEach(function(id){
        persistence.loadResourceDirectParents(id,function(err,parents){
            returnedCallbacks++;
            if(err){
                errors.push(errors);
            }else{
                if(parents.length>0 && id.length>finalId.length){
                    finalId = id;
                }
            }
            if(returnedCallbacks===possibleIds.length){
                if(errors.length>0){
                    callback(errors);
                }else{
                    callback(undefined,finalId);
                }
            }
        })
    })
}

container.declareDependency("aclChecker", ["redisClient"], function (outOfService, redisClient) {
    
    if (!outOfService) {
        logger.debug("Enabling acl checker...");

        aclRules["white_list"] = acl.createRedisPersistence(redisClient,undefined,"white_list");
        aclRules["black_list"] = acl.createRedisPersistence(redisClient,undefined,"black_list");

        accessQueue.forEach(function(accessArguments){
            imediateCheck.apply({},accessArguments);
        });
        accessQueue = [];
        return imediateCheck;
    } else {
        logger.debug("Disabling acl checker...");
        return delayedCheck;
    }
});