
var persist  = require("./persistence.js");
var cache    = require("./cache.js");
require("asynchron");

exports.createRedisPersistence = function(redisConnection, cache,type){
    if(!cache){
        cache = exports.createCache();
    }
    return persist.createRedisPersistence(redisConnection, cache,type);
};

exports.createMemoryPersistence = function(){
    return persist.createMemoryPersistence();
};

exports.createCache = function(timeOut){
    return cache.createCache(timeOut); /* somethink like 60*1000 or more*/
};


function lazyAsyncDeepTreeChecker(root, getChildren, checkFunction, returnCallBack){
    var intermediateGenerators = [];
    intermediateGenerators.push(root);
    var waitingAsyncCall = 0;

    function checkNextNode(){
        if(!intermediateGenerators){
            return ;
        }

        var currentNode = intermediateGenerators.shift();
        if(!currentNode){
            if(waitingAsyncCall == 0){
                intermediateGenerators = null;
                returnCallBack(null, false);
            } else {
                return ; //will be triggered again from other call
            }
        }
        waitingAsyncCall++;
        getChildren(currentNode, function(err,arr){
            if(intermediateGenerators){
                waitingAsyncCall--;
                arr.map(function(n){
                    intermediateGenerators.push(n);
                });
                if(waitingAsyncCall == 0){
                    checkNextNode(); //just in case the main checking chain is already stopped because getChildren was slower than the checkFunction
                }
            }
        });

        waitingAsyncCall++;
        checkFunction(currentNode, function(err,res){
            waitingAsyncCall--;
            if(res){
                intermediateGenerators = null;
                returnCallBack(null, true);
            } else {
                checkNextNode();
            }
        })
    }
    checkNextNode();
}

function Concern(concernName, persistence, exceptionalRulesFunction, afterCheckFunction){
    var self = this;

    this.grant = function(zoneId, resourceId){
        persistence.grant(concernName,zoneId, resourceId);
    }

    this.ungrant = function(zoneId, resourceId){
        persistence.ungrant(concernName,zoneId, resourceId);
    }

    this.addResourceParent = function(resourcesUID, parentUid){
        console.log("addResourceParent:", resourcesUID, parentUid);
        persistence.addResourceParent(resourcesUID, parentUid);
    }

    this.addZoneParent = function(zoneId, parentZoneId){
        console.log("addZoneParent:", zoneId, parentZoneId);
        persistence.addZoneParent(zoneId, parentZoneId);
    }

    /*
        allow return by calling callback(null,true) or callback(null,false). It should return only once.
     */

    this.allow1 = function(zoneId, resourceId, callback){
        var self = this;
        var allParentZones = persistence.loadZoneParents.async(zoneId);

        if(exceptionalRulesFunction){
            var exceptionAllow = exceptionalRulesFunction.async(zoneId, resourceId);
        } else {
            var exceptionAllow = false;
        }

        (function(allParentZones, exceptionAllow){
            if(exceptionAllow) {
                intermediateReturnCallback(null, true);
            } else {
                lazyAsyncDeepTreeChecker(resourceId,
                    function(node, callback){ //get children
                        var parents = persistence.loadResourceDirectParents.async(node);
                        (function(parents){
                            callback(null,parents);
                        }).wait(parents);
                    },
                    function(node, callback){ //checkFunction
                        var resourceGrants = persistence.loadResourceDirectGrants.async(concernName, node);
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
        }).wait(allParentZones, exceptionAllow);

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


        function intermediateReturnCallback(err, res){
            if(afterCheckFunction){
                afterCheckFunction(zoneId, resourceId,function(err,afterCheckAllow){
                    if(err){
                        callback(err);
                    }else if(afterCheckAllow){
                        callback(undefined,afterCheckAllow);
                    }else{
                        callback(undefined,res);
                    }
                });
            }else{
                callback(undefined,res);
            }
        }


    }

    this.allow = function(zoneId, resourceId, callback){
        var self = this;

        if(exceptionalRulesFunction){
            exceptionalRulesFunction(zoneId,resourceId,function(err,favorableException){
                if(err){
                    callback(err);
                }else if(favorableException===true){
                    intermediateReturnCallback(undefined,true);
                }else{
                    checkTree();
                }
            })
        }else{
            checkTree();
        }

        function checkTree(){
            persistence.loadZoneParents(zoneId,function(err,allParentZones){
                if(err){
                    callback(err);
                }else{
                    lazyAsyncDeepTreeChecker(resourceId,
                        function(node, callback){ //get children
                            process.nextTick(function() {
                                persistence.loadResourceDirectParents(node, function (err, parents) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(null, parents);
                                    }
                                });
                            })
                        },
                        function(node, callback){ //checkFunction
                            persistence.loadResourceDirectGrants(concernName, node,function(err,resourceGrants){
                                if(err){
                                    callback(err);
                                }else if(notDisjoint(resourceGrants, allParentZones)){
                                    callback(null, true);
                                }else {
                                    callback(null, false);
                                }
                            })
                        },
                        intermediateReturnCallback  //pass the result callback to report success (true) on first successful check or false at the end
                    );
                }
            })
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

        function intermediateReturnCallback(err, res){
            if(afterCheckFunction){
                afterCheckFunction(zoneId, resourceId,function(err,afterCheckAllow){
                    if(err){
                        callback(err);
                    }else if(afterCheckAllow){
                        callback(undefined,afterCheckAllow);
                    }else{
                        callback(undefined,res);
                    }
                });
            }else{
                callback(undefined,res);
            }
        }
    }
}

exports.createConcern = function(concernName, persistence, exceptionalRulesFunction, afterCheckFunction){
    return new Concern(concernName, persistence, exceptionalRulesFunction, afterCheckFunction);
}


exports.enableACLConfigurator = function(){
    require("./aclConfigurator");
}

exports.enableACLChecker = function(){
    require("./aclChecker")
}