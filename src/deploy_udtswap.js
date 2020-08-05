var udtswap_consts = require('./udtswap_consts.js');
var udtswap_utils = require('./udtswap_utils.js');
const fs = require('fs');

const deploy_udtswap = {
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

    get_type_id_args : function (input) {
        let type_id_hash = udtswap_consts.ckb.utils.blake2b(32, null, null, udtswap_consts.ckb.utils.PERSONAL);

        let outpoint_struct = new Map([['txHash', input.txHash], ['index', udtswap_consts.ckb.utils.toHexInLittleEndian(input.index)]]);
        let serialized_outpoint = udtswap_consts.ckb.utils.serializeStruct(outpoint_struct);
        let serialized_since = udtswap_consts.ckb.utils.toHexInLittleEndian("0x0", 8);
        let input_struct = new Map([['since', serialized_since], ['previousOutput', serialized_outpoint]])
        let input_serialized = udtswap_consts.ckb.utils.serializeStruct(input_struct);

        type_id_hash.update(udtswap_consts.ckb.utils.hexToBytes(input_serialized));
        type_id_hash.update(udtswap_consts.ckb.utils.hexToBytes("0x0000000000000000"));
        let script_args = `0x${type_id_hash.digest('hex')}`;

        return script_args;
    },

    get_all_code_hashes : async function (startblock) {
        fs.writeFileSync(__dirname + '/../hash.txt', '');

        let unspentCells = await udtswap_consts.ckb.loadCells({
            start: BigInt(startblock),
            lockHash: udtswap_consts.lockHash
        });

        unspentCells = unspentCells.filter((unspentCell) => {
            return unspentCell.type == null;
        });

        if(unspentCells.length < 4) {
            let deployed_tx = await deploy_udtswap.make_cells(startblock);
            if(deployed_tx.txHash==null) {
                console.log("Not enough ckb");
                return;
            }

            while(true) {
                let confirmed = await udtswap_utils.getLiveCellStatus(udtswap_consts.nodeUrl, {
                    index: "0x0",
                    tx_hash: deployed_tx.txHash
                });
                if(confirmed) break;
                await udtswap_utils.sleep(1000);
            }

            unspentCells = await udtswap_consts.ckb.loadCells({
                start: BigInt(startblock),
                lockHash: udtswap_consts.lockHash
            });

            unspentCells = unspentCells.filter((unspentCell) => {
                return unspentCell.type == null;
            });
        }

        let i = 0;
        while(i<4) {
            let script_args = deploy_udtswap.get_type_id_args(unspentCells[i].outPoint);
            let code_hash = udtswap_consts.ckb.utils.scriptToHash({
                hashType: 'type',
                codeHash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
                args: script_args,
            });
            let code_hash_to_bytes = udtswap_consts.ckb.utils.hexToBytes(code_hash);
            udtswap_utils.writeConsts(0, unspentCells[i].outPoint);
            udtswap_utils.writeConsts(3, code_hash_to_bytes);
            i+=1;
        }
    },

    make_cells: async function(startblock) {
        const secp256k1Dep = await udtswap_consts.ckb.loadSecp256k1Dep();
        let unspentCells = await udtswap_consts.ckb.loadCells({
            start: BigInt(startblock),
            lockHash: udtswap_consts.lockHash
        });

        let totalcap = BigInt(0);
        unspentCells = unspentCells.filter((unspentCell) => {
            if(unspentCell.type == null) {
                totalcap += BigInt(unspentCell.capacity);
            }
            return unspentCell.type == null;
        });

        if(totalcap < BigInt(40006100005000)) {
            return {
                txHash: null,
                type: null
            }
        }

        const rawTransaction = udtswap_consts.ckb.generateRawTransaction({
            fromAddress: udtswap_consts.addr,
            toAddress: udtswap_consts.addr,
            capacity: totalcap - BigInt(6100005000),
            fee: BigInt(5000),
            safeMode: false,
            cells: unspentCells,
            deps: secp256k1Dep,
        });

        rawTransaction.witnesses[0] = {
            lock: '',
            inputType: '',
            outputType: ''
        };

        rawTransaction.outputs[1].capacity = udtswap_utils.bnToHexNoLeadingZero(totalcap - BigInt(40000000005000));
        rawTransaction.outputs[0].capacity = '0x9184e72a000';

        rawTransaction.outputs.unshift(rawTransaction.outputs[0]);
        rawTransaction.outputs.unshift(rawTransaction.outputs[0]);
        rawTransaction.outputs.unshift(rawTransaction.outputs[0]);

        rawTransaction.outputsData.push('0x');
        rawTransaction.outputsData.push('0x');
        rawTransaction.outputsData.push('0x');

        const signedTx = udtswap_consts.ckb.signTransaction(udtswap_consts.sk)(rawTransaction);
        const realTxHash = await udtswap_consts.ckb.rpc.sendTransaction(signedTx, "passthrough");
        return {
            txHash: realTxHash,
            type: null
        };
    },

    only_deploy_type_id_script: async function(idx, scripthexdata, startblock, capacity, fee) {
        const secp256k1Dep = await udtswap_consts.ckb.loadSecp256k1Dep();
        let unspentCells = await udtswap_consts.ckb.loadCells({
            start: BigInt(startblock),
            lockHash: udtswap_consts.lockHash
        });

        let obj = fs.readFileSync(__dirname + '/../consts.json', 'utf8');
        obj = JSON.parse(obj);

        unspentCells = unspentCells.filter((unspentCell) => {
            let i = 0;
            while(i<4) {
                if(idx==i) {
                    i+=1;
                    continue;
                }
                if(unspentCell.outPoint.txHash == obj.inputs[i].txHash && unspentCell.outPoint.index == obj.inputs[i].index) return false;
                i+=1;
            }
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

        let script_args = deploy_udtswap.get_type_id_args(rawTransaction.inputs[0].previousOutput);

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

    only_deploy_udtswap: async function(udtswap) {
        let data = await udtswap_consts.readFileAsync("../../UDTswap_scripts/"+udtswap);

        const scripthexdata = udtswap_consts.ckb.utils.bytesToHex(data);
        let capacity = 7000000000000;
        let fee = 70000;
        let idx = 0;
        if(udtswap=="UDTswap_lock_udt_based") {
            capacity = 1200000000000;
            fee = 12000;
            idx = 1;
        } else if(udtswap=="UDTswap_liquidity_UDT_udt_based" || udtswap=="test_udt") {
            capacity = 4300000000000;
            fee = 43000;
            if(udtswap=="UDTswap_liquidity_UDT_udt_based") idx = 2;
            else idx = 3;
        }
        return await deploy_udtswap.only_deploy_type_id_script(idx, scripthexdata, 0, capacity, fee);
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

        let obj = fs.readFileSync(__dirname + '/../consts.json', 'utf8');
        obj = JSON.parse(obj);
        udtswap_consts.testUDTType.args = obj.scripts[3].args;
        udtswap_consts.testUDTDeps.outPoint.txHash = obj.deps[3];

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


module.exports = deploy_udtswap;

