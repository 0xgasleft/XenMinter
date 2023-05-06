import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ethers } = require("ethers");
const fs = require('fs');
const prompt = require("prompt-sync")({ sigint: true });
const axios = require('axios');




export const WALLET_GENERATION_MODES = [{"id": "1", "name": "Fast mode", "description": "Plain text wallets"}, 
                                {"id": "2", "name": "Slow mode", "description": "Securely encrypted wallets"}]; 


const XEN_ABI = JSON.parse(fs.readFileSync("configuration/xen_abi.json"));
const SUPPORTED_CHAINS = JSON.parse(fs.readFileSync("configuration/config.json"));

export const getCurrentDate = () => {
    return new Date().toLocaleDateString();
}

export const getDateAfterDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toLocaleDateString();
}

export const calculateRequiredGasFee = (maxFeePerGas, units_estimation) => {
    //return (await axios.get('https://api.blocknative.com/gasprices/blockprices?chainid=137')).data.blockPrices[0].baseFeePerGas;
    return (units_estimation * maxFeePerGas) / (10 ** 18);
 
}


const initWalletInstance = (walletFilePath, passphrase, hook, modeId) => {
    
    const walletContent = fs.readFileSync(walletFilePath);
    const walletObject = JSON.parse(walletContent);

    if(modeId === "1")
    {
        return ethers.Wallet.fromMnemonic(JSON.parse(walletObject).mnemonic.phrase).connect(hook);
    }
    else if(modeId === "2")
    {
        return ethers.Wallet.fromEncryptedJsonSync(walletObject, passphrase).connect(hook);
    }
    else 
    {
        return null;
    }
    
}

export const getSupportedChains = () => {
    return SUPPORTED_CHAINS;
}

export const chooseChain = () => {
    console.log("Supported chains:");
    for(let chain of SUPPORTED_CHAINS)
    {
      console.log(chain["id"] + "-" + chain["name"]);
    }

    let chain_id = "";
    let supported_chain_ids = SUPPORTED_CHAINS.flatMap(chain => chain.id);

    while(!supported_chain_ids.includes(chain_id))
    {
      chain_id = prompt("Choose your chain (ex: 1 for ETH): ");
    }
    let selected_chain = SUPPORTED_CHAINS.filter(chain => chain.id === chain_id);
    console.log(`You selected ${selected_chain[0].name} chain.`);
    return selected_chain[0];
}

export const initChainHook = async (chain) => {
    return new ethers.providers.JsonRpcProvider(chain["rpc"]);
}

export const initXenContractInstance = async (chain, wallet_instance) => {
    
    return new ethers.Contract(chain["xen_address"], XEN_ABI, wallet_instance);
}

export const getWalletsInstances = (walletsDirpath, passphrase, hook, modeId) => {
    if(fs.existsSync(walletsDirpath))
    {
        let wallets = fs.readdirSync(walletsDirpath);
        if(wallets.length > 0)
        {
            return wallets.map(wallet => initWalletInstance(walletsDirpath + "/" + wallet, passphrase, hook, modeId));
        }
        else
        {
            console.log(`Main wallet is missing in folder : ${walletsDirpath}`);
            return null;
        }
        
    }
    else
    {
        console.log(`Folder of wallets is missing : ${walletsDirpath}`);
        return null;
    }
}

export const getMainWalletInstance = async (walletsDirpath, passphrase, hook, modeId) => {
    if(fs.existsSync(walletsDirpath))
    {
        let mainWallet = fs.readdirSync(walletsDirpath).filter(walletFilename => walletFilename.includes("main"));
        if(mainWallet.length > 0)
        {
            return initWalletInstance(walletsDirpath + "/" + mainWallet[0], passphrase, hook, modeId);
        }
        else
        {
            console.log(`Main wallet is missing in folder : ${walletsDirpath}`);
            return null;
        }
        
    }
    else
    {
        console.log(`Folder of wallets is missing : ${walletsDirpath}`);
        return null;
    }
}

export const parseAsReadable = (bn) => {
    return parseFloat(ethers.utils.formatEther(bn));
}

export const writeReport = (walletsDirpath, processed) => {
    console.log("Writing mint report to '_REPORT_.json'");
    if(fs.existsSync(walletsDirpath))
    {
        fs.writeFileSync(`${walletsDirpath}/_REPORT_.json`, JSON.stringify(processed), err => {
            if (err) {
                console.error(err);
            }
        });
    }
    else
    {
        console.log(`Folder of wallets is missing : ${walletsDirpath}`);
    }
}



const guessSourceWallet = async (mainWallet, blockNumber, chain) => {
    console.log("Trying to guess source wallet");
    const historyParams = `module=account&action=txlist&address=${mainWallet.address}&startblock=${blockNumber}&endblock=99999999&page=1&offset=10&sort=asc&apikey=${chain["explorer_key"]}`;

        const endpoint = `${chain["explorer_api"]}?${historyParams}`;
        await new Promise(dummy => setTimeout(dummy, 10000));

        const history = (await axios.get(endpoint));
        if(history == undefined) return null;
        const historyData = history.data;
        if(historyData == undefined) return null;
        const historyResults = historyData["result"];
        if(historyResults == undefined || historyResults.length < 1) return null;
        const historyResult = historyResults[0];
        if(historyResult == undefined || historyResult["from"] == undefined) return null;
        return historyResult["from"];


}

const validateAddress = (address) => {
    if(typeof address == "string")
    {
        address = address.toLowerCase();
        return (address.length == 42 && address.includes("0x") && address.match(/^[0-9a-z]+$/));
    }
    else
    {
        return false;
    }
    
}

const validateAddressProcess = () => {
    let validAddress = false;
    while(!validAddress)
    {
        sourceWalletAddress = prompt("Write carefully your source wallet: "); 
        validAddress = validateAddress(sourceWalletAddress);
        if(!validAddress)
        {
            console.log("Bad format of address, retry");
        }
    }

    return sourceWalletAddress;
}

const validateSourceWallet = async (mainWallet, blockNumber, chain) => {
    let sourceWalletAddress = await guessSourceWallet(mainWallet, blockNumber, chain);
    if(sourceWalletAddress != null)
    {
        console.log(`Is this your source wallet address: ${sourceWalletAddress}`);
        const answer = prompt("Your answer (yes/no): ");
        if(answer.toLowerCase() != "no")
        {
            return sourceWalletAddress;
        }
        else
        {
            return validateAddressProcess();
        }
    }
    else
    {
        return validateAddressProcess();
    }

}

const getSendTx = (receiver, amount, totalEstimatedGas, metrics) => {
    return {
            to: receiver, 
            value: ethers.utils.parseUnits((amount - totalEstimatedGas).toString(), "wei"),
            maxFeePerGas: metrics.maxFeePerGas, 
            maxPriorityFeePerGas: metrics.maxPriorityFeePerGas
        };
}

export const recoverFunds = async (mainWallet, wallets, blockNumber, chain) => {
    console.log("Recovering remaining funds from all wallets and sending it to source wallet");

    const sourceWalletAddress = await validateSourceWallet(mainWallet, blockNumber, chain);
    let counter = 0;

    for(const wallet of wallets)
    {
        let walletBalance = await wallet.getBalance();
        console.log(`Refunding from wallet ${++counter}: ${wallet.address}`);
        console.log(`Wallet balance: ${parseAsReadable(walletBalance)}`);
        
        
        try
        {
            const transferEstimateGas = await mainWallet.provider.estimateGas({to: sourceWalletAddress});
            const metrics = await getGasMetrics(chain["gas_metrics"]);
            const totalEstimatedGas = transferEstimateGas * metrics.maxFeePerGas;

            if(totalEstimatedGas > walletBalance)
            {
                console.log(`Gas value ${parseAsReadable(totalEstimatedGas)} is greater than recoverable amount ${parseAsReadable(walletBalance)}, skipping...`);
                continue;
            }
            await wallet.sendTransaction(getSendTx(sourceWalletAddress, walletBalance, totalEstimatedGas, metrics));
        }
        catch(err)
        {
            console.log(err);
            console.log("Refunding for this wallet failed, jumping to next one.");
            continue;
        }
       
    }

}

export const getGasMetrics = async (metricsUrl) => {
    let maxFeePerGas = ethers.BigNumber.from(40000000000) // fallback to 40 gwei
    let maxPriorityFeePerGas = ethers.BigNumber.from(40000000000) // fallback to 40 gwei
    try {
        const { data } = await axios({
            method: 'get',
            url: metricsUrl
        })
        maxFeePerGas = ethers.utils.parseUnits(
            Math.ceil(data.standard.maxFee) + '',
            'gwei'
        )
        maxPriorityFeePerGas = ethers.utils.parseUnits(
            Math.ceil(data.standard.maxPriorityFee) + '',
            'gwei'
        )
    } 
    catch {}

    return {"maxFeePerGas": maxFeePerGas, "maxPriorityFeePerGas": maxPriorityFeePerGas};
}
