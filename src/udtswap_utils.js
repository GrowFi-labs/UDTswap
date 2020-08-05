var udtswap_consts = require('./udtswap_consts.js');
const fs = require('fs');

const udtswap_utils = {
  writeConsts: function (idx, data) {
    let obj = fs.readFileSync(__dirname + '/../consts.json', 'utf8');
    obj = JSON.parse(obj);
    if(idx==0) {
      obj.inputs.push(data);
    } else if(idx==1) {
      obj.scripts.push(data);
    } else if(idx==2) {
      obj.deps.push(data);
    } else if(idx==3) {
      let obj_hash = fs.readFileSync(__dirname + '/../hash.txt', 'utf8');
      fs.writeFileSync(__dirname + '/../hash.txt', obj_hash+data.toString()+'\n');
    }
    let json = JSON.stringify(obj);
    fs.writeFileSync(__dirname + '/../consts.json', json);
  },

  sleep: function(t){
    return new Promise(resolve=>setTimeout(resolve,t));
  },

  sameCellDeps : function (cellDeps, outPoint) {
    return cellDeps.filter((cellDep) => cellDep.outPoint.txHash == outPoint.txHash && cellDep.outPoint.index == outPoint.index).length;
  },
  changeEndianness : function (str) {
    const result = ['0x'];
    let len = str.length - 2;
    while (len >= 2) {
      result.push(str.substr(len, 2));
      len -= 2;
    }
    return result.join('');
  },

  bnToHex : function (bn) {
    let base = 16;
    let hex = BigInt(bn).toString(base);
    if (hex.length % 2) {
      hex = '0' + hex;
    }
    return "0x" + hex;
  },
  bnToHexNoLeadingZero : function(bn) {
    let base = 16;
    let hex = BigInt(bn).toString(base);
    return "0x" + hex;
  },

  scriptToHash: function(nodeUrl, hashType, codeHash, args) {
    const ckb = new udtswap_consts.CKB(nodeUrl);
    const script = {
      hashType: hashType,
      codeHash: codeHash,
      args: args,
    };
    return ckb.utils.scriptToHash(script);
  },

  getTransactionRPC : async function(nodeUrl, tx_hash) {
    let dataString =`{"id": 2,"jsonrpc": "2.0","method": "get_transaction","params": ["${tx_hash}"]}`;

    let options = {
      url: nodeUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: dataString
    };

    let body = await new Promise((resolve, reject) => {
      udtswap_consts.request(options, function(err, response, body) {
        if (!err && response.statusCode == 200) {
          resolve(JSON.parse(body));
        }
      })
    });
    return body.result;
  },

  getLiveCellRPC : async function(nodeUrl, params) {
    let dataString =`{"id": 2,"jsonrpc": "2.0","method": "get_live_cell","params": [{"index": "${params.index}", "tx_hash": "${params.tx_hash}"}, false]}`;

    let options = {
      url: nodeUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: dataString
    };

    let body = await new Promise((resolve, reject) => {
      udtswap_consts.request(options, function(err, response, body) {
        if (!err && response.statusCode == 200) {
          resolve(JSON.parse(body));
        }
      })
    });
    return body.result;
  },

  getLiveCellStatus: async function(nodeUrl, cell) {
    const result = await udtswap_utils.getLiveCellRPC(nodeUrl, cell);
    if(result.status=="live") {
      return true;
    }
    return false;
  },

  toBigInt: function (number) {
    if(number==undefined || number=='') {
      return "0";
    }

    return new udtswap_consts.bigdecimal.BigDecimal(String(number));
  },

  SwapOutput(pool, input_amount, rev) {
    if(pool=='' || pool.udt1_actual_reserve=='0' || pool.udt2_actual_reserve=='0') {
        return "";
    }
    if(input_amount=='' || input_amount==undefined) return "";

    if(rev) {
      return udtswap_utils.calculateSwapOutputFromInput(pool.udt2_actual_reserve, pool.udt1_actual_reserve, input_amount);
    }
    return udtswap_utils.calculateSwapOutputFromInput(pool.udt1_actual_reserve, pool.udt2_actual_reserve, input_amount);
  },

  SwapInput(pool, output_amount, rev) {
    if(pool=='' || pool.udt1_actual_reserve=='0' || pool.udt2_actual_reserve=='0') {
      return "";
    }
    if(output_amount=='' || output_amount==undefined) return "";

    if(rev) {
      if(udtswap_utils.toBigInt(pool.udt1_actual_reserve).compareTo(udtswap_utils.toBigInt(output_amount))!=1) return "";
      return udtswap_utils.calculateSwapInputFromOutput(pool.udt2_actual_reserve, pool.udt1_actual_reserve, output_amount);
    }
    if(udtswap_utils.toBigInt(pool.udt2_actual_reserve).compareTo(udtswap_utils.toBigInt(output_amount))!=1) return "";
    return udtswap_utils.calculateSwapInputFromOutput(pool.udt1_actual_reserve, pool.udt2_actual_reserve, output_amount);
  },

  calculateSwapOutputFromInput(inputReserve, outputReserve, inputAmount) {
    inputAmount = udtswap_utils.toBigInt(inputAmount);
    inputReserve = udtswap_utils.toBigInt(inputReserve);
    outputReserve = udtswap_utils.toBigInt(outputReserve);

    const inputAmountWithFee = udtswap_utils.toBigInt(inputAmount.multiply(udtswap_utils.toBigInt("997")));
    const numerator = udtswap_utils.toBigInt(inputAmountWithFee.multiply(outputReserve));
    const denominator = udtswap_utils.toBigInt(inputReserve.multiply(udtswap_utils.toBigInt("1000")).add(inputAmountWithFee));
    return String(numerator.divide(denominator, 0, udtswap_consts.bigdecimal.RoundingMode.DOWN()));
  },

  calculateSwapInputFromOutput(inputReserve, outputReserve, outputAmount) {
    outputAmount = udtswap_utils.toBigInt(outputAmount);
    inputReserve = udtswap_utils.toBigInt(inputReserve);
    outputReserve = udtswap_utils.toBigInt(outputReserve);

    const numerator = udtswap_utils.toBigInt(inputReserve.multiply(outputAmount).multiply(udtswap_utils.toBigInt("1000")));
    const denominator = udtswap_utils.toBigInt(outputReserve.subtract(outputAmount).multiply(udtswap_utils.toBigInt("997")));
    return String(numerator.divide(denominator, 0, udtswap_consts.bigdecimal.RoundingMode.DOWN()).add(udtswap_utils.toBigInt("1")));
  },

  calculateAddLiquidityUDT2Amount(pool, udt1_amount) {
    if(pool=='' || pool.udt1_actual_reserve=='0' || pool.udt2_actual_reserve=='0' || udt1_amount=='') return { "udt2_amount" : "", "user_liquidity" : "" };
    let udt1_reserve = udtswap_utils.toBigInt(pool.udt1_actual_reserve);
    let udt2_reserve = udtswap_utils.toBigInt(pool.udt2_actual_reserve);
    const total_liquidity = udtswap_utils.toBigInt(pool.total_liquidity);
    udt1_amount = udtswap_utils.toBigInt(udt1_amount);

    const udt2_amount = String(
      udt2_reserve
      .multiply(udt1_amount)
      .divide(udt1_reserve, 0, udtswap_consts.bigdecimal.RoundingMode.DOWN())
      .add(udtswap_utils.toBigInt("1")));
    const user_liquidity = String(
      total_liquidity
      .multiply(udt1_amount)
      .divide(udt1_reserve, 0, udtswap_consts.bigdecimal.RoundingMode.DOWN()));
    return {
      "udt2_amount" : udt2_amount,
      "user_liquidity" : user_liquidity
    }
  },

  calculateAddLiquidityUDT1Amount(pool, udt2_amount) {
    if(pool=='' || pool.udt1_actual_reserve=='0' || pool.udt2_actual_reserve=='0' || udt2_amount=='') return { "udt1_amount" : "", "udt2_amount" : "", "user_liquidity" : "" };
    let udt1_reserve = udtswap_utils.toBigInt(pool.udt1_actual_reserve);
    let udt2_reserve = udtswap_utils.toBigInt(pool.udt2_actual_reserve);
    udt2_amount = udtswap_utils.toBigInt(udt2_amount);

    const udt1_amount = String(
      udt1_reserve
        .multiply(udt2_amount)
        .divide(udt2_reserve, 0, udtswap_consts.bigdecimal.RoundingMode.DOWN()));
    let recalculated = udtswap_utils.calculateAddLiquidityUDT2Amount(pool, udt1_amount);
    return {
      "udt1_amount" : udt1_amount,
      "udt2_amount" : recalculated.udt2_amount,
      "user_liquidity" : recalculated.user_liquidity
    }
  },

  calculateRemoveLiquidityAmount(pool, user_liquidity) {
    if(pool=='' || pool.udt1_actual_reserve=='0' || pool.udt2_actual_reserve=='0' || user_liquidity=='') return { "udt1_amount" : "", "udt2_amount" : "" };
    const udt1_reserve = udtswap_utils.toBigInt(pool.udt1_actual_reserve);
    const udt2_reserve = udtswap_utils.toBigInt(pool.udt2_actual_reserve);
    const total_liquidity = udtswap_utils.toBigInt(pool.total_liquidity);
    user_liquidity = udtswap_utils.toBigInt(user_liquidity);
    if(total_liquidity.compareTo(user_liquidity)!=1) return { "udt1_amount" : "", "udt2_amount" : "" };

    const udt1_amount = String(
      user_liquidity
        .multiply(udt1_reserve)
        .divide(total_liquidity, 0, udtswap_consts.bigdecimal.RoundingMode.DOWN()));
    const udt2_amount = String(
      user_liquidity
        .multiply(udt2_reserve)
        .divide(total_liquidity, 0, udtswap_consts.bigdecimal.RoundingMode.DOWN()));
    return {
      "udt1_amount" : udt1_amount,
      "udt2_amount" : udt2_amount
    }
  },
};

module.exports = udtswap_utils;
