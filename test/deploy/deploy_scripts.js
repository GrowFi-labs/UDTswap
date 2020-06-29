const deploy_scripts = require("../../src/deploy_udtswap.js");
const udtswap_utils = require("../../src/udtswap_utils.js");
const udtswap_consts = require("../../src/udtswap_consts.js");

async function deploy() {
    let scripts = [
        "UDTswap_udt_based",
        "UDTswap_lock_udt_based",
        "UDTswap_liquidity_UDT_udt_based",
        "test_udt"
    ];
    let i = 0;
    await deploy_scripts.init();
    while(i<4) {
        let deployed_tx = await deploy_scripts.deploy_udtswap(scripts[i]);
        while(true) {
            let confirmed = await udtswap_utils.getLiveCellStatus(udtswap_consts.nodeUrl, {
                index: "0x0",
                tx_hash: deployed_tx.txHash
            });
            if(confirmed) break;
            await udtswap_utils.sleep(1000);
        }
        let code_hash = udtswap_consts.ckb.utils.scriptToHash(deployed_tx.type);
        let code_hash_to_bytes = udtswap_consts.ckb.utils.hexToBytes(code_hash);
        console.log(scripts[i], deployed_tx.type, code_hash_to_bytes);

        i+=1;
    }
}

async function update() {
    let scripts = [
        "UDTswap_udt_based",
        "UDTswap_lock_udt_based",
        "UDTswap_liquidity_UDT_udt_based",
        "test_udt"
    ];
    let i = 0;
    await deploy_scripts.init();
    while(i<4) {
        let updated_tx = await deploy_scripts.update_udtswap(scripts[i]);
        while(true) {
            let confirmed = await udtswap_utils.getLiveCellStatus(udtswap_consts.nodeUrl, {
                index: "0x0",
                tx_hash: updated_tx.txHash
            });
            if(confirmed) break;
            await udtswap_utils.sleep(1000);
        }
        console.log(scripts[i], udtswap_consts.ckb.utils.scriptToHash(updated_tx.type));
        console.log(scripts[i] + " deps : ", updated_tx.txHash);
        i+=1;
    }
}

async function mint() {
    let owners = [];
    owners.push(udtswap_consts.UDT1Owner);
    owners.push(udtswap_consts.UDT2Owner);
    let i = 0;
    await deploy_scripts.init();
    while(i<2) {
        let minted_tx = await deploy_scripts.mintUDT(owners[i]);
        while(true) {
            let confirmed = await udtswap_utils.getLiveCellStatus(udtswap_consts.nodeUrl, {
                index: "0x0",
                tx_hash: minted_tx.txHash
            });
            if(confirmed) break;
            await udtswap_utils.sleep(1000);
        }
        i+=1;
    }
}

let idx = parseInt(process.argv[2]);
if(idx==0) deploy();
else if(idx==1) update();
else mint();