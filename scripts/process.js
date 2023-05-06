import { createRequire } from "module";
const require = createRequire(import.meta.url);
const prompt = require("prompt-sync")({ sigint: true });
const { ethers } = require("ethers");
import {mint, inputDesiredPrice, estimateFundingAmount, estimateMintGasOnChain, getTermBounds} from "./minter.js";
import {autowallet} from "./autowallet.js";
import {disperse} from "./disperser.js";
import {parseAsReadable, chooseChain, initChainHook, initXenContractInstance, getMainWalletInstance, getWalletsInstances, recoverFunds} from "./helpers.js";




const main = async () => {
    console.log("\n------------------------ XEN AUTO MINT (Written by TheHustler) ---------------------------\n");

    console.log("\n------------------------ STEP 1 : GENERATE YOUR WALLETS ----------------------------------\n");
    const resAutoWallet = await autowallet();
    console.log("\nYou can exit (by ctrl+c) if you just wanted to create wallets! I won't be mad if you do so, i promise :D\n");
    prompt("Press any key to continue execution...");

    console.log("\n------------------------ STEP 2 : CHOOSE YOUR CHAIN --------------------------------------\n");
    const chain = chooseChain();
    
    console.log("\n------------------------ STEP 3 : FUND YOUR MAIN ACCOUNT ---------------------------------\n");
    const hook = await initChainHook(chain);
    const blockNumber = (await hook.getBlockNumber()).toString();
    let mainWallet = (await getMainWalletInstance(resAutoWallet.walletsDirpath, resAutoWallet.passphrase, hook, resAutoWallet.modeId));
    if(mainWallet == null) return;
    const xenContractInstance = await initXenContractInstance(chain, mainWallet);

    let termBounds = null;
    try
    {
        termBounds = await getTermBounds(xenContractInstance);
    }
    catch
    {
        console.log("Could not gather term bounds, using default values (min => 1, max => 100)");
        termBounds = {"minTerm": 1, "maxTerm": 100};
    }
    
    const requiredMintingGasFee = await estimateMintGasOnChain(chain, xenContractInstance, termBounds.maxTerm);
    
    console.log(`\nCurrent estimated mint price on ${chain.name}: ${requiredMintingGasFee} ${chain.symbol}`);

    const desiredPrice = inputDesiredPrice();
    if(desiredPrice == null) return;
    console.log(`You want to mint XEN on each wallet with less than ${desiredPrice}`);
    
    const wallets = getWalletsInstances(resAutoWallet.walletsDirpath, resAutoWallet.passphrase, hook, resAutoWallet.modeId);
    const walletsAddresses = wallets.map(wallet => wallet.address);
    
    const dispersableAmount = ethers.utils.parseEther(desiredPrice.toString());

    const fundingAmount = await estimateFundingAmount(dispersableAmount, (resAutoWallet.nbWallets + 1), chain["disperser_fee"], chain["gas_metrics"]);

    let mainWalletBalance = 0;
    while(mainWalletBalance < fundingAmount)
    {
        console.log(`\nCurrent main wallet balance: ${mainWalletBalance} ${chain.symbol}`);
        console.log(`\nFund the main wallet ${mainWallet.address} with at least ${(fundingAmount - mainWalletBalance)} ${chain.symbol} on ${chain.name}`);
        prompt("\nPress any key after funding transaction success to continue execution...");
        mainWalletBalance = parseAsReadable(await mainWallet.getBalance());
    }

    console.log("\n------------------------ STEP 4 : DISPERSE AMONG YOUR WALLETS ----------------------------\n");

    try {
        await disperse(chain, mainWallet, walletsAddresses, dispersableAmount, desiredPrice);
    }
    catch (err) {
        console.log("Dispersing failed, aborting execution");
        await recoverFunds(mainWallet, wallets, blockNumber, chain);
        return;
        
    }
    
    
    console.log("\n------------------------ STEP 4 : MINT YOUR XEN ------------------------------------------\n");
    console.log(`Current max term on ${chain.name}: ${termBounds.maxTerm}`);
    console.log(`Current min term on ${chain.name}: ${termBounds.minTerm}`);

    try
    {
        const waitingPeriod = parseInt(chain["waiting_period"]);
        await mint(chain, wallets, termBounds, desiredPrice, waitingPeriod, resAutoWallet.walletsDirpath, mainWallet, blockNumber, resAutoWallet.modeId);
    }
    catch
    {
        console.log("Minting failed");
        await recoverFunds(mainWallet, wallets, blockNumber, chain);
    }
    



}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});