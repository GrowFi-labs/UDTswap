var udtswap_consts = require('./udtswap_consts.js');
var udtswap_utils = require('./udtswap_utils.js');

const deploy_scripts = {
    init: function() {
        udtswap_consts.ckb = new udtswap_consts.CKB(udtswap_consts.nodeUrl);
        udtswap_consts.pk = udtswap_consts.ckb.utils.privateKeyToPublicKey(udtswap_consts.sk);
        udtswap_consts.pkh = `0x${udtswap_consts.ckb.utils.blake160(udtswap_consts.pk, 'hex')}`;
        udtswap_consts.addr = udtswap_consts.ckb.utils.privateKeyToAddress(udtswap_consts.sk, {prefix: 'ckt'});
        udtswap_consts.lockScript = {
            hashType: 'type',
            codeHash: udtswap_consts.nervosDefaultLockCodeHash,
            args: udtswap_consts.pkh,
        };
        udtswap_consts.lockHash = udtswap_consts.ckb.utils.scriptToHash(udtswap_consts.lockScript);
        udtswap_consts.readFileAsync = udtswap_consts.util.promisify(udtswap_consts.fs.readFile);
    },

    deploy_type_id_script: async function(scripthexdata, startblock, capacity, fee) {
        const secp256k1Dep = await udtswap_consts.ckb.loadSecp256k1Dep();
        let unspentCells = await udtswap_consts.ckb.loadCells({
            start: BigInt(startblock),
            lockHash: udtswap_consts.lockHash
        });

        unspentCells = unspentCells.filter((unspentCell) => {
            return unspentCell.type == null;
        });

        const rawTransaction = udtswap_consts.ckb.generateRawTransaction({
            fromAddress: udtswap_consts.addr,
            toAddress: udtswap_consts.addr,
            capacity: BigInt(capacity),
            fee: BigInt(fee),
            safeMode: false,
            cells: unspentCells,
            deps: secp256k1Dep,
        });

        rawTransaction.witnesses[0] = {
            lock: '',
            inputType: '',
            outputType: ''
        };

        const type_id_hash = udtswap_consts.ckb.utils.blake2b(32, null, null, udtswap_consts.ckb.utils.PERSONAL);

        const outpoint_struct = new Map([['txHash', rawTransaction.inputs[0].previousOutput.txHash], ['index', udtswap_consts.ckb.utils.toHexInLittleEndian(rawTransaction.inputs[0].previousOutput.index)]]);
        const serialized_outpoint = udtswap_consts.ckb.utils.serializeStruct(outpoint_struct);
        const serialized_since = udtswap_consts.ckb.utils.toHexInLittleEndian(rawTransaction.inputs[0].since, 8);
        const input_struct = new Map([['since', serialized_since], ['previousOutput', serialized_outpoint]])
        const input_serialized = udtswap_consts.ckb.utils.serializeStruct(input_struct);

        type_id_hash.update(udtswap_consts.ckb.utils.hexToBytes(input_serialized));
        type_id_hash.update(udtswap_consts.ckb.utils.hexToBytes("0x0000000000000000")); //same index with type id output
        const script_args = `0x${type_id_hash.digest('hex')}`;

        rawTransaction.outputs[0].type = {
            hashType: 'type',
            codeHash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
            args: script_args,
        };

        rawTransaction.outputsData[0] = scripthexdata;

        const signedTx = udtswap_consts.ckb.signTransaction(udtswap_consts.sk)(rawTransaction);
        const realTxHash = await udtswap_consts.ckb.rpc.sendTransaction(signedTx, "passthrough");
        return {
            txHash: realTxHash,
            type: rawTransaction.outputs[0].type
        };
    },

    update_type_id_script: async function(scripthexdata, type_script, startblock, capacity, fee) {
        const secp256k1Dep = await udtswap_consts.ckb.loadSecp256k1Dep();
        let unspentCells = await udtswap_consts.ckb.loadCells({
            start: BigInt(startblock),
            lockHash: udtswap_consts.lockHash
        });

        unspentCells = unspentCells.filter((unspentCell) => {
            return ((unspentCell.type == null && unspentCell.outputDataLen == '0x0') || (unspentCell.type != null && unspentCell.type.args == type_script.args));
        });

        const rawTransaction = udtswap_consts.ckb.generateRawTransaction({
            fromAddress: udtswap_consts.addr,
            toAddress: udtswap_consts.addr,
            capacity: BigInt(capacity),
            fee: BigInt(fee),
            safeMode: false,
            cells: unspentCells,
            deps: secp256k1Dep,
        });

        rawTransaction.witnesses[0] = {
            lock: '',
            inputType: '',
            outputType: ''
        };

        rawTransaction.outputs[0].type = type_script;

        rawTransaction.outputsData[0] = scripthexdata;

        const signedTx = udtswap_consts.ckb.signTransaction(udtswap_consts.sk)(rawTransaction);

        const realTxHash = await udtswap_consts.ckb.rpc.sendTransaction(signedTx, "passthrough");
        return {
            txHash: realTxHash,
            type: rawTransaction.outputs[0].type
        };
    },

    deploy_udtswap: async function(udtswap) {
        let data = await udtswap_consts.readFileAsync("../../UDTswap_scripts/"+udtswap);

        const scripthexdata = udtswap_consts.ckb.utils.bytesToHex(data);
        let capacity = 7000000000000;
        let fee = 70000;
        if(udtswap=="UDTswap_lock_udt_based") {
            capacity = 1200000000000;
            fee = 12000;
        } else if(udtswap=="UDTswap_liquidity_UDT_udt_based" || udtswap=="test_udt") {
            capacity = 4300000000000;
            fee = 43000;
        }
        return await deploy_scripts.deploy_type_id_script(scripthexdata, 0, capacity, fee);
    },

    update_udtswap: async function(udtswap) {
        let data = await udtswap_consts.readFileAsync("../../UDTswap_scripts/"+udtswap);

        const udtswap_type = {
            args: "0x29ac397f886d4b1e43e95bba8cbf8ef001dcd2c7ddd4be40006657077f695048",
            codeHash: "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: 'type'
        };

        const udtswap_liquidity_udt = {
            args: "0x99fcef845821e3b7d07ffcb506c42248a8e058c2b4e9739feb115e018632df31",
            codeHash: "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type"
        };

        const udtswap_lock = {
            args: "0xf8cd399bbf921f269befd1587b23c37ea70437611d8d66c535ee8cb0d5662b4b",
            codeHash: "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type"
        };

        const test_udt = {
            args : "0x3635a5170f531438534087126a97cafc72316393374aa2f6489ddcd6c469dbca",
            codeHash : "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType : "type"
        };

        const scripthexdata = udtswap_consts.ckb.utils.bytesToHex(data);

        let type_script = udtswap_type;
        let startblock = 0;
        let capacity = 7000000000000;
        let fee = 70000;
        if(udtswap == "UDTswap_liquidity_UDT_udt_based" || udtswap == "test_udt") {
            if(udtswap == "test_udt") {
                type_script = test_udt;
            } else {
                type_script = udtswap_liquidity_udt;
            }
            capacity = 4300000000000;
            fee = 43000;
        } else if(udtswap == "UDTswap_lock_udt_based") {
            type_script = udtswap_lock;
            capacity = 1200000000000;
            fee = 12000;
        }

        return await deploy_scripts.update_type_id_script(scripthexdata, type_script, startblock, capacity, fee);
    },

    mintUDT: async function(sk) {
        let pk = udtswap_consts.ckb.utils.privateKeyToPublicKey(sk);
        let pkh = `0x${udtswap_consts.ckb.utils.blake160(pk, 'hex')}`;
        let addr = udtswap_consts.ckb.utils.privateKeyToAddress(sk, {prefix: 'ckt'});
        let lockScript = {
            hashType: 'type',
            codeHash: udtswap_consts.nervosDefaultLockCodeHash,
            args: pkh,
        };
        let lockHash = udtswap_consts.ckb.utils.scriptToHash(lockScript);

        let to_addr = udtswap_consts.ckb.utils.privateKeyToAddress(udtswap_consts.skTesting, {prefix: 'ckt'});

        const secp256k1Dep = await udtswap_consts.ckb.loadSecp256k1Dep();
        let unspentCells = await udtswap_consts.ckb.loadCells({
            start: BigInt(0),
            lockHash: lockHash
        });

        unspentCells = unspentCells.filter((unspentCell) => {
            return unspentCell.type == null;
        });

        const rawTransaction = udtswap_consts.ckb.generateRawTransaction({
            fromAddress: addr,
            toAddress: to_addr,
            capacity: BigInt(14300000000),
            fee: BigInt(1000),
            safeMode: false,
            cells: unspentCells,
            deps: secp256k1Dep,
        });

        rawTransaction.witnesses[0] = {
            lock: '',
            inputType: '',
            outputType: ''
        };

        rawTransaction.cellDeps.push(udtswap_consts.testUDTDeps);

        const testUDTScript = udtswap_consts.testUDTType;
        const testUDTCodeHash = udtswap_consts.ckb.utils.scriptToHash(testUDTScript);

        rawTransaction.outputs[0].type = {
            codeHash: testUDTCodeHash,
            hashType: "type",
            args: lockHash,
        };
        rawTransaction.outputsData[0] = udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt("10000000000000000000000000000"))).padEnd(34, '0');


        const signedTx = udtswap_consts.ckb.signTransaction(sk)(rawTransaction);
        const realTxHash = await udtswap_consts.ckb.rpc.sendTransaction(signedTx, "passthrough");
        return {
            txHash: realTxHash
        }
    },
};


module.exports = deploy_scripts;

