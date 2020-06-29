var udtswap_consts = require('./udtswap_consts.js');
var udtswap_utils = require('./udtswap_utils.js');
var udtswap_tx_utils = require('./udtswap_tx_utils.js');

const udtswap_tx = {
    getAmountsBeforeLiveCell: function(
        nodeUrl,
        tx_idx,
        txAmount1,
        txAmount2,
        txAmount3,
        currentUDT1,
        currentUDT2,
        currentPool,
        isRev
    ) {
        let udtTypeHashs = currentUDT1.udt_typehash + currentUDT2.udt_typehash.substr(2);
        if(isRev) {
            udtTypeHashs = currentUDT2.udt_typehash + currentUDT1.udt_typehash.substr(2);
        }
        let poolLockHash = udtswap_utils.scriptToHash(
            nodeUrl,
            "type",
            udtswap_consts.UDTSwapLockCodeHash,
            udtTypeHashs
        );
        let liquidityUDTTypeHash = currentPool=='' ? null : udtswap_utils.scriptToHash(
            nodeUrl,
            "type",
            udtswap_consts.UDTSwapLiquidityUDTCodeHash,
            poolLockHash + currentPool.tx_input_0.substr(2)
        );
        let udt1Actual = txAmount1;
        let udt1TypeHash = currentUDT1.udt_typehash;
        let udt2Actual = txAmount2;
        let udt2TypeHash = currentUDT2.udt_typehash;
        let liquidityUDTActual = txAmount3;
        if(tx_idx==0) {
            liquidityUDTTypeHash = null;
            liquidityUDTActual = 0;

            udt2TypeHash = null;
        } else if(tx_idx==1) {
            liquidityUDTTypeHash = null;
        } else if(tx_idx==2) {
            liquidityUDTActual = txAmount1;
            udt1Actual = txAmount2;
            udt2Actual = txAmount3;

            udt1TypeHash = null;
            udt2TypeHash = null;
        } else if(tx_idx==3) {
            liquidityUDTActual = 0;
            liquidityUDTTypeHash = null;
            udt1Actual = BigInt(udt1TypeHash)==0 ? udtswap_consts.ckbLockCellMinimum : udtswap_consts.udtMinimum;
            udt2Actual = BigInt(udt2TypeHash)==0 ? udtswap_consts.ckbLockCellMinimum : udtswap_consts.udtMinimum;
        }
        return {
            udt1Actual: udt1Actual,
            udt1TypeHash: udt1TypeHash,
            udt2Actual: udt2Actual,
            udt2TypeHash: udt2TypeHash,
            liquidityUDTActual: liquidityUDTActual,
            liquidityUDTTypeHash: liquidityUDTTypeHash
        };
    },
    getAmountsAfterLiveCell: function(
        tx_idx,
        currentUDT1,
        currentUDT2,
        ckbInput,
        ckbActual,
        udt1Input,
        udt1Actual,
        udt2Input,
        udt2Actual,
        liquidityUDTInput,
        liquidityUDTActual,
        isRev
    ) {
        let isError = false;
        if(
            (ckbActual != 0
                && ckbInput <= ckbActual) ||
            (tx_idx!=2
                && udt1Input <= udt1Actual) ||
            (tx_idx!=0
                && tx_idx!=2
                && udt2Input <= udt2Actual) ||
            (tx_idx!=1
                && liquidityUDTActual != 0
                && liquidityUDTInput <= liquidityUDTActual)
        ) {
            isError = true;
        }

        let udt1Amount =
            isRev ? {
                input: udt2Input,
                actual: udt2Actual
            } : {
                input: udt1Input,
                actual: udt1Actual
            };
        let udt2Amount =
            isRev ? {
                input: udt1Input,
                actual: udt1Actual
            } : {
                input: udt2Input,
                actual: udt2Actual
            };
        let udt1Info = isRev ? currentUDT2 : currentUDT1;
        let udt2Info = isRev ? currentUDT1 : currentUDT2;
        let liquidityUDTAmount = {
            input: liquidityUDTInput,
            actual: liquidityUDTActual
        };
        return {
            error: isError,
            udt1Amount: udt1Amount,
            udt2Amount: udt2Amount,
            udt1Info: udt1Info,
            udt2Info: udt2Info,
            liquidityUDTAmount: liquidityUDTAmount
        };
    },
    sendTransaction: async function(
        tx_idx,
        nodeUrl,
        currentBlock,
        sk,
        txAmount1,
        txAmount2,
        txAmount3,
        currentUDT1,
        currentUDT2,
        currentPool,
        isRev,
        toAddr
    ) {
        toAddr = (toAddr == '' ? null : toAddr);

        const ckb = new udtswap_consts.CKB(nodeUrl);
        let addr = ckb.utils.privateKeyToAddress(sk, {prefix: 'ckt'});
        let pkh = `0x${ckb.utils.blake160(ckb.utils.privateKeyToPublicKey(sk), 'hex')}`;
        let lockHash = ckb.utils.scriptToHash({
            hashType: "type",
            codeHash: udtswap_consts.nervosDefaultLockCodeHash,
            args: pkh
        });

        let liquidityUDTTypeHash;
        let ckbActual = BigInt(150000000000);
        let udt1Actual = [];
        let udt1TypeHash = [];
        let udt2Actual = [];
        let udt2TypeHash = [];
        let liquidityUDTActual;
        let poolCnt = currentUDT1.length;
        let i = 0;
        while(i<poolCnt) {
            let AmountsBeforeLiveCell = udtswap_tx.getAmountsBeforeLiveCell(
                nodeUrl,
                tx_idx,
                txAmount1[i],
                txAmount2[i],
                txAmount3[i],
                currentUDT1[i],
                currentUDT2[i],
                currentPool[i],
                isRev[i]
            );
            udt1Actual.push(AmountsBeforeLiveCell.udt1Actual);
            udt2Actual.push(AmountsBeforeLiveCell.udt2Actual);
            udt1TypeHash.push(AmountsBeforeLiveCell.udt1TypeHash);
            udt2TypeHash.push(AmountsBeforeLiveCell.udt2TypeHash);
            liquidityUDTActual = AmountsBeforeLiveCell.liquidityUDTActual;
            liquidityUDTTypeHash = AmountsBeforeLiveCell.liquidityUDTTypeHash;
            i+=1;
        }

        let liveCellResult = await udtswap_tx_utils.getLiveCells(
            ckb,
            lockHash,
            BigInt(currentBlock) - BigInt(100000) < BigInt(0) ? 0 : BigInt(currentBlock) - BigInt(100000),
            udt1TypeHash,
            udt2TypeHash,
            liquidityUDTTypeHash,
            ckbActual,
            udt1Actual,
            udt2Actual,
            liquidityUDTActual
        );

        let udt1Amount = [];
        let udt2Amount = [];
        let udt1Info = [];
        let udt2Info = [];
        let liquidityUDTAmount;
        i = 0;
        while(i<poolCnt) {
            let AmountsAfterLiveCell = udtswap_tx.getAmountsAfterLiveCell(
                tx_idx,
                currentUDT1[i],
                currentUDT2[i],
                liveCellResult.ckbInput,
                ckbActual,
                liveCellResult.udt1Input[i],
                udt1Actual[i],
                liveCellResult.udt2Input[i],
                udt2Actual[i],
                liveCellResult.liquidityUDTInput,
                liquidityUDTActual,
                isRev[i]
            );
            if(AmountsAfterLiveCell.error) {
                break;
            }
            udt1Amount.push(AmountsAfterLiveCell.udt1Amount);
            udt2Amount.push(AmountsAfterLiveCell.udt2Amount);
            udt1Info.push(AmountsAfterLiveCell.udt1Info);
            udt2Info.push(AmountsAfterLiveCell.udt2Info);
            liquidityUDTAmount = AmountsAfterLiveCell.liquidityUDTAmount;
            i+=1;
        }
        if(i!=poolCnt) {
            return {
                error: "not enough live cell amount "+i,
                TxHash: null,
                inputSerialized: null
            };
        }

        let rawTransaction = await udtswap_tx_utils.generateRawTx(
            ckb,
            liveCellResult.unspentCells,
            liveCellResult.ckbInput,
            addr,
            poolCnt
        );
        rawTransaction = udtswap_tx_utils.setFeeCell(rawTransaction);
        let input_serialized = null;
        if(tx_idx==3) {
            input_serialized = udtswap_tx_utils.getSerializedFirstInput(
                rawTransaction,
                ckb,
                liveCellResult.ckbCellIndex
            );
        }

        i=0;
        while(i<poolCnt) {
            if(tx_idx!=3) {
                rawTransaction = udtswap_tx_utils.setPoolCellsInput(
                    rawTransaction,
                    currentPool[i]
                );
            }
            rawTransaction = udtswap_tx_utils.setPoolCellsOutput(
                rawTransaction,
                tx_idx,
                udt1Info[i],
                udt2Info[i],
                currentPool[i],
                input_serialized
            );
            rawTransaction = udtswap_tx_utils.setResultOutputCells(
                rawTransaction,
                ckb,
                tx_idx,
                udt1Info[i],
                udt2Info[i],
                currentPool[i],
                pkh,
                toAddr,
                isRev[i]
            );
            rawTransaction = udtswap_tx_utils.setResultDataAndCapacity(
                rawTransaction,
                tx_idx,
                udt1Amount[i],
                udt2Amount[i],
                liquidityUDTAmount,
                udt1Info[i],
                udt2Info[i],
                currentPool[i],
                isRev[i]
            );
            rawTransaction = udtswap_tx_utils.setDeps(
                rawTransaction,
                tx_idx,
                udt1Info[i],
                udt2Info[i]
            );
            i += 1;
        }
        let txHash = await udtswap_tx_utils.setTxFeeAndSign(
            rawTransaction,
            ckb,
            tx_idx,
            udt1Info,
            udt2Info,
            currentPool,
            poolCnt,
            sk
        );

        return {
            error: null,
            TxHash: txHash,
            inputSerialized: input_serialized
        };
    },
}

module.exports = udtswap_tx;
