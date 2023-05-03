require("../../../psknode/bundles/testsRuntime");
const tir = require("../../../psknode/tests/util/tir");

const dc = require("double-check");
const assert = dc.assert;
const openDSU = require('../../opendsu');
$$.__registerModule("opendsu", openDSU);
const scAPI = openDSU.loadApi("sc");
const w3cDID = openDSU.loadAPI("w3cdid");
const enclaveAPI = openDSU.loadApi("enclave");
const acl = require("../index.js");
var logger = require('double-check').logger;

assert.callback('Create enclave test', (testFinished) => {
    dc.createTestFolder('createDSU', async (err, folder) => {
        const testDomainConfig = {
            "anchoring": {
                "type": "FS",
                "option": {}
            },
            "enable": ["enclave", "mq"]
        }

        const domain = "testDomain"
        const apiHub = await tir.launchConfigurableApiHubTestNodeAsync({ domains: [{ name: domain, config: testDomainConfig }] });
        const sc = scAPI.getSecurityContext();

        sc.on("initialised", async () => {
            try {
                const walletDBEnclave = enclaveAPI.initialiseWalletDBEnclave();
                walletDBEnclave.on("initialised", async () => {

                    const persistence = acl.createEnclavePersistence(walletDBEnclave);

                    const writeConcern = acl.createConcern("write", persistence, function (zoneId, resourceId, callback) {
                        if (zoneId == "root") {
                            callback(null, true);
                        } else {
                            callback(null, false);
                        }
                    });
                    const readConcern = acl.createConcern("read", persistence, null, function (zoneId, resourceId, callback) {
                        const allow = writeConcern.allow.async(zoneId, resourceId);
                        (function (allow) {
                            callback(null, allow);
                        }).wait(allow);
                    });

                    await $$.promisify(persistence.addZoneParent)("user_1", "role_1");
                    await $$.promisify(persistence.addZoneParent)("user_2", "role_2");
                    await $$.promisify(persistence.addZoneParent)("role_1", "admin");
                    await $$.promisify(persistence.addZoneParent)("role_2", "user");
                    await $$.promisify(persistence.addResourceParent)("r_1", "m_1");
                    await $$.promisify(persistence.addResourceParent)("r_1", "f_1");
                    await $$.promisify(persistence.addResourceParent)("r_2", "m_1");
                    await $$.promisify(persistence.addResourceParent)("r_2", "m_2");
                    await $$.promisify(persistence.addResourceParent)("notes", "table");
                    await $$.promisify(persistence.addResourceParent)("notes2", "did");
                    
                    let result = await $$.promisify(persistence.localResourceExists)("notes", "table");
                    assert.equal(result, true)
                    result = await $$.promisify(persistence.localResourceExists)("notes2", "table");
                    assert.equal(result, false)
                    result = await $$.promisify(persistence.localResourceExists)("notes3", "table");
                    assert.equal(result, false);

                    try {
                        await $$.promisify(persistence.addResourceParent)("r_2", "m_2");
                    }
                    catch (err) {
                        assert.equal(err.originalMessage, "Trying to insert into existing record");
                    }
                    await $$.promisify(persistence.addResourceParent)("m_2", "g_x");

                    logger.debug("Checking if the zones get the right parents");

                    persistence.loadZoneParents("user_1", function (err, res) {
                        assert.equal(res[0], "user_1");
                        assert.equal(res[1], "role_1");
                    });


                    persistence.loadZoneParents("user_1", function (err, res) {
                        assert.equal(res[0], "user_1");
                        assert.equal(res[1], "role_1");
                        assert.equal(res[2], "admin");
                    });

                    writeConcern.grant("admin", "m_1");
                    writeConcern.allow("user_1", "r_1", function (err, res) {
                        if (err) {
                            assert.fail("Failed with error", err.message);
                        } else {
                            assert.equal(res, true);
                        }
                        testFinished()
                    });

                });

            } catch (e) {
                return console.log(e);
            }
        })
    });
}, 5000000);