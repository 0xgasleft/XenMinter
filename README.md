# XEN MINTER


## Description of the process:

XenMinter helps you automate XEN mint process with a specific price through an interactive designed console application.

XenMinter currently supports minting on:
- Polygon Mainnet
- Mumbai Testnet

When you start XenMinter, it will ask you to select a chain.
Then it will ask you for the number of wallets you want to generate.
It will generate that exact number of wallets then store them in files (encrypted of not depending on your selected choice).
All wallets are generated in a local 'wallets' folder containing timestamped folders.
Each timestamped folder represents a single execution of XenMinter, it contains JSON wallets files (encrypted or not).

XenMinter will estimate currently needed amount to mint Xen on all generated wallets (+dispersing fees and gas).
It then asks you to send the estimated amount to a 'main address' (this main address is also a newly generated wallet).

Right after that, XenMinter performs a dispersing of Xen mint fees to all currently generated wallets (in the current execution).

It then asks you for a Xen mint price, this input will be processed and XenMinter will keep listening until this price is accepted on-chain, then it will perform the mint for all wallets.

XenMinter will then try to guess your source wallet (the wallet you used to fund the main address), it will ask you for confirmation.
This address will get refunded with all remaining balances of all wallets after the Xen mint process.

Finally, a special file named '_REPORT_.json' is generated, it recapitulates mint informations of all wallets of the current execution.

## Technical requirements:
- Node v16.13.1 or later
- NPM v9.5.1 or later
- PolygonScan API Key
- MumbaiScan API Key

This project is hosted in a hardhat environnement but is not strongly dependent to it. You can safely use Node to run it too.

Before running XenMinter, you need to configure PolygonScan and MumbaiScan API keys in 'configuration/config.json' through 'explorer_key' field.

'Disperser.sol' is already deployed and verified in explorers (its on-chain address is in 'config.json'). Its source code is available in 'contracts' or directly in explorers.

Entry point is 'scripts/process.js'.

## Launching XenMinter:

To be executed only the first time you pull this repo in order to download necessary packages:
```shell
npm ci
```

Start XenMinter with:

```shell
npx hardhat run scripts/process.js
```
or
```shell
node scripts/process.js
```


Feel free to contribute, there is a lot of possible improvements.