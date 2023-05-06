import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ethers } = require("ethers");
const fs = require('fs');
const Decimal = require('decimal.js');
import {getGasMetrics} from "./helpers.js";




const DISPERSER_ABI = JSON.parse(fs.readFileSync("configuration/disperser_abi.json"));

export const initDisperserContractInstance = async (chain, wallet) => {
    return new ethers.Contract(chain.disperser_address, DISPERSER_ABI, wallet);
}

export const estimateDisperseGasOnChain = async (provider, disperseContractInstance, wallets, dispersableAmount, desiredPrice) => {
    const estimatedMintGas = await disperseContractInstance.estimateGas.disperseMatic(wallets, dispersableAmount);

    return estimatedMintGas;
}

export const disperse = async (chain, mainWallet, wallets, dispersableAmount, desiredPrice) => {

    console.log("Initializing contract connection");
    const disperserContractInstance = await initDisperserContractInstance(chain, mainWallet);
    console.log("Performing disperse");
    const totalDispersable = (new Decimal(desiredPrice).mul(new Decimal(wallets.length))).toString();
    const metrics = await getGasMetrics(chain["gas_metrics"]);

    await disperserContractInstance.disperseMatic(wallets, dispersableAmount, {value: ethers.utils.parseEther(totalDispersable), 
                                                                               maxFeePerGas: metrics.maxFeePerGas, 
                                                                               maxPriorityFeePerGas: metrics.maxPriorityFeePerGas});
    console.log("Disperse completed");

}

