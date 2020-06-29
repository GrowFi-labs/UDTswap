const udtswap_consts = {
    bigdecimal: require("bigdecimal"),
    CKB: require('@nervosnetwork/ckb-sdk-core').default,
    CKBUtils: require('@nervosnetwork/ckb-sdk-utils'),
    request: require('request'),
    UDTSwapTypeCodeHash : "0xde1197f85227fd76e9c5629277d2ea8702601c27bf8c2513905616173196d985",
    UDTSwapLockCodeHash : "0xdfa3e9c9cb77091bec6b1eac1a6a309c45d35604c9ccc7718bdf26dc60bfcf94",
    UDTSwapLiquidityUDTCodeHash : "0x38fdec05b05b48dbf39dbc0959421a659809e07ffddf54bcb6121faecf38119c",
    UDTSwapTypeDeps : {
        'tx_hash' : "0x83487fcb7741c830a65e0dfe471e184710cf5f0c3dd414d5a0a82d927080b80b",
        'index' : "0x0"
    },
    UDTSwapLockDeps : {
        'tx_hash' : "0xbf04cdd2a766589d213631e0c7477f0392f8deb046003ae51d0e69c2470d3618",
        'index' : "0x0"
    },
    UDTSwapLiquidityUDTDeps : {
        'tx_hash' : "0xf30ed39aaf8640c9e920fe8b889b3da8ebc2046621543b570e358dbdee096633",
        'index' : "0x0"
    },
    UDT1Owner : '',
    UDT2Owner : '',
    skTesting : '',
    testUDTType : {
        hashType: 'type',
        codeHash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
        args: '0x3635a5170f531438534087126a97cafc72316393374aa2f6489ddcd6c469dbca'
    },
    testUDTDeps : {
        outPoint: {
            txHash: "0xf322318a51793501d76e176bea8c83d394c5c57d3d64de5e1e0d5c148afe5029",
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
    nodeUrl: '',
    sk: '',
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