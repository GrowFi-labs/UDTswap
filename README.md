# UDTswap scripts

## UDTswap_udt_based.c 
UDTswap type script

- args : Pool creating transaction's serialized first input
- hash type : 'type'

![type script main](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20main%20flow.png)
![type script default](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20default%20check%20flow.png)
![type script pool creation](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20pool%20creation%20check%20flow.png)
![type script fee](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20fee%20check%20flow.png)
![type script swap](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20swap%20check%20flow.png)
![type script add](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20add%20liquidity%20flow.png)
![type script remove](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20remove%20liquidity%20flow.png)

## UDTswap_lock_udt_based.c
UDTswap lock script

- args : first UDT type script hash + second UDT type script hash
- hash type : 'type'

![lock script main](/UDTswap%20flow/captures/lock/UDTswap%20lock%20script%20main%20flow.png)

## UDTswap_liquidity_UDT_udt_based.c
UDTswap liquidity udt type script

- args : Pool's UDTswap lock script hash (owner mode) + UDTswap type script args (Pool creating transaction's serialized first input)
- hash type : 'type'

![liquidity UDT main](/UDTswap%20flow/captures/liquidity%20udt/UDTswap%20liquidity%20UDT%20type%20script%20main%20flow.png)
![liquidity UDT owner mode](/UDTswap%20flow/captures/liquidity%20udt/UDTswap%20liquidity%20UDT%20type%20script%20owner%20mode%20liquidity%20check%20flow.png)

## UDTswap_common.h
UDTswap constants header

# UDTswap feature
- Supports CKB and UDT based pools
- Supports multiple pools for same CKB and UDT pairs
- Supports multiple swaps for different pools
