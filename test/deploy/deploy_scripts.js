const deploy_udtswap = require("../../src/deploy_udtswap.js");
const udtswap_utils = require("../../src/udtswap_utils.js");
const udtswap_consts = require("../../src/udtswap_consts.js");

async function only_get() {
    await deploy_udtswap.init();
    await deploy_udtswap.get_all_code_hashes(0);
}

async function only_deploy() {
    let scripts = [
        "UDTswap_udt_based",
        "UDTswap_lock_udt_based",
        "UDTswap_liquidity_UDT_udt_based",
        "test_udt"
    ];
    let i = 0;
    await deploy_udtswap.init();
    while(i<4) {
        let deployed_tx = await deploy_udtswap.only_deploy_udtswap(scripts[i]);
        while(true) {
            let confirmed = await udtswap_utils.getLiveCellStatus(udtswap_consts.nodeUrl, {
                index: "0x0",
                tx_hash: deployed_tx.txHash
            });
            if(confirmed) break;
            await udtswap_utils.sleep(1000);
        }
        udtswap_utils.writeConsts(1, deployed_tx.type);
        udtswap_utils.writeConsts(2, deployed_tx.txHash);
        i+=1;
    }
    await mint();
}

async function mint() {
    let owners = [];
    owners.push(udtswap_consts.UDT1Owner);
    owners.push(udtswap_consts.UDT2Owner);
    let i = 0;
    await deploy_udtswap.init();
    while(i<2) {
        let minted_tx = await deploy_udtswap.mintUDT(owners[i]);
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
if(idx==0) only_get();
else if(idx==1) only_deploy();