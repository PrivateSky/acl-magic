/**
 * Created by ciprian on 23.01.2017.
 */

var acl = require('./acl');
var container = require('safebox').container;
var aclRules = {};
var aclConfiguratorAvailable = false;
var concerns = {};
var uuid = require('node-uuid');
var apersistence = require('apersistence');
var ruleModel = {
    contextType: {
        type: "string"
    },
    context: {
        type: "string"
    },
    subcontextType: {
        type: "string"
    },
    subcontext: {
        type: "string"
    },
    zone: {
        /* numele de grup al agentului */
        type: "string",
        index:true
    },
    action:{
        type:"string",
        index:true
    },
    type:{
        type:"string",
        default:"white_list"
    },
    id:{
        type:"string",
        index:true,
        pk:true
    }
};
var persistence = undefined;
var redisConnection = undefined;
var logger = require('double-check').logger;



/*
    The acl configurator is an object that performs CRUD-type of operations on the acl database.
    Each of the operations can be safely called at any point in time regardless of the status of the database connection.
    However, whenever a dependency is not met (the database connection for instance), the callback returns with error.
    For now any error that occurs is further passed to be treated in a superior layer..
 */

function getConcernsForAction(action,ruleType){
    // dummy for now... in time might implement some action-concern associations
    // duplicate code in aclChecker.js ----- fix issue
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


var callsBuffer = {};
function safeCall(func){
    return function(){
        if(aclConfiguratorAvailable){
            func.apply({},arguments)
        }
        else{
            if(!callsBuffer[func.name]){
                callsBuffer[func.name] = {
                    'toExecute':func,
                    'args'     : []
                }
            }
            callsBuffer[func.name].args.push(arguments);
        }
    }
}

function updateResourceTree(rule){
    var resourceChain = ['contextType', 'context', 'subcontextType', 'subcontext'];
    return resourceChain.reduce(function (parent, child) {
        var resource = parent;
        if (rule[child]) {
            resource += "/" + rule[child];
            aclRules[rule.type].addResourceParent(resource, parent);
        }
        return resource
    }, "all");
}

function removeRule(rule,updatePersistence,callback) {
    logger.debug("Remove rule");
    var rules = aclRules[rule.type];

    if(!rules){
        callback(new Error("Rules of type '"+rule.type+"' are unknown"));
        return;
    }
    var finalResource = updateResourceTree(rule);
    var concerns = getConcernsForAction(rule['action'],rule.type);
    concerns.forEach(function (concern) {
        concern.ungrant(rule['zone'], finalResource);
    });

    if(updatePersistence) {
        persistence.deleteById("aclRule",rule.id, callback);
    }else{
        callback(undefined,rule)
    }
}

function addRule(rule,updatePersistence,callback){
    logger.debug("Add rule");
    var rules = aclRules[rule.type];
    
    if(!rules){
        callback(new Error("Rules of type '"+rule.type+"' are unknown"));
        return;
    }

    var finalResource = updateResourceTree(rule);
    var concerns = getConcernsForAction(rule['action'],rule.type);
    concerns.forEach(function(concern){
        concern.grant(rule['zone'],finalResource);
    });

    var toStore = apersistence.createRawObject("aclRule",new Buffer(uuid.v1()).toString('base64'));
    apersistence.modelUtilities.getModel('aclRule').persistentProperties.forEach(function(field){
        if(rule[field]!==undefined) {
            toStore[field] = rule[field];
        }
    });

    if(updatePersistence) {
        persistence.saveObject(toStore, callback);
    }else{
        callback(undefined,toStore)
    }
}

function getRules(callback){
    persistence.filter("aclRule",{},function(err,result){
        callback(err,result);
    });
}

function getRuleById(id,callback){
    persistence.findById("aclRule",id,callback)
}

function addZoneParent(child,parent){
    for(var rules in aclRules){
        aclRules[rules].addZoneParent(child,parent);
    }
}

function delZoneParent(child,parent){
    for(var rules in aclRules){
        aclRules[rules].delZoneParent(child,parent);
    }
}

function flushAclRules(callback){
    redisConnection.keys("acl_magic*",function(err,result){
        if(err){
            callback(err);
        }else{
            redisConnection.del(result,callback);
        }
    });
}


container.declareDependency("aclConfigurator", ["redisPersistence","redisClient"], function (outOfService, redisPersistence,redisClient) {
    if (!outOfService) {
        logger.debug("Enabling acl configurator...");

        aclRules["white_list"] = acl.createRedisPersistence(redisClient,undefined,"white_list");
        aclRules["black_list"] = acl.createRedisPersistence(redisClient,undefined,"black_list");

        redisConnection = redisClient;
        persistence =  redisPersistence;
        persistence.registerModel("aclRule",ruleModel,function(err,result){
            if(err){
                logger.error(err);
                aclConfiguratorAvailable = false;
            }else {
                logger.debug("Ready to store acl rules");
                aclConfiguratorAvailable = true;

                for(var call in callsBuffer){
                    callsBuffer[call].args.forEach(function(args){
                        callsBuffer[call].toExecute.apply({},args)
                    });
                }
                callsBuffer = {};
            }
        });
    } else {
        logger.debug("Disabling acl configurator...");
        aclConfiguratorAvailable = false;
        persistence = undefined;
    }
    
    
    return{
        'addRule':safeCall(addRule),
        'removeRule' : safeCall(removeRule),
        'getRules' : safeCall(getRules),
        'addZoneParent' : safeCall(addZoneParent),
        'delZoneParent': safeCall(delZoneParent),
        'getRuleById':safeCall(getRuleById),
        'flushExistingRules':safeCall(flushAclRules)
    }
});
