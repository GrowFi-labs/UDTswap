var udtswap_consts = require('./udtswap_consts.js');
var udtswap_utils = require('./udtswap_utils.js');

const udtswap_tx_utils = {
  getLiveCellsOnly: async function(ckb, fromBlock, lockHash) {
    let unspentCells = await ckb.loadCells({
      lockHash,
      start: BigInt(fromBlock),
    });
    return {
      unspentCells: unspentCells
    };
  },

  getLiveCells: async function(
    ckb,
    lockHash,
    fromBlock,
    udt1TypeHash,
    udt2TypeHash,
    liquidityUDTTypeHash,
    ckbAmount,
    udt1Amount,
    udt2Amount,
    liquidityUDTAmount
  ) {
    let getLiveCellsRes = await udtswap_tx_utils.getLiveCellsOnly(ckb, fromBlock, lockHash);
    let unspentCells = getLiveCellsRes.unspentCells;

    let scriptChk = new Map();
    let temp;
    let addAmount;
    let j = 0;
    while(j<udt1TypeHash.length) {
      temp = scriptChk.get(udt1TypeHash[j]);
      addAmount = udt1TypeHash[j] == udtswap_consts.ckbTypeHash ? BigInt(udtswap_consts.ckbMinimum) : BigInt(udtswap_consts.udtMinimum);
      if(temp != undefined) {
        temp.cap += BigInt(udt1Amount[j]) + addAmount;
        temp.cnt += 1;
        scriptChk.set(udt1TypeHash[j], temp);
      } else {
        scriptChk.set(udt1TypeHash[j], { cap: BigInt(udt1Amount[j]) + addAmount, cur: BigInt(0), cnt: 1 });
      }

      temp = scriptChk.get(udt2TypeHash[j]);
      addAmount = udt2TypeHash[j] == udtswap_consts.ckbTypeHash ? BigInt(udtswap_consts.ckbMinimum) : BigInt(udtswap_consts.udtMinimum);
      if(temp != undefined) {
        temp.cap += BigInt(udt2Amount[j]) + addAmount;
        temp.cnt += 1;
        scriptChk.set(udt2TypeHash[j], temp);
      } else {
        scriptChk.set(udt2TypeHash[j], { cap: BigInt(udt2Amount[j]) + addAmount, cur: BigInt(0), cnt: 1 });
      }
      j+=1;
    }
    temp = scriptChk.get(udtswap_consts.ckbTypeHash);
    if(temp != undefined) {
      ckbAmount += temp.cap;
    }


    let currentCKBAmount = BigInt(0);
    let currentUDT1Amount = [];
    let currentUDT2Amount = [];
    let currentLiquidityUDTAmount = BigInt(0);
    let ckbCellIndex = -1;
    let liquidityUDTIndex = -1;

    let ret = [];
    for(let i=0; i<unspentCells.length; i++) {
      const udtTypeHash = unspentCells[i].type == null ? '' : ckb.utils.scriptToHash(unspentCells[i].type);
      const ckbCapacity = BigInt(unspentCells[i].capacity);
      temp = scriptChk.get(udtTypeHash);
      if(unspentCells[i].type == null) {
        if(currentCKBAmount <= ckbAmount) {
          currentCKBAmount += ckbCapacity;
        } else {
          continue;
        }
        if(ckbCellIndex==-1) {
          ckbCellIndex = ret.length;
        }
        ret.push(unspentCells[i]);
      } else if(temp != undefined || udtTypeHash == liquidityUDTTypeHash) {
        const cellInfo = await ckb.rpc.getLiveCell(
          {
            txHash: unspentCells[i].outPoint.txHash,
            index: unspentCells[i].outPoint.index
          },
          true
        );
        const udtCapacity = BigInt(udtswap_utils.changeEndianness(cellInfo.cell.data.content.substr(0, 34)));

        if (temp != undefined) {
          if (temp.cur <= temp.cap) {
            temp.cur += udtCapacity;
            scriptChk.set(udtTypeHash, temp);
          } else {
            continue;
          }
        } else if (udtTypeHash == liquidityUDTTypeHash) {
          if (currentLiquidityUDTAmount <= liquidityUDTAmount) {
            currentLiquidityUDTAmount += udtCapacity;
            liquidityUDTIndex = ret.length;
          } else {
            continue;
          }
        }
        currentCKBAmount += ckbCapacity;
        ret.push(unspentCells[i]);
      }
    }
    if (liquidityUDTIndex != -1) {
      temp = ret[0];
      ret[0] = ret[liquidityUDTIndex];
      ret[liquidityUDTIndex] = temp;
      if (ckbCellIndex == 0) {
        ckbCellIndex = liquidityUDTIndex;
      }
    }

    j = 0;
    while(j<udt1TypeHash.length) {
      if(udt1TypeHash[j] == udtswap_consts.ckbTypeHash) {
        currentUDT1Amount[j] = BigInt(udt1Amount[j]) + BigInt(udtswap_consts.ckbMinimum);
      } else {
        temp = scriptChk.get(udt1TypeHash[j]);
        currentUDT1Amount[j] = BigInt(udt1Amount[j]) + BigInt(udtswap_consts.udtMinimum);
        if(temp.cnt == 1) currentUDT1Amount[j] = temp.cur;
        temp.cur -= currentUDT1Amount[j];
        temp.cnt -= 1;
        scriptChk.set(udt1TypeHash[j], temp);
      }

      if(udt2TypeHash[j] == udtswap_consts.ckbTypeHash) {
        currentUDT2Amount[j] = BigInt(udt2Amount[j]) + BigInt(udtswap_consts.ckbMinimum);
      } else {
        temp = scriptChk.get(udt2TypeHash[j]);
        currentUDT2Amount[j] = BigInt(udt2Amount[j]) + BigInt(udtswap_consts.udtMinimum);
        if(temp.cnt == 1) currentUDT2Amount[j] = temp.cur;
        temp.cur -= currentUDT2Amount[j];
        temp.cnt -= 1;
        scriptChk.set(udt2TypeHash[j], temp);
      }
      j+=1;
    }

    return {
      unspentCells: ret,
      ckbInput: currentCKBAmount,
      udt1Input: currentUDT1Amount,
      udt2Input: currentUDT2Amount,
      liquidityUDTInput: currentLiquidityUDTAmount,
      ckbCellIndex: ckbCellIndex,
    };
  },
  generateRawTx: async function (
    ckb,
    unspentCells,
    ckbAmount,
    addr,
    poolCnt
  ) {
    const secp256k1Dep = await ckb.loadSecp256k1Dep();

    const rawTransaction = ckb.generateRawTransaction({
      fromAddress: addr,
      toAddress: addr,
      capacity: BigInt(ckbAmount) - BigInt(udtswap_consts.feeAmount) * BigInt(poolCnt) - BigInt(udtswap_consts.txFeeMax),
      fee: BigInt(udtswap_consts.txFeeMax),
      safeMode: false,
      cells: unspentCells,
      deps: secp256k1Dep,
    });
    return rawTransaction
  },
  setFeeCell: function(
    rawTransaction
  ) {
    let temp = rawTransaction.outputs[0];
    rawTransaction.outputs[0] = rawTransaction.outputs[1];
    rawTransaction.outputs[1] = temp;

    rawTransaction.outputs[0].lock.args = udtswap_consts.feePkh;

    return rawTransaction;
  },
  getSerializedFirstInput: function (
    rawTransaction,
    ckb,
    ckbCellIndex
  ) {
    let temp = rawTransaction.inputs[0];
    rawTransaction.inputs[0] = rawTransaction.inputs[ckbCellIndex];
    rawTransaction.inputs[ckbCellIndex] = temp;

    let outpoint_struct = new Map([['txHash', rawTransaction.inputs[0].previousOutput.txHash], ['index', ckb.utils.toHexInLittleEndian(rawTransaction.inputs[0].previousOutput.index)]]);
    let serialized_outpoint = ckb.utils.serializeStruct(outpoint_struct);
    let serialized_since = ckb.utils.toHexInLittleEndian(rawTransaction.inputs[0].since, 8);
    let input_struct = new Map([['since', serialized_since], ['previousOutput', serialized_outpoint]])
    let input_serialized = ckb.utils.serializeStruct(input_struct);

    return input_serialized;
  },
  setPoolCellsInput: function(
    rawTransaction,
    poolInfo
  ) {
    rawTransaction.inputs.unshift(
      {
        previousOutput: {
          txHash: poolInfo.live_tx_hash,
          index: udtswap_utils.bnToHexNoLeadingZero(BigInt(poolInfo.live_tx_index)),
        },
        since: '0x0'
      },
      {
        previousOutput: {
          txHash: poolInfo.live_tx_hash,
          index: udtswap_utils.bnToHexNoLeadingZero(BigInt(poolInfo.live_tx_index) + BigInt(1)),
        },
        since: '0x0'
      },
      {
        previousOutput: {
          txHash: poolInfo.live_tx_hash,
          index: udtswap_utils.bnToHexNoLeadingZero(BigInt(poolInfo.live_tx_index) + BigInt(2)),
        },
        since: '0x0'
      },
    );
    return rawTransaction;
  },
  setPoolCellsOutput: function(
    rawTransaction,
    tx_idx,
    udt1Info,
    udt2Info,
    poolInfo,
    input_serialized
  ) {
    rawTransaction.outputs.unshift(
      {
        capacity: udtswap_utils.bnToHexNoLeadingZero(BigInt(udtswap_consts.poolCellCKB)),
        lock: {
          hashType: "type",
          codeHash: udtswap_consts.UDTSwapLockCodeHash,
          args: udt1Info.udt_typehash + udt2Info.udt_typehash.substr(2, 64),
        },
        type: {
          hashType: "type",
          codeHash: udtswap_consts.UDTSwapTypeCodeHash,
          args: tx_idx==3 ? input_serialized : poolInfo.tx_input_0,
        },
      },
      {
        capacity: udtswap_utils.bnToHexNoLeadingZero(BigInt(15800000000) + (BigInt(udt1Info.args.length) + BigInt(udt1Info.data_without_amount.length))/BigInt(2)*BigInt(100000000)),
        lock: {
          hashType: "type",
          codeHash: udtswap_consts.UDTSwapLockCodeHash,
          args: udt1Info.udt_typehash + udt2Info.udt_typehash.substr(2, 64),
        },
      },
      {
        capacity: udtswap_utils.bnToHexNoLeadingZero(BigInt(15800000000) + (BigInt(udt2Info.args.length) + BigInt(udt2Info.data_without_amount.length))/BigInt(2)*BigInt(100000000)),
        lock: {
          hashType: "type",
          codeHash: udtswap_consts.UDTSwapLockCodeHash,
          args: udt1Info.udt_typehash + udt2Info.udt_typehash.substr(2, 64),
        },
      },
    );

    if(tx_idx==3) {
      rawTransaction.outputs[1].capacity = BigInt(udt1Info.udt_typehash)==0 ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udtswap_consts.ckbLockCellMinimum)) : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity = BigInt(udt2Info.udt_typehash)==0 ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udtswap_consts.ckbLockCellMinimum)) : rawTransaction.outputs[2].capacity;
    }

    if(BigInt(udt1Info.udt_typehash)!=0) {
      rawTransaction.outputs[1].type = {
        hashType: udt1Info.hash_type,
        codeHash: udt1Info.code_hash,
        args: udt1Info.args,
      };
    }

    if(BigInt(udt2Info.udt_typehash)!=0) {
      rawTransaction.outputs[2].type = {
        hashType: udt2Info.hash_type,
        codeHash: udt2Info.code_hash,
        args: udt2Info.args,
      };
    }

    rawTransaction.outputsData.unshift("0x", "0x", "0x");

    return rawTransaction;
  },
  setResultOutputCells: function(
    rawTransaction,
    ckb,
    tx_idx,
    udt1Info,
    udt2Info,
    poolInfo,
    pkh,
    toAddr,
    reversed
  ) {
    let topkh = (toAddr == null ? null : '0x'+ckb.utils.parseAddress(toAddr, 'hex').substring(6));

    let output_udt1_cap = udtswap_utils.bnToHexNoLeadingZero(BigInt(11000000000) + (BigInt(udt1Info.args.length) + BigInt(udt1Info.data_without_amount.length))/BigInt(2)*BigInt(100000000));
    let output_udt2_cap = udtswap_utils.bnToHexNoLeadingZero(BigInt(11000000000) + (BigInt(udt2Info.args.length) + BigInt(udt2Info.data_without_amount.length))/BigInt(2)*BigInt(100000000));

    rawTransaction.outputs.push(
      {
        capacity: output_udt1_cap,
        lock: {
          hashType: "type",
          codeHash: udtswap_consts.nervosDefaultLockCodeHash,
          args: topkh==null ? pkh : (reversed ? topkh : pkh)
        },
      },
      {
        capacity: output_udt2_cap,
        lock: {
          hashType: "type",
          codeHash: udtswap_consts.nervosDefaultLockCodeHash,
          args: topkh==null ? pkh : (reversed ? pkh : topkh)
        },
      },
    );

    let isAddOrRemove = 0;

    if(tx_idx==1 || tx_idx==2) {
      let liquidity_udt_cap = udtswap_utils.bnToHexNoLeadingZero(BigInt(19000000000));

      let UDTSwaplockHash = ckb.utils.scriptToHash({
        hashType: "type",
        codeHash: udtswap_consts.UDTSwapLockCodeHash,
        args: udt1Info.udt_typehash + udt2Info.udt_typehash.substr(2, 64),
      });

      rawTransaction.outputs.push(
        {
          capacity: liquidity_udt_cap,
          lock: {
            hashType: "type",
            codeHash: udtswap_consts.nervosDefaultLockCodeHash,
            args: pkh,
          },
          type: {
            hashType: "type",
            codeHash: udtswap_consts.UDTSwapLiquidityUDTCodeHash,
            args: UDTSwaplockHash + poolInfo.tx_input_0.substr(2),
          },
        },
      );
      isAddOrRemove = 1;
    }

    if(BigInt(udt1Info.udt_typehash)!=0) {
      rawTransaction.outputs[rawTransaction.outputs.length - 2 - isAddOrRemove].type = {
        hashType: udt1Info.hash_type,
        codeHash: udt1Info.code_hash,
        args: udt1Info.args,
      };
    }

    if(BigInt(udt2Info.udt_typehash)!=0) {
      rawTransaction.outputs[rawTransaction.outputs.length - 1 - isAddOrRemove].type = {
        hashType: udt2Info.hash_type,
        codeHash: udt2Info.code_hash,
        args: udt2Info.args,
      };
    }

    return rawTransaction;
  },
  setResultDataAndCapacity: function (
    rawTransaction,
    tx_idx,
    udt1Amount,
    udt2Amount,
    liquidityUDTAmount,
    udt1Info,
    udt2Info,
    poolInfo,
    reversed
  ) {

    let udt1ReserveAfter;
    let udt2ReserveAfter;
    let udt1ReserveAfterHex;
    let udt2ReserveAfterHex;
    let totalLiquidityAfter = '';
    let udt1AmountAfter = '';
    let udt2AmountAfter = '';
    let udt1IsCKB = BigInt(udt1Info.udt_typehash) == BigInt(0);
    let udt2IsCKB = BigInt(udt2Info.udt_typehash) == BigInt(0);

    if(tx_idx==0) {
      udt1AmountAfter = udtswap_utils.changeEndianness(udtswap_utils.bnToHex(udt1Amount.actual)).padEnd(34, '0');
      udt2AmountAfter = udtswap_utils.changeEndianness(udtswap_utils.bnToHex(udt2Amount.actual)).padEnd(34, '0');
      totalLiquidityAfter = udtswap_utils.changeEndianness(udtswap_utils.bnToHex(poolInfo.total_liquidity)).padEnd(34, '0');

      let outputsLen = rawTransaction.outputs.length;

      if(reversed) {
        udt1ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt1_reserve) - BigInt(udt1Amount.actual));
        udt2ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt2_reserve) + BigInt(udt2Amount.actual));
        udt1ReserveAfter = udtswap_utils.changeEndianness(udt1ReserveAfterHex).padEnd(34, '0');
        udt2ReserveAfter = udtswap_utils.changeEndianness(udt2ReserveAfterHex).padEnd(34, '0');

        rawTransaction.outputs[outputsLen - 2].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1Amount.actual)) : rawTransaction.outputs[outputsLen - 2].capacity;
        rawTransaction.outputs[outputsLen - 1].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2Amount.input) - BigInt(udt2Amount.actual)) : rawTransaction.outputs[outputsLen - 1].capacity;

        rawTransaction.outputsData.push(udt1IsCKB ? "0x" : udt1AmountAfter + udt1Info.data_without_amount);
        rawTransaction.outputsData.push(udt2IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt2Amount.input)-BigInt(udt2Amount.actual))).padEnd(34, '0') + udt2Info.data_without_amount);
      }

      if(!reversed) {
        udt1ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt1_reserve) + BigInt(udt1Amount.actual));
        udt2ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt2_reserve) - BigInt(udt2Amount.actual));
        udt1ReserveAfter = udtswap_utils.changeEndianness(udt1ReserveAfterHex).padEnd(34, '0');
        udt2ReserveAfter = udtswap_utils.changeEndianness(udt2ReserveAfterHex).padEnd(34, '0');

        rawTransaction.outputs[outputsLen - 2].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1Amount.input) - BigInt(udt1Amount.actual)) : rawTransaction.outputs[outputsLen - 2].capacity;
        rawTransaction.outputs[outputsLen - 1].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2Amount.actual)) : rawTransaction.outputs[outputsLen - 1].capacity;

        rawTransaction.outputsData.push(udt1IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt1Amount.input)-BigInt(udt1Amount.actual))).padEnd(34, '0') + udt1Info.data_without_amount);
        rawTransaction.outputsData.push(udt2IsCKB ? "0x" : udt2AmountAfter + udt2Info.data_without_amount);
      }

      rawTransaction.outputs[1].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1ReserveAfterHex)) : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2ReserveAfterHex)) : rawTransaction.outputs[2].capacity;
    } else if(tx_idx==1) {
      totalLiquidityAfter = udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(poolInfo.total_liquidity)+BigInt(liquidityUDTAmount.actual))).padEnd(34, '0');

      udt1ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt1_reserve) + BigInt(udt1Amount.actual));
      udt2ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt2_reserve) + BigInt(udt2Amount.actual));
      udt1ReserveAfter = udtswap_utils.changeEndianness(udt1ReserveAfterHex).padEnd(34, '0');
      udt2ReserveAfter = udtswap_utils.changeEndianness(udt2ReserveAfterHex).padEnd(34, '0');

      rawTransaction.outputs[5].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1Amount.input)-BigInt(udt1Amount.actual)) : rawTransaction.outputs[5].capacity;
      rawTransaction.outputs[6].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2Amount.input)-BigInt(udt2Amount.actual)) : rawTransaction.outputs[6].capacity;

      rawTransaction.outputsData.push(udt1IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt1Amount.input)-BigInt(udt1Amount.actual))).padEnd(34, '0') + udt1Info.data_without_amount);
      rawTransaction.outputsData.push(udt2IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt2Amount.input)-BigInt(udt2Amount.actual))).padEnd(34, '0') + udt2Info.data_without_amount);
      rawTransaction.outputsData.push(udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(liquidityUDTAmount.actual))).padEnd(34, '0'));

      rawTransaction.outputs[1].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1ReserveAfterHex)) : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2ReserveAfterHex)) : rawTransaction.outputs[2].capacity;


      let temp = rawTransaction.outputs[4];
      rawTransaction.outputs[4] = rawTransaction.outputs[7];
      rawTransaction.outputs[7] = temp;

      temp = rawTransaction.outputsData[4];
      rawTransaction.outputsData[4] = rawTransaction.outputsData[7];
      rawTransaction.outputsData[7] = temp;
    } else if(tx_idx==2) {
      totalLiquidityAfter = udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(poolInfo.total_liquidity)-BigInt(liquidityUDTAmount.actual))).padEnd(34, '0');

      udt1ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt1_reserve) - BigInt(udt1Amount.actual));
      udt2ReserveAfterHex = udtswap_utils.bnToHex(BigInt(poolInfo.udt2_reserve) - BigInt(udt2Amount.actual));
      udt1ReserveAfter = udtswap_utils.changeEndianness(udt1ReserveAfterHex).padEnd(34, '0');
      udt2ReserveAfter = udtswap_utils.changeEndianness(udt2ReserveAfterHex).padEnd(34, '0');

      rawTransaction.outputs[5].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1Amount.actual)) : rawTransaction.outputs[5].capacity;
      rawTransaction.outputs[6].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2Amount.actual)) : rawTransaction.outputs[6].capacity;

      rawTransaction.outputsData.push(udt1IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt1Amount.actual))).padEnd(34, '0') + udt1Info.data_without_amount);
      rawTransaction.outputsData.push(udt2IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt2Amount.actual))).padEnd(34, '0') + udt2Info.data_without_amount);
      rawTransaction.outputsData.push(udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(liquidityUDTAmount.input) - BigInt(liquidityUDTAmount.actual))).padEnd(34, '0'));

      rawTransaction.outputs[1].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1ReserveAfterHex)) : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2ReserveAfterHex)) : rawTransaction.outputs[2].capacity;
    } else if(tx_idx==3) {
      totalLiquidityAfter = "0x00000000000000000000000000000000";

      udt1ReserveAfterHex = udtswap_utils.bnToHex(BigInt(udt1Amount.actual));
      udt2ReserveAfterHex = udtswap_utils.bnToHex(BigInt(udt2Amount.actual));
      udt1ReserveAfter = udtswap_utils.changeEndianness(udt1ReserveAfterHex).padEnd(34, '0');
      udt2ReserveAfter = udtswap_utils.changeEndianness(udt2ReserveAfterHex).padEnd(34, '0');

      rawTransaction.outputs[5].capacity = udt1IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1Amount.input)-BigInt(udt1Amount.actual)) : rawTransaction.outputs[5].capacity;
      rawTransaction.outputs[6].capacity = udt2IsCKB ? udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2Amount.input)-BigInt(udt2Amount.actual)) : rawTransaction.outputs[6].capacity;

      rawTransaction.outputsData.push(udt1IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt1Amount.input)-BigInt(udt1Amount.actual))).padEnd(34, '0') + udt1Info.data_without_amount);
      rawTransaction.outputsData.push(udt2IsCKB ? "0x" : udtswap_utils.changeEndianness(udtswap_utils.bnToHex(BigInt(udt2Amount.input)-BigInt(udt2Amount.actual))).padEnd(34, '0') + udt2Info.data_without_amount);
    }
    rawTransaction.outputsData[0] = udt1ReserveAfter + udt2ReserveAfter.substr(2) + totalLiquidityAfter.substr(2);
    rawTransaction.outputsData[1] = udt1IsCKB ? "0x" : udt1ReserveAfter;
    rawTransaction.outputsData[2] = udt2IsCKB ? "0x" : udt2ReserveAfter;

    return rawTransaction;
  },
  setDeps: function (
    rawTransaction,
    tx_idx,
    udt1Info,
    udt2Info
  ) {
    if(!udtswap_utils.sameCellDeps(rawTransaction.cellDeps, {
      txHash: udtswap_consts.UDTSwapTypeDeps.tx_hash,
      index: udtswap_consts.UDTSwapTypeDeps.index
    })) {
      rawTransaction.cellDeps.push(
        {
          outPoint: {
            txHash: udtswap_consts.UDTSwapTypeDeps.tx_hash,
            index: udtswap_consts.UDTSwapTypeDeps.index
          },
          depType: "code"
        }
      );
    }

    if(!udtswap_utils.sameCellDeps(rawTransaction.cellDeps, {
      txHash: udtswap_consts.UDTSwapLockDeps.tx_hash,
      index: udtswap_consts.UDTSwapLockDeps.index
    })) {
      rawTransaction.cellDeps.push(
        {
          outPoint: {
            txHash: udtswap_consts.UDTSwapLockDeps.tx_hash,
            index: udtswap_consts.UDTSwapLockDeps.index
          },
          depType: "code"
        }
      );
    }

    if(!udtswap_utils.sameCellDeps(rawTransaction.cellDeps, {
      txHash: udtswap_consts.UDTSwapLiquidityUDTDeps.tx_hash,
      index: udtswap_consts.UDTSwapLiquidityUDTDeps.index
    }) && (tx_idx==1 || tx_idx==2)) {
      rawTransaction.cellDeps.push(
        {
          outPoint: {
            txHash: udtswap_consts.UDTSwapLiquidityUDTDeps.tx_hash,
            index: udtswap_consts.UDTSwapLiquidityUDTDeps.index
          },
          depType: "code"
        }
      );
    }

    if(!udtswap_utils.sameCellDeps(rawTransaction.cellDeps, {
      txHash: udt1Info.udt_deps_tx_hash,
      index: udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1Info.udt_deps_tx_index))
    }) && udt1Info.udt_deps_tx_index != -1) {
      rawTransaction.cellDeps.push(
        {
          outPoint: {
            txHash: udt1Info.udt_deps_tx_hash,
            index: udtswap_utils.bnToHexNoLeadingZero(BigInt(udt1Info.udt_deps_tx_index))
          },
          depType: udt1Info.udt_deps_dep_type
        }
      );
    }

    if(!udtswap_utils.sameCellDeps(rawTransaction.cellDeps, {
      txHash: udt2Info.udt_deps_tx_hash,
      index: udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2Info.udt_deps_tx_index))
    }) && udt2Info.udt_deps_tx_index != -1) {
      rawTransaction.cellDeps.push(
        {
          outPoint: {
            txHash: udt2Info.udt_deps_tx_hash,
            index: udtswap_utils.bnToHexNoLeadingZero(BigInt(udt2Info.udt_deps_tx_index))
          },
          depType: udt2Info.udt_deps_dep_type
        }
      );
    }
    return rawTransaction;
  },
  signWitnesses: function(
      rawTransaction,
      ckb,
      tx_idx,
      sk,
      poolCnt
  ) {
    rawTransaction.witnesses = rawTransaction.inputs.map(() => ({
      lock: '',
      inputType: '',
      outputType: ''
    }));
    if(tx_idx==3) {
      return ckb.signTransaction(sk)(rawTransaction);
    }

    let pkh = `0x${ckb.utils.blake160(ckb.utils.privateKeyToPublicKey(sk), 'hex')}`;
    let key = new Map([[ckb.generateLockHash(pkh), sk]]);

    let inputCells = [];
    let i = 0;
    while(i<rawTransaction.inputs.length - poolCnt*3) {
      inputCells.push({
        lock: {
          hashType: 'type',
          codeHash: udtswap_consts.nervosDefaultLockCodeHash,
          args: pkh,
        }
      });
      i+=1;
    }

    let transactionHash = ckb.utils.rawTransactionToHash(rawTransaction);
    let signedWitnesses = ckb.signWitnesses(key)({
      transactionHash: transactionHash,
      witnesses: rawTransaction.witnesses.slice(poolCnt*3),
      inputCells: inputCells
    });
    signedWitnesses = signedWitnesses.map((witness) => {
      return typeof witness === 'string' ? witness : udtswap_consts.CKBUtils.serializeWitnessArgs(witness)
    })[0];
    i = 0;
    while(i<rawTransaction.witnesses.length) {
      rawTransaction.witnesses[i] = '0x10000000100000001000000010000000';
      if(i==poolCnt*3) {
        rawTransaction.witnesses[i] = signedWitnesses;
      }
      i+=1;
    }
    return rawTransaction;
  },
  setTxFeeAndSign: async function(
    rawTransaction,
    ckb,
    tx_idx,
    udt1Info,
    udt2Info,
    poolInfo,
    poolCnt,
    sk,
  ) {
    let signedTx = null;
    if(tx_idx==3) {
      rawTransaction.outputs.splice(3, 1);
      rawTransaction.outputsData.splice(3, 1);
    }

    rawTransaction = udtswap_tx_utils.signWitnesses(rawTransaction, ckb, tx_idx, sk, poolCnt);
    signedTx = rawTransaction;

    let fee = BigInt(udtswap_consts.CKBUtils.serializeTransaction(signedTx).length / 2 + 1000);
    let ckbChanged = BigInt(0);
    if(tx_idx!=3) {
      ckbChanged = (BigInt(udt1Info[0].udt_typehash)==BigInt(0) ? BigInt(poolInfo[0].udt1_reserve) - BigInt(rawTransaction.outputs[1].capacity) : BigInt(0))
        + (BigInt(udt2Info[0].udt_typehash)==BigInt(0) ? BigInt(poolInfo[0].udt2_reserve) - BigInt(rawTransaction.outputs[2].capacity) : BigInt(0));
    }
    if(tx_idx==0) {
      let i = 0;
      let ckbFeeCellIndex = poolCnt*3+1;
      while(i<poolCnt) {
        ckbChanged = (BigInt(udt1Info[i].udt_typehash)==BigInt(0) ? BigInt(poolInfo[i].udt1_reserve) - BigInt(rawTransaction.outputs[(poolCnt - 1 - i)*3+1].capacity) : BigInt(0))
          + (BigInt(udt2Info[i].udt_typehash)==BigInt(0) ? BigInt(poolInfo[i].udt2_reserve) - BigInt(rawTransaction.outputs[(poolCnt - 1 - i)*3+2].capacity) : BigInt(0));
        rawTransaction.outputs[ckbFeeCellIndex].capacity = udtswap_utils.bnToHexNoLeadingZero(
          BigInt(rawTransaction.outputs[ckbFeeCellIndex].capacity)
          - BigInt(rawTransaction.outputs[poolCnt*3+i*2+2].capacity)
          - BigInt(rawTransaction.outputs[poolCnt*3+i*2+3].capacity)
          + ckbChanged);
        i+=1;
      }
      rawTransaction.outputs[ckbFeeCellIndex].capacity = udtswap_utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[ckbFeeCellIndex].capacity)
        + BigInt(udtswap_consts.txFeeMax)
        - fee);
    } else if(tx_idx==1) {
      rawTransaction.outputs[7].capacity = udtswap_utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[7].capacity)
        - BigInt(rawTransaction.outputs[5].capacity)
        - BigInt(rawTransaction.outputs[6].capacity)
        - BigInt(rawTransaction.outputs[4].capacity)
        + ckbChanged
        + BigInt(udtswap_consts.txFeeMax)
        - fee);
    } else if(tx_idx==2) {
      rawTransaction.outputs[4].capacity = udtswap_utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[4].capacity)
        - BigInt(rawTransaction.outputs[5].capacity)
        - BigInt(rawTransaction.outputs[6].capacity)
        - BigInt(rawTransaction.outputs[7].capacity)
        + ckbChanged
        + BigInt(udtswap_consts.txFeeMax)
        - fee);
    } else if(tx_idx==3) {
      rawTransaction.outputs[3].capacity = udtswap_utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[3].capacity)
        + BigInt(udtswap_consts.feeAmount)
        - BigInt(rawTransaction.outputs[4].capacity)
        - BigInt(rawTransaction.outputs[5].capacity)
        - BigInt(rawTransaction.outputs[0].capacity)
        - BigInt(rawTransaction.outputs[1].capacity)
        - BigInt(rawTransaction.outputs[2].capacity)
        + BigInt(udtswap_consts.txFeeMax)
        - fee);
    }

    rawTransaction = udtswap_tx_utils.signWitnesses(rawTransaction, ckb, tx_idx, sk, poolCnt);
    signedTx = rawTransaction;

    let TxHash = await ckb.rpc.sendTransaction(signedTx, "passthrough");
    return TxHash;
  },
}

module.exports = udtswap_tx_utils;
