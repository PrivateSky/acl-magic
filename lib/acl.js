
var persist  = require("./persistence.js");
var cache    = require("./cache.js");
require("asynchron");

exports.createRedisPersistence = function(redisConnection, cache){
    if(!cache){
        cache = exports.createCache();
    }
    return persist.createRedisPersistence(redisConnection, cache);
}

exports.createMemoryPersistence = function(){
    return persist.createMemoryPersistence();
}

exports.createCache = function(){
    return cache.createCache(60*1000);
}


function lazyAsyncDeepTreeChecker(root, getChildren, checkFunction, returnCallBack){
    var intermediateGenerators = [];
    intermediateGenerators.push(root);
    var waitingAsyncCall = 0;

    function checkNextNode(){
        var currentNode = intermediateGenerators.shift();
        if(!currentNode){
            if(waitingAsyncCall == 0){
                returnCallBack(null, false);
            } else {
                return ; //will be triggered again from other call
            }
        }
        waitingAsyncCall++;
        getChildren(currentNode, function(err,arr){
            waitingAsyncCall--;
            arr.map(function(n){
                intermediateGenerators.push(n);
            });
            if(waitingAsyncCall == 0){
                checkNextNode(); //just in case the main checking chain is already stopped because getChildren was slower than the checkFunction
            }
        });

        waitingAsyncCall++;
        checkFunction(currentNode, function(err,res){
            waitingAsyncCall--;
            if(res){
                returnCallBack(null, true);
            } else {
                checkNextNode();
            }
        })
    }
    checkNextNode();
}
function notDisjoint(arr1, arr2){
    var o = {};
    for(var i = 0, l = arr1.length; i<l; i++ ){
        o[arr1[i]] = true;
    }

    for(var i = 0, l = arr2.length; i<l; i++ ){
        if(o[arr2[i]]) {
            return true;
        }
    }
    return false;
}

function Concern(concernName, persistence, exceptionalRulesFunction, afterCheckFunction){
    this.grant = function(zoneId, resourceId){
        persistence.grant(concernName,zoneId, resourceId);
    }

    this.ungrant = function(zoneId, resourceId){
        persistence.ungrant(concernName,zoneId, resourceId);
    }

    this.allow = function(zoneId, resourceId, callback){
        var self = this;
        var allParentZones = persistence.loadZoneParents.async(zoneId);

        function intermediateReturnCallback(err, res){
            if(err){
                afterCheckFunction(zoneId, resourceId, callback) ;
                return;
            }
            callback(null,res);
        }

        (function(allParentZones){

            function createCheckContinuation(zoneId, resourceId, callback){

                return function(err, result){
                    if(result){
                        callback(null, true);
                        return;
                    }
                    lazyAsyncDeepTreeChecker(resourceId,
                        function(node, callback){ //get children
                            var parents = persistence.loadResourceDirectParents.async(node);
                            (function(parents){
                                callback(null,parents);
                            }).wait(parents);
                        },
                        function(node, callback){ //checkFunction
                            var resourceGrants = persistence.loadResourceDirectGrants.async(node);
                            (function(resourceGrants){
                                if(notDisjoint(resourceGrants, allParentZones)){
                                    callback(null, true);
                                }
                                else {
                                    callback(null, false);
                                }
                            }).wait(resourceGrants);
                        },
                        intermediateReturnCallback  //pass the result callback to report success (true) on first successful check or false at the end
                    );
                }
            }

            console.log("LoadZoneParents for ",zoneId, ":", allParentZones);
            if(exceptionalRulesFunction) {
                exceptionalRulesFunction(zoneId, resourceId, createCheckContinuation(zoneId, resourceId, intermediateReturnCallback));
            } else {
                createCheckContinuation(zoneId, resourceId, intermediateReturnCallback)();
            }
        }).wait(allParentZones);
    }
}

exports.createConcern = function(concernName, persistence, exceptionalRulesFunction){
    return new Concern(concernName, persistence, exceptionalRulesFunction);
}
