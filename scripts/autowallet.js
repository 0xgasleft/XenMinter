import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ethers } = require("ethers");
const fs = require('fs');
const prompt = require("prompt-sync")({ sigint: true });
import {encryptKeystore} from "@ethersproject/json-wallets";
import {WALLET_GENERATION_MODES} from "./helpers.js";
    


const initDirs = () => {
    if(!fs.existsSync("wallets"))
    {
        fs.mkdirSync("wallets");
    }

    const walletsDirname = new Date().toISOString().replaceAll(':', '-');
    const walletsDirPath = `wallets/${walletsDirname}`;

    if(!fs.existsSync(walletsDirPath))
    {
        fs.mkdirSync(walletsDirPath);
    }

    return walletsDirPath;
    
}

const chooseGenerationMode = () => {
    console.log("Select wallet generation mode:");
    for(const mode of WALLET_GENERATION_MODES)
    {
        console.log(`${mode["id"]}- ${mode["name"]} => ${mode["description"]}`);
    }

    let modes_ids = WALLET_GENERATION_MODES.flatMap(mode => mode.id);
    let selectedModeId = "random";
    while(!modes_ids.includes(selectedModeId))
    {
        selectedModeId = prompt("Enter your selected mode (1 or 2): ");
    }
    
    const selectedMode = WALLET_GENERATION_MODES.filter(mode => mode.id === selectedModeId);
    console.log(`You selected ${selectedMode[0]["name"]}`);
    return selectedModeId;
}

const chooseNumberOfWallets = () => {
    let nbWallets = "random";
    while(nbWallets.trim() === "" || isNaN(nbWallets))
    {
        nbWallets = prompt("Enter number of wallets (ex: 10): ");
    }
    console.log(`You want ${nbWallets} wallet(s).`);
    return Number(nbWallets);
}

const writeWalletSlowly = async (walletsDirpath, prefix, passphrase) => {
    const wallet = ethers.Wallet.createRandom();
    fs.writeFile(`${walletsDirpath}/${prefix}_${new Date().toISOString().replaceAll(':', '-')}.json`, JSON.stringify(await encryptKeystore(wallet, passphrase)), err => {
        if (err) {
            console.error(err);
        }
    });
}

const writeWalletFastly = async (walletsDirpath, prefix) => {
    const wallet = ethers.Wallet.createRandom();
    const writable_obj = {"address": wallet.address, "mnemonic": wallet.mnemonic};
    fs.writeFileSync(`${walletsDirpath}/${prefix}_${new Date().toISOString().replaceAll(':', '-')}.json`, "\"" + JSON.stringify(writable_obj).replaceAll("\"","\\\"") + "\"", err => {
        if (err) {
            console.error(err);
        }
    });
}

const autowalletSlow = async (nbWallets, walletsDirpath, passphrase) => {
    
    await writeWalletSlowly(walletsDirpath, "main", passphrase);
    for(let counter = 0; counter < nbWallets; counter++)
    {
        console.log("Generating wallet " + (counter + 1));
        await writeWalletSlowly(walletsDirpath, "wallet", passphrase);
    }
}

const autowalletFast = (nbWallets, walletsDirpath) => {
    writeWalletFastly(walletsDirpath, "main");
    for(let counter = 0; counter < nbWallets; counter++)
    {
        console.log("Generating wallet " + (counter + 1));
        writeWalletFastly(walletsDirpath, "wallet");
    }
}

export const autowallet = async () => {

    const modeId = chooseGenerationMode();
    const nbWallets = chooseNumberOfWallets();
    const walletsDirpath = initDirs();
    let passphrase = null;

    if(modeId == "1")
    {
        autowalletFast(nbWallets, walletsDirpath);
    }
    else if(modeId == "2")
    {
        passphrase = prompt("Enter passphrase for wallet(s) encryption: ");
        await autowalletSlow(nbWallets, walletsDirpath, passphrase);
    }

    return {"nbWallets": nbWallets, "walletsDirpath": walletsDirpath, "modeId": modeId, "passphrase": passphrase};
    

}
