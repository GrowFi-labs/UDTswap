const udtswap_consts = {
    bigdecimal: require("bigdecimal"),
    CKB: require('@nervosnetwork/ckb-sdk-core').default,
    CKBUtils: require('@nervosnetwork/ckb-sdk-utils'),
    request: require('request'),
    UDTSwapTypeCodeHash : null,
    UDTSwapLockCodeHash : null,
    UDTSwapLiquidityUDTCodeHash : null,
    UDTSwapTypeDeps : {
        'tx_hash' : null,
        'index' : "0x0"
    },
    UDTSwapLockDeps : {
        'tx_hash' : null,
        'index' : "0x0"
    },
    UDTSwapLiquidityUDTDeps : {
        'tx_hash' : null,
        'index' : "0x0"
    },
    UDT1Owner : null,
    UDT2Owner : null,
    skTesting : null,

    testUDTType : {
        hashType: 'type',
        codeHash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
        args: null
    },
    testUDTDeps : {
        outPoint: {
            txHash: null,
            index: "0x0"
        },
        depType: "code"
    },
    feePkh : "0xa3f81ce386206baf6673217a4ddc70e07b26da14",
    nervosDefaultLockCodeHash : "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    ckbTypeHash : "0x0000000000000000000000000000000000000000000000000000000000000000",
    ckbMinimum : 6100000000,
    udtMinimum : 1,
    feeAmount : 6100000000,
    txFeeMax : 10000,
    poolCellCKB : 30000000000,
    ckbLockCellMinimum : 30000000000,
    nodeUrl: 'http://127.0.0.1:8114',
    sk: null,
    fs: require('fs'),
    util: require('util'),
    readFileAsync: null,
    ckb: null,
    pk: null,
    pkh: null,
    addr: null,
    lockScript: null,
    lockHash: null,
};

module.exports = udtswap_consts;