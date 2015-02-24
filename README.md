# acl-magic: magicaly simple but powerfull ACL (Access Control List) node.js module

acl-magic provided  pluginisable persistence and cache control and an extensible way to  model all kind of requirements (you can add arbitrarly complex rules in js code but still use the main acl-magic concepts)

This ACL model is based on three abstract concepts:
  1. Resources: You got a directed graph of resources that can represent the final records, categories, intermediate branches, anything). This graph does't have cycles but can have multiple start roots. All graph nodes are just strings, identifying uniquely a resource.
  2. Zones:  You have users belonging to various access area (groups, roles, etc). The user itslef is an access area. A zone can have multiple parent zones. A zone inherits rights from all the parent zones.
  3. Concerns: You can have various concerns (specific actions in your application or things like capabilities: read/write, etc)

#Implementation
 We try to be as fast as possbile and  load things from the database as lazy as possible (only when required).
 The  "allow" function  can test  if a zone (user or role, group,etc) has acces on a specific resource or a specific part of a resource graph.  Therefore, we load only the parents of that resource and try to find grant records specific for that resource and all the super zones of the  user (or zone).
 It is possible to write your own persistence engine and your own cache. The default cache just keeps everything in memory for 5 minutes. The cache in informed by any new grant records but ignores them.  You can chain concerns and add your own specific rules regarding permisions, access shortcuts, etc.  

#APIs, How to use.

###Create a concern
  acl.createConcern(concernName, persistence, exceptionalRulesCallaback)

  
###Exemple of how to create/initialise two concerns:
  acl.createConcern(concernName, persistence, exceptionalRulesCallaback)

       var acl    = require("acl-magic");
       var cache  =  acl.createCache();
       var persistence =  acl.createRedisPersistence(redisConenction, cache);//cache is optional
       var writeConcern = acl.createConcern("write", persistence);
       /*
        initialise a readCorncern for resources with the additional rule that if the user is allowed 
        to write the resources it means read acces also
       */
       var readConcern = acl.createConcern("read", persistence, function(zoneId,resourceId){
        if(writeConccern.allow(zoneId,resourceId)){
          return true;
          }
      //you can add also other fancy checks, shortcuts, etc
      /*it is possible to use a negative rights approach by simple creating a "deny" concern and 
      negate conditions in additional rule
      */
        return false;
      });
  

###Add parentnode for a resources
      acl.addResourceParent(resourcesUID, parentUid)

###Include a zone in another access zone
      acl.addZoneParent(zoneId, parentZoneId)

###Allow a zone to access a resource or soubtree from that resources
     concern.grant(zoneId, resourceId)
  
###Test if an user has access to a resource or tree of resources
      concern.allow(zoneId, resourceId, callback)

  
#The algorithm (for checking with allow on a specific concern)
       Step 1: load recrusively all the parents for a specific zoneId 
            cache.loadZoneParents(zoneId, callback)
       Step 2: for grant records
            cache.loadGrantrecords(resourceId, callback)
       Step 3: test if any parent is in grant records. If it successfully find one such record, finish and returns true
       Step 4: recursively, load parents resources and try step 3
       Step 5: if exist. returns the result of the exceptional rule for this concern
       Step 6: return false (is not allowed)
 
 
#Other functions

###create redis persistence
      var persistence =  acl.createRedisPersistence(redisConenction, cache);//cache is optional
      
###create memory persistence (for testing mainly..)
      var persistence =  acl.createMemoryPersistence(redisConenction);
      
###create cache
      var cache  =  acl.createCache();
      
 
