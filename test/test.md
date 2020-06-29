
## Test

## Prerequisite
- local testnet (private) node rpc endpoint
- 1 account for deploying UDTswap scripts
- 2 accounts for minting test UDT
- 1 account for testing (all accounts should have enough ckb)

## How to test

### Compile
1. ```sudo docker run --rm -it -v `pwd`:/code nervos/ckb-riscv-gnu-toolchain:xenial bash```
2. `cd /code/UDTswap_scripts`
3. `riscv64-unknown-elf-gcc -c bn.c`
4. `ar rc libbn.a bn.o`
5. `riscv64-unknown-elf-gcc -o UDTswap_udt_based UDTswap_udt_based.c -L ./ -lbn`
- Execute 3. 4. only once
- Execute 5. with same name for all scripts (test_udt.c, UDTswap_liquidity_UDT_udt_based.c, UDTswap_lock_udt_based.c, UDTswap_udt_based.c)

### Deploy
1. `npm install`
2. Change `sk` to deploying account's secret key in '/src/udtswap_consts.js'
3. Change `nodeUrl` to local testnet node rpc endpoint in '/src/udtswap_consts.js'
4. Compile scripts
5. `node deploy_scripts 0` in '/test/deploy'
6. Change `udtswap_type_script_code_hash_buf`, `udtswap_lock_code_hash_buf`, `udtswap_liquidity_udt_code_hash_buf` 
to 5. outputs
7. Compile scripts again
8. `node deploy_scripts 1` in '/test/deploy'
9. Change CodeHash, Deps, Type to 5. outputs and 8. outputs

### Mint test UDTs
1. Change `UDT1Owner`, `UDT2Owner`, `skTesting` to 2 accounts secret key minting test UDT, 1 account's secret key testing 
2. `node deploy_scripts 2` in 'test/deploy'

### Test
`npm test`
