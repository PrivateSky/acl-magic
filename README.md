# acl-magic

Simple and generic API for ACLs for node.js
- pluginisable persistence (only  redis persistence is provided for now)

This module is based on an a story containing three concepts:
  1. Resources: You got a directed graph of resources that can represent the final records, categories, intermediate branches, anything). This graph does't have cycles and but can have multiple start roots. All graph nodes are just strings, identifying uniquely a resources.
  2. Zones:  You have users belonging to various access areas (groups, roles, etc). the user itslef is an access areas.
  3. Concerns: You can have various concerns (specific actions in your application or things like capabilities: read/write, etc)
  
  
APIs:

#Create/initialise a concern:

  var acl = require("acl-magic");
  var persistence = acl.createRedisPersistnece(redisConenction);
  /*
    initialise an readCorncern for resources with the additional rule that if the user is allowed from the writeConcern (has write rights), should allow also read access
  */
  var readConcern = acl.create("read", persistence, function(userId,resourceId){
    if(writeConccern.allow(userId,resourceId)){
      return true;
      }
    return false;
  });
  

#Add parentnode for a resources
  acl.addResourceParent(resourcesUID, parentUid)

#Include a zone in another access zone
  acl.addZoneParent(zoneId, parentZoneId)

#Allow a zone to access a resource or soubtree from that resources
  concern.grant(zoneId, resourceId)
  
#Test if an user has access to a resource or tree of resources
  concern.allow(userId, resourceId, callback)

  
##Implementation
 We try to be as fast but as lazy as possible and load things from database only when required.
 The only access api is allow an can test only if an user has acces on a specific resource or a specific part of a resource graph. Therefore, we load only the parents of that resource and try to find grant records specific for that 
 resource and all the super zones of the current user.
 
 
