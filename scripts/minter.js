import { createRequire } from "module";
const require = createRequire(import.meta.url);
const prompt = require("prompt-sync")({ sigint: true });
const { ethers } = require("ethers");
const Decimal = require('decimal.js');
import {calculateRequiredGasFee, initXenContractInstance, recoverFunds, writeReport, getGasMetrics, getCurrentDate, getDateAfterDays} from "./helpers.js";




export const estimateMintGasOnChain = async (chain, contract_instance, term) => {
  let estimatedMintGas = calculateRequiredGasFee(
      (await getGasMetrics(chain["gas_metrics"])).maxFeePerGas, await contract_instance.estimateGas.claimRank(term)
    );

  return estimatedMintGas;
}

export const inputDesiredPrice = () => {
  let price = "random";
  
  while(isNaN(price))
  {
    price = prompt("Enter mint price limit: ");
  }
  price = Number(price);

  return price > 0 ? price : null;
}

export const estimateFundingAmount = async (dispersableAmount, nbWallets, disperse_cost, url) => {
  const fundingAmount = ((dispersableAmount.add((await getGasMetrics(url)).maxFeePerGas)).mul(nbWallets)).add(ethers.utils.parseEther(disperse_cost));

  return new Decimal(ethers.utils.formatEther(fundingAmount));
}

const inputTerm = () => {
  let term = "random";
  
  while(term.trim() === "" || isNaN(term))
  {
    term = prompt("Enter mint term: ");
  }
  term = parseInt(term);

  return term;
}

export const validateTerm = (min_term, max_term) => {
  let in_term = inputTerm();

  while(in_term > max_term || in_term < min_term)
  {
    in_term = Math.floor(inputTerm());
  }

  return in_term;
}


const getCurrentMaxTerm = async (contract_instance) => {
  return Math.floor((await contract_instance.getCurrentMaxTerm()) / (60 * 60 * 24));
}

const getMinTerm = async (contract_instance) => {
  return Math.ceil(Number(await contract_instance.MIN_TERM()) / (60 * 60 * 24));
}

const mintProcess = async(chain, wallet, term, desiredPrice, waitingPeriod) => {

  const xenContractInstance = await initXenContractInstance(chain, wallet);
  let currentMintingPrice = await estimateMintGasOnChain(chain, xenContractInstance, term);
  
  while(currentMintingPrice > desiredPrice)
  {
    console.log(`Current mint price: ${currentMintingPrice}, desired mint price: ${desiredPrice}`);
    await new Promise(dummy => setTimeout(dummy, waitingPeriod));
    currentMintingPrice = await estimateMintGasOnChain(chain, xenContractInstance, term);
  }
  const metrics = await getGasMetrics(chain["gas_metrics"]);
  await xenContractInstance.claimRank(term, {maxFeePerGas: metrics.maxFeePerGas, 
                                            maxPriorityFeePerGas: metrics.maxPriorityFeePerGas});

}


export const getTermBounds = async (contract_instance) => {
  return {"minTerm": await getMinTerm(contract_instance), "maxTerm": await getCurrentMaxTerm(contract_instance)};
}

export const mint = async (chain, wallets, termBounds, desiredPrice, waitingPeriod, walletsDirpath, mainWallet, blockNumber, modeId) => {

  const term = validateTerm(termBounds.minTerm, termBounds.maxTerm);
  let counter = 0;
  let ok = 0;
  let failed = 0;
  let processed = [];

  wallets.forEach((wallet) => {
    console.log(`Minting with wallet ${++counter}: ${wallet.address}`);
    mintProcess(chain, wallet, term, desiredPrice, waitingPeriod).then(() => {
      console.log(`Minted successfully with: ${wallet.address}`);
      processed.push({"Address": wallet.address, "Mint day": getCurrentDate(), "Mint price": desiredPrice, "Term days": term, "Claim date": getDateAfterDays(getCurrentDate(), term), "Status": "OK"});
      ++ok;
    })
    .catch((err) => {
      console.log(err);
      console.log(`Minting failed with: ${wallet.address}`);
      processed.push({"Address": wallet.address, "Mint price": desiredPrice, "Term days": term, "Status": "FAILED"});
      ++failed;
    })
    .finally(async () => {
      if(ok + failed === wallets.length)
      {
        console.log("Finished minting");
        await recoverFunds(mainWallet, wallets, blockNumber, chain);
        processed.unshift({"CHAIN": chain["name"], "ENCRYPTION": modeId, "TOTAL_OK": ok, "TOTAL_FAILED": failed});
        writeReport(walletsDirpath, processed);
      }
    })
    
  });



}
