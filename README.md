# acl-magic: magically simple but powerful ACL (Access Control List) node.js module

acl-magic provided  configurable persistence and cache control and an extensible way to  model all kind of requirements. Arbitrary complex rules can be added within js code but still use the main acl-magic concepts.

This ACL model is based on three abstract concepts:
  1. Resources: You got a directed graph of resources that can represent the final records, categories, intermediate branches, anything). This graph doesn't have cycles but can have multiple start roots. All graph nodes are just strings, identifying uniquely a resource.
  2. Zones:  You have users belonging to various access area (groups, roles, etc). The user himself is an access area. A zone can have multiple parent zones. A zone inherits rights from all the parent zones.
  3. Concerns: You can have various concerns (specific actions in your application or things like capabilities: read/write, etc)

From the API perspective, zones and resources are just free string and you can add parent relations between zones or between resources from an "concern' object or from a "persistence" object.
As you can see bellow, two concerns can share the same persistence but could also be based on different persistences.

#Implementation
 We try to be as fast as possible and  load things from the database as lazy as possible (only when required).
 The  "allow" function is always asynchronous and can test if a zone (user or role, group,etc) has access on a specific resource or a specific part of a resource graph.
 Therefore, we load only the parents of that resource and try to find grant records specific for that resource and all the super zones of the  user (or zone).
 It is possible to write your own persistence engine and your own cache. The default cache just keeps everything in memory for 5 minutes.
 The cache is informed by any new grant records but in the default implementation it just ignores them.  You can chain concerns and add your own specific rules regarding permissions, access shortcuts, etc.


#APIs, How to use.

###Create a concern
  acl.createConcern(concernName, persistence, exceptionalRulesFunction, postCheckFunction)

 Please take an look in tests for how to use it (https://github.com/salboaie/acl-magic/blob/master/test/aclTest.js).



###Create redis persistence
      var persistence =  acl.createRedisPersistence(redisConnection, cache);//cache is optional

###Create memory persistence (for tests mainly... but you can also use to create a synchronous API when your application size permits it)
      var persistence =  acl.createMemoryPersistence(redisConnection);

###Add parent node for a resources from concern or from persistence
      concern.addResourceParent(resourcesUID, parentUid)

      persistence.addResourceParent(resourcesUID, parentUid)

###Include a zone in another access zone from concern or from persistence
      concern.addZoneParent(zoneId, parentZoneId)

      persistence.addZoneParent(zoneId, parentZoneId)

###Allow a zone to access a resource or subtree from that resources
     concern.grant(zoneId, resourceId)

###Remove the grant record for a zone on a subtree from that resources
     concern.ungrant(zoneId, resourceId)

###Test if an user has access to a resource or tree of resources
      concern.allow(zoneId, resourceId, callback)

#The algorithm (for checking with allow on a specific concern)
       Step 0: if exist. returns the result of calling the exceptional rule function
       Step 1: load recursively all the parents for a specific zoneId
            cache.loadZoneParents(zoneId, callback)
       Step 2: for grant records
            cache.loadGrantRecords(resourceId, callback)
       Step 3: test if any parent is in grant records. If it successfully find one such record, finish and returns true
       Step 4: recursively, load parents resources and try step 3 while is possible
       Step 5: nothing found, return what postCheckFunction decides

###Create cache
      var cache  =  acl.createCache();
      
 
