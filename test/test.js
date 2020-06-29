const assert = require('assert');

const udtswap_tx = require('../src/udtswap_tx.js');
const udtswap_utils = require('../src/udtswap_utils.js');
const udtswap_consts = require('../src/udtswap_consts.js');

describe('#UDTSwap test', function() {
    let ckbAsUDT = {
        args: "0x",
        code_hash: udtswap_consts.ckbTypeHash,
        data_without_amount: "",
        hash_type: "type",
        udt_deps_dep_type: "code",
        udt_deps_tx_hash: "0x",
        udt_deps_tx_index: -1,
        udt_typehash: udtswap_consts.ckbTypeHash,
    };

    let currentUDT1 = {
        args: null,
        code_hash: null,
        data_without_amount: "",
        hash_type: "type",
        udt_deps_dep_type: "code",
        udt_deps_tx_hash: null,
        udt_deps_tx_index: 0,
        udt_typehash: null,
    };

    let currentUDT2 = {
        args: null,
        code_hash: null,
        data_without_amount: "",
        hash_type: "type",
        udt_deps_dep_type: "code",
        udt_deps_tx_hash: null,
        udt_deps_tx_index: 0,
        udt_typehash: null,
    };

    let currentPoolCKB = {
        live_tx_hash: null,
        live_tx_index: 0,
        total_liquidity: null,
        tx_input_0: null,
        udt1_actual_reserve: null,
        udt1_reserve: null,
        udt1_typehash: null,
        udt2_actual_reserve: null,
        udt2_reserve: null,
        udt2_typehash: null,
    };

    let currentPool = {
        live_tx_hash: null,
        live_tx_index: 0,
        total_liquidity: null,
        tx_input_0: null,
        udt1_actual_reserve: null,
        udt1_reserve: null,
        udt1_typehash: null,
        udt2_actual_reserve: null,
        udt2_reserve: null,
        udt2_typehash: null,
    };

    let tx_amount1 = null;
    let tx_amount2 = null;
    let tx_amount3 = null;
    let secret_key = udtswap_consts.skTesting;
    let to_addr = null;
    let is_rev = false;

    let tx_amount1_arr = [];
    let tx_amount2_arr = [];
    let tx_amount3_arr = [];
    let currentUDT1Arr = [];
    let currentUDT2Arr = [];
    let currentPoolArr = [];
    let isRevArr = [];

    function addPool(txAmount1, txAmount2, txAmount3, CurrentUDT1, CurrentUDT2, CurrentPool, isRev) {
        tx_amount1_arr.push(txAmount1);
        tx_amount2_arr.push(txAmount2);
        tx_amount3_arr.push(txAmount3);
        currentUDT1Arr.push(CurrentUDT1);
        currentUDT2Arr.push(CurrentUDT2);
        currentPoolArr.push(CurrentPool);
        isRevArr.push(isRev);
    }

    async function sendTransaction(idx) {
        return await udtswap_tx.sendTransaction(
            idx,
            udtswap_consts.nodeUrl,
            '0x0',
            secret_key,
            tx_amount1_arr,
            tx_amount2_arr,
            tx_amount3_arr,
            currentUDT1Arr,
            currentUDT2Arr,
            currentPoolArr,
            isRevArr,
            to_addr
        );
    }

    function getTransactionRes(transaction, idx) {
        const outputsData = transaction.outputs_data;
        const UDTSwapCellOutputData = outputsData[idx];

        const afterUDT1Reserve = BigInt(udtswap_utils.changeEndianness(UDTSwapCellOutputData.substr(0, 34)));
        const afterUDT2Reserve = BigInt(udtswap_utils.changeEndianness('0x'+UDTSwapCellOutputData.substr(34, 32)));
        const afterTotalLiquidity = BigInt(udtswap_utils.changeEndianness('0x'+UDTSwapCellOutputData.substr(66)));

        return {
            udt1_reserve: afterUDT1Reserve,
            udt2_reserve: afterUDT2Reserve,
            total_liquidity: afterTotalLiquidity
        }
    }

    async function checkAmounts(CurrentPool, txHash, idx) {
        let confirmed = false;
        while(true) {
            confirmed = await udtswap_utils.getLiveCellStatus(udtswap_consts.nodeUrl, {
                index: "0x0",
                tx_hash: txHash
            });
            if(confirmed) break;
            await udtswap_utils.sleep(1000);
        }

        let txRes = await udtswap_utils.getTransactionRPC(udtswap_consts.nodeUrl, txHash);
        let poolAmounts = getTransactionRes(txRes.transaction, idx);
        assert.equal(String(CurrentPool.udt1_reserve), String(poolAmounts.udt1_reserve));
        assert.equal(String(CurrentPool.udt2_reserve), String(poolAmounts.udt2_reserve));
        assert.equal(String(CurrentPool.total_liquidity), String(poolAmounts.total_liquidity));
    }

    before(function() {
        udtswap_consts.ckb = new udtswap_consts.CKB(udtswap_consts.nodeUrl);

        let pk = udtswap_consts.ckb.utils.privateKeyToPublicKey(udtswap_consts.UDT1Owner);
        let pkh = `0x${udtswap_consts.ckb.utils.blake160(pk, 'hex')}`;
        let lockScript = {
            hashType: 'type',
            codeHash: udtswap_consts.nervosDefaultLockCodeHash,
            args: pkh,
        };
        let lockHash = udtswap_consts.ckb.utils.scriptToHash(lockScript);

        currentUDT1.args = lockHash;
        currentUDT1.code_hash = udtswap_consts.ckb.utils.scriptToHash(udtswap_consts.testUDTType);
        currentUDT1.udt_deps_tx_hash = udtswap_consts.testUDTDeps.outPoint.txHash;
        currentUDT1.udt_typehash = udtswap_consts.ckb.utils.scriptToHash({
            hashType: currentUDT1.hash_type,
            codeHash: currentUDT1.code_hash,
            args: currentUDT1.args,
        });



        pk = udtswap_consts.ckb.utils.privateKeyToPublicKey(udtswap_consts.UDT2Owner);
        pkh = `0x${udtswap_consts.ckb.utils.blake160(pk, 'hex')}`;
        lockScript = {
            hashType: 'type',
            codeHash: udtswap_consts.nervosDefaultLockCodeHash,
            args: pkh,
        };
        lockHash = udtswap_consts.ckb.utils.scriptToHash(lockScript);

        currentUDT2.args = lockHash;
        currentUDT2.code_hash = udtswap_consts.ckb.utils.scriptToHash(udtswap_consts.testUDTType);
        currentUDT2.udt_deps_tx_hash = udtswap_consts.testUDTDeps.outPoint.txHash;
        currentUDT2.udt_typehash = udtswap_consts.ckb.utils.scriptToHash({
            hashType: currentUDT2.hash_type,
            codeHash: currentUDT2.code_hash,
            args: currentUDT2.args,
        });

        if(BigInt(currentUDT1.udt_typehash)>=BigInt(currentUDT2.udt_typehash)) {
            let temp = currentUDT1;
            currentUDT1 = currentUDT2;
            currentUDT2 = temp;
        }
    });

    afterEach(async function() {
        tx_amount1 = null;
        tx_amount2 = null;
        tx_amount3 = null;
        to_addr = null;
        is_rev = false;

        tx_amount1_arr = [];
        tx_amount2_arr = [];
        tx_amount3_arr = [];
        currentUDT1Arr = [];
        currentUDT2Arr = [];
        currentPoolArr = [];
        isRevArr = [];
    });

    it('# UDT / UDT Pool creation', async function() {
        this.timeout(60*1000);

        tx_amount1 = currentUDT1.udt_typehash;
        tx_amount2 = currentUDT2.udt_typehash;
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT1, currentUDT2, '', is_rev);

        let result = await sendTransaction(3);
        currentPool.tx_input_0 = result.inputSerialized;
        currentPool.live_tx_hash = result.TxHash;
        currentPool.total_liquidity = 0;
        currentPool.udt1_typehash = currentUDT1.udt_typehash;
        currentPool.udt2_typehash = currentUDT2.udt_typehash;
        currentPool.udt1_reserve = udtswap_consts.udtMinimum;
        currentPool.udt2_reserve = udtswap_consts.udtMinimum;
        currentPool.udt1_actual_reserve = '0';
        currentPool.udt2_actual_reserve = '0';

        await checkAmounts(currentPool, result.TxHash, 0);
    });

    it('# UDT / UDT Pool add liquidity initial', async function() {
        this.timeout(60*1000);

        tx_amount1 = '100000000';
        tx_amount2 = '500000000';
        tx_amount3 = '100000000';
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT1, currentUDT2, currentPool, is_rev);

        let result = await sendTransaction(1);
        currentPool.live_tx_hash = result.TxHash;
        currentPool.total_liquidity = String(BigInt(tx_amount3));
        currentPool.udt1_actual_reserve = String(BigInt(tx_amount1));
        currentPool.udt2_actual_reserve = String(BigInt(tx_amount2));
        currentPool.udt1_reserve = String(BigInt(currentPool.udt1_reserve)+BigInt(tx_amount1));
        currentPool.udt2_reserve = String(BigInt(currentPool.udt2_reserve)+BigInt(tx_amount2));

        await checkAmounts(currentPool, result.TxHash, 0);
    });

    it('# UDT / UDT Pool add liquidity', async function() {
        this.timeout(60*1000);

        tx_amount1 = '100000000';
        let liquidity = udtswap_utils.calculateAddLiquidityUDT2Amount(currentPool, tx_amount1);
        tx_amount2 = liquidity.udt2_amount;
        tx_amount3 = liquidity.user_liquidity;
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT1, currentUDT2, currentPool, is_rev);

        let result = await sendTransaction(1);
        currentPool.live_tx_hash = result.TxHash;
        currentPool.total_liquidity = String(BigInt(currentPool.total_liquidity)+BigInt(tx_amount3));
        currentPool.udt1_actual_reserve = String(BigInt(currentPool.udt1_actual_reserve)+BigInt(tx_amount1));
        currentPool.udt2_actual_reserve = String(BigInt(currentPool.udt2_actual_reserve)+BigInt(tx_amount2));
        currentPool.udt1_reserve = String(BigInt(currentPool.udt1_reserve)+BigInt(tx_amount1));
        currentPool.udt2_reserve = String(BigInt(currentPool.udt2_reserve)+BigInt(tx_amount2));

        await checkAmounts(currentPool, result.TxHash, 0);
    });

    it('# UDT / UDT Pool swap', async function() {
        this.timeout(60*1000);

        tx_amount1 = '1234567';
        tx_amount2 = udtswap_utils.SwapOutput(currentPool, tx_amount1, is_rev);
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT1, currentUDT2, currentPool, is_rev);

        let result = await sendTransaction(0);
        currentPool.live_tx_hash = result.TxHash;
        currentPool.udt1_actual_reserve = String(BigInt(currentPool.udt1_actual_reserve)+BigInt(tx_amount1));
        currentPool.udt2_actual_reserve = String(BigInt(currentPool.udt2_actual_reserve)-BigInt(tx_amount2));
        currentPool.udt1_reserve = String(BigInt(currentPool.udt1_reserve)+BigInt(tx_amount1));
        currentPool.udt2_reserve = String(BigInt(currentPool.udt2_reserve)-BigInt(tx_amount2));

        await checkAmounts(currentPool, result.TxHash, 0);
    });

    it('# UDT / UDT Pool swap reverse', async function() {
        this.timeout(60*1000);
        
        is_rev = true;
        tx_amount1 = '1234567';
        tx_amount2 = udtswap_utils.SwapOutput(currentPool, tx_amount1, is_rev);
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT2, currentUDT1, currentPool, is_rev);

        let result = await sendTransaction(0);
        currentPool.live_tx_hash = result.TxHash;
        currentPool.udt1_actual_reserve = String(BigInt(currentPool.udt1_actual_reserve)-BigInt(tx_amount2));
        currentPool.udt2_actual_reserve = String(BigInt(currentPool.udt2_actual_reserve)+BigInt(tx_amount1));
        currentPool.udt1_reserve = String(BigInt(currentPool.udt1_reserve)-BigInt(tx_amount2));
        currentPool.udt2_reserve = String(BigInt(currentPool.udt2_reserve)+BigInt(tx_amount1));

        await checkAmounts(currentPool, result.TxHash, 0);
    });

    it('# UDT / UDT Pool remove liquidity', async function() {
        this.timeout(60*1000);

        tx_amount1 = '1234567';
        let liquidity = udtswap_utils.calculateRemoveLiquidityAmount(currentPool, tx_amount1);
        tx_amount2 = liquidity.udt1_amount;
        tx_amount3 = liquidity.udt2_amount;
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT1, currentUDT2, currentPool, is_rev);

        let result = await sendTransaction(2);
        currentPool.live_tx_hash = result.TxHash;
        currentPool.total_liquidity = String(BigInt(currentPool.total_liquidity) - BigInt(tx_amount1));
        currentPool.udt1_actual_reserve = String(BigInt(currentPool.udt1_actual_reserve)-BigInt(tx_amount2));
        currentPool.udt2_actual_reserve = String(BigInt(currentPool.udt2_actual_reserve)-BigInt(tx_amount3));
        currentPool.udt1_reserve = String(BigInt(currentPool.udt1_reserve)-BigInt(tx_amount2));
        currentPool.udt2_reserve = String(BigInt(currentPool.udt2_reserve)-BigInt(tx_amount3));

        await checkAmounts(currentPool, result.TxHash, 0);
    });

    it('# CKB / UDT Pool creation', async function() {
        this.timeout(60*1000);

        tx_amount1 = ckbAsUDT.udt_typehash;
        tx_amount2 = currentUDT2.udt_typehash;
        addPool(tx_amount1, tx_amount2, tx_amount3, ckbAsUDT, currentUDT2, '', is_rev);

        let result = await sendTransaction(3);
        currentPoolCKB.tx_input_0 = result.inputSerialized;
        currentPoolCKB.live_tx_hash = result.TxHash;
        currentPoolCKB.total_liquidity = 0;
        currentPoolCKB.udt1_typehash = ckbAsUDT.udt_typehash;
        currentPoolCKB.udt2_typehash = currentUDT2.udt_typehash;
        currentPoolCKB.udt1_reserve = udtswap_consts.ckbLockCellMinimum;
        currentPoolCKB.udt2_reserve = udtswap_consts.udtMinimum;
        currentPoolCKB.udt1_actual_reserve = '0';
        currentPoolCKB.udt2_actual_reserve = '0';

        await checkAmounts(currentPoolCKB, result.TxHash, 0);
    });

    it('# CKB / UDT Pool add liquidity initial', async function() {
        this.timeout(60*1000);

        tx_amount1 = '100000000000';
        tx_amount2 = '500000000';
        tx_amount3 = '100000000000';
        addPool(tx_amount1, tx_amount2, tx_amount3, ckbAsUDT, currentUDT2, currentPoolCKB, is_rev);

        let result = await sendTransaction(1);
        currentPoolCKB.live_tx_hash = result.TxHash;
        currentPoolCKB.total_liquidity = String(BigInt(tx_amount3));
        currentPoolCKB.udt1_actual_reserve = String(BigInt(tx_amount1));
        currentPoolCKB.udt2_actual_reserve = String(BigInt(tx_amount2));
        currentPoolCKB.udt1_reserve = String(BigInt(currentPoolCKB.udt1_reserve)+BigInt(tx_amount1));
        currentPoolCKB.udt2_reserve = String(BigInt(currentPoolCKB.udt2_reserve)+BigInt(tx_amount2));

        await checkAmounts(currentPoolCKB, result.TxHash, 0);
    });

    it('# CKB / UDT Pool add liquidity', async function() {
        this.timeout(60*1000);

        tx_amount1 = '100000000';
        let liquidity = udtswap_utils.calculateAddLiquidityUDT2Amount(currentPoolCKB, tx_amount1);
        tx_amount2 = liquidity.udt2_amount;
        tx_amount3 = liquidity.user_liquidity;
        addPool(tx_amount1, tx_amount2, tx_amount3, ckbAsUDT, currentUDT2, currentPoolCKB, is_rev);

        let result = await sendTransaction(1);
        currentPoolCKB.live_tx_hash = result.TxHash;
        currentPoolCKB.total_liquidity = String(BigInt(currentPoolCKB.total_liquidity)+BigInt(tx_amount3));
        currentPoolCKB.udt1_actual_reserve = String(BigInt(currentPoolCKB.udt1_actual_reserve)+BigInt(tx_amount1));
        currentPoolCKB.udt2_actual_reserve = String(BigInt(currentPoolCKB.udt2_actual_reserve)+BigInt(tx_amount2));
        currentPoolCKB.udt1_reserve = String(BigInt(currentPoolCKB.udt1_reserve)+BigInt(tx_amount1));
        currentPoolCKB.udt2_reserve = String(BigInt(currentPoolCKB.udt2_reserve)+BigInt(tx_amount2));

        await checkAmounts(currentPoolCKB, result.TxHash, 0);
    });

    it('# CKB / UDT Pool swap', async function() {
        this.timeout(60*1000);

        tx_amount1 = '1234567';
        tx_amount2 = udtswap_utils.SwapOutput(currentPoolCKB, tx_amount1, is_rev);
        addPool(tx_amount1, tx_amount2, tx_amount3, ckbAsUDT, currentUDT2, currentPoolCKB, is_rev);

        let result = await sendTransaction(0);
        currentPoolCKB.live_tx_hash = result.TxHash;
        currentPoolCKB.udt1_actual_reserve = String(BigInt(currentPoolCKB.udt1_actual_reserve)+BigInt(tx_amount1));
        currentPoolCKB.udt2_actual_reserve = String(BigInt(currentPoolCKB.udt2_actual_reserve)-BigInt(tx_amount2));
        currentPoolCKB.udt1_reserve = String(BigInt(currentPoolCKB.udt1_reserve)+BigInt(tx_amount1));
        currentPoolCKB.udt2_reserve = String(BigInt(currentPoolCKB.udt2_reserve)-BigInt(tx_amount2));

        await checkAmounts(currentPoolCKB, result.TxHash, 0);
    });

    it('# CKB / UDT Pool swap reverse', async function() {
        this.timeout(60*1000);

        is_rev = true;
        tx_amount1 = '200000000';
        tx_amount2 = udtswap_utils.SwapOutput(currentPoolCKB, tx_amount1, is_rev);
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT2, ckbAsUDT, currentPoolCKB, is_rev);

        let result = await sendTransaction(0);
        currentPoolCKB.live_tx_hash = result.TxHash;
        currentPoolCKB.udt1_actual_reserve = String(BigInt(currentPoolCKB.udt1_actual_reserve)-BigInt(tx_amount2));
        currentPoolCKB.udt2_actual_reserve = String(BigInt(currentPoolCKB.udt2_actual_reserve)+BigInt(tx_amount1));
        currentPoolCKB.udt1_reserve = String(BigInt(currentPoolCKB.udt1_reserve)-BigInt(tx_amount2));
        currentPoolCKB.udt2_reserve = String(BigInt(currentPoolCKB.udt2_reserve)+BigInt(tx_amount1));

        await checkAmounts(currentPoolCKB, result.TxHash, 0);
    });

    it('# CKB / UDT Pool remove liquidity', async function() {
        this.timeout(60*1000);

        tx_amount1 = '50000000000';
        let liquidity = udtswap_utils.calculateRemoveLiquidityAmount(currentPoolCKB, tx_amount1);
        tx_amount2 = liquidity.udt1_amount;
        tx_amount3 = liquidity.udt2_amount;
        addPool(tx_amount1, tx_amount2, tx_amount3, ckbAsUDT, currentUDT2, currentPoolCKB, is_rev);

        let result = await sendTransaction(2);
        currentPoolCKB.live_tx_hash = result.TxHash;
        currentPoolCKB.total_liquidity = String(BigInt(currentPoolCKB.total_liquidity)-BigInt(tx_amount1));
        currentPoolCKB.udt1_actual_reserve = String(BigInt(currentPoolCKB.udt1_actual_reserve)-BigInt(tx_amount2));
        currentPoolCKB.udt2_actual_reserve = String(BigInt(currentPoolCKB.udt2_actual_reserve)-BigInt(tx_amount3));
        currentPoolCKB.udt1_reserve = String(BigInt(currentPoolCKB.udt1_reserve)-BigInt(tx_amount2));
        currentPoolCKB.udt2_reserve = String(BigInt(currentPoolCKB.udt2_reserve)-BigInt(tx_amount3));

        await checkAmounts(currentPoolCKB, result.TxHash, 0);
    });

    it('# Multiple Pool swap', async function() {
        this.timeout(60*1000);

        tx_amount1 = '1234567';
        tx_amount2 = udtswap_utils.SwapOutput(currentPoolCKB, tx_amount1, is_rev);

        let first_pool_tx_amount1 = tx_amount1;
        let first_pool_tx_amount2 = tx_amount2;

        addPool(first_pool_tx_amount1, first_pool_tx_amount2, tx_amount3, ckbAsUDT, currentUDT2, currentPoolCKB, is_rev);

        is_rev = true;
        tx_amount1 = '1234567';
        tx_amount2 = udtswap_utils.SwapOutput(currentPool, tx_amount1, is_rev);
        addPool(tx_amount1, tx_amount2, tx_amount3, currentUDT2, currentUDT1, currentPool, is_rev);

        let result = await sendTransaction(0);
        currentPoolCKB.live_tx_hash = result.TxHash;
        currentPool.live_tx_hash = result.TxHash;

        currentPoolCKB.udt1_actual_reserve = String(BigInt(currentPoolCKB.udt1_actual_reserve)+BigInt(first_pool_tx_amount1));
        currentPoolCKB.udt2_actual_reserve = String(BigInt(currentPoolCKB.udt2_actual_reserve)-BigInt(first_pool_tx_amount2));
        currentPoolCKB.udt1_reserve = String(BigInt(currentPoolCKB.udt1_reserve)+BigInt(first_pool_tx_amount1));
        currentPoolCKB.udt2_reserve = String(BigInt(currentPoolCKB.udt2_reserve)-BigInt(first_pool_tx_amount2));

        currentPool.udt1_actual_reserve = String(BigInt(currentPool.udt1_actual_reserve)-BigInt(tx_amount2));
        currentPool.udt2_actual_reserve = String(BigInt(currentPool.udt2_actual_reserve)+BigInt(tx_amount1));
        currentPool.udt1_reserve = String(BigInt(currentPool.udt1_reserve)-BigInt(tx_amount2));
        currentPool.udt2_reserve = String(BigInt(currentPool.udt2_reserve)+BigInt(tx_amount1));

        await checkAmounts(currentPoolCKB, result.TxHash, 3);
        await checkAmounts(currentPool, result.TxHash, 0);
    });
});