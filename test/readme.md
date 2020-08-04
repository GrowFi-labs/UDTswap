## Test

## Prerequisite
- local testnet node rpc endpoint
- 1 account for deploying UDTswap scripts
  - should have at least 4 cells and each cells having at least 100000 ckb.
- 2 accounts for minting test UDT
- 1 account for testing (all accounts should have enough ckb)

## How to test

### Compile
1. ```sudo docker run --rm -it -v `pwd`:/code nervos/ckb-riscv-gnu-toolchain:xenial bash```
2. `cd /code/UDTswap_scripts`
3. `chmod +x compile.sh`
4. `./compile.sh`
- Execute 3. only once

### Deploy
1. `npm install`
2. Change `sk`,`UDT1Owner`, `UDT2Owner`, `skTesting` to deploying account's secret key in `/src/udtswap_consts.js`
3. Change `nodeUrl` to local testnet node rpc endpoint in `/src/udtswap_consts.js`
4. `node deploy_scripts 0` in `/test/deploy`
5. Copy and paste the results of 4. in `UDTswap_scripts/udtswap_common.h` from line 80 to line 92
6. Compile scripts
7. `node deploy_scripts 1` in `/test/deploy`

### Test
`npm test` in root directory