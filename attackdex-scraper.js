const puppeteer = require('puppeteer');
const fs = require('fs');
const { default: axios } = require('axios');
const mongoose = require("mongoose");
require('dotenv').config();
const _ = require("lodash");

const Move = require("./models/move");

//      current Move fields ======
//     name:           { type: String, required: true },
//     type:           { type: String, required: true },
//     category:       { type: String, required: true },
//     power:          { type: String, required: true },
//     accuracy:       { type: String, required: true },
//     powerpoints:    { type: String, required: true },
//     effect:         { type: String, required: true },


const genUrls = [
    "attackdex-rby",    // gen 1 red-blue
    "attackdex-gs",     // gen 2 gold-silver
    "attackdex",        // gen 3 ruby-sapphire
    "attackdex-dp",     // gen 4 diamond-pearl
    "attackdex-bw",     // gen 5 black-white
    "attackdex-xy",     // gen 6 x-y
    "attackdex-sm",     // gen 7 sun-moon
    "attackdex-swsh"    // gen 8 sword-shield
]

let allMoveUrls = { }



async function scrape(page) {

    //let moveList = await page.$$eval("select option", option => option.map(v => v.value));


    let moveArray = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("select option")).map(element => {
            if (element.value[0] === "/") {
                return element.value;
            }
        });
    });

    moveArray = moveArray.filter(move => {
        if (move !== null) {
            return move;
        }
    });

    moveArray.forEach(move => {
        console.log(move);
    });

    console.log(moveArray.length);
}

async function getMovesFromGen(browser) {
    let page = await browser.newPage();
    
    for (let i = 0; i < genUrls.length; i++) {
        await page.goto("https://www.serebii.net/" + genUrls[i]);
        let moveArray = await page.evaluate(() => {
            let tempArray = Array.from(document.querySelectorAll("select option")).map(element => {
                if (element.value[0] === "/") {
                    return element.value; //  
                }
            });
            return tempArray.filter(moveUrl => {
                if (moveUrl !== null) {
                    return moveUrl;
                }
            })
        });
        let generation = `gen${i + 1}`;
        allMoveUrls = {
            ...allMoveUrls,
            [generation]: moveArray
        }
    }
}

async function getGenMoves(browser, generationNum) {
    let page = await browser.newPage();
    await page.goto(`https://pokemondb.net/move/generation/${generationNum}`);

    const tableSelector = "#moves tbody";
    const tableLength = await page.$$eval(`${tableSelector} > tr`, el => el.length);

    let moveArray = [];

    for (let i = 1; i < tableLength + 1; i++) {
        const name = await page.evaluate(el => el.innerText, await page.$(`${tableSelector} > tr:nth-child(${i}) > td:nth-child(1)`));
        const type = _.capitalize(await page.evaluate(el => el.innerText, await page.$(`${tableSelector} > tr:nth-child(${i}) > td:nth-child(2)`)));
        
        let category = await page.evaluate((i) => {
            let el = document.querySelector(`#moves tbody tr:nth-child(${i}) td:nth-child(3) img`);
            if (el) {
                return el.title;
            } else {
                return "-";
            }
        }, i);
        
        const power = await page.evaluate(el => el.innerText, await page.$(`${tableSelector} > tr:nth-child(${i}) > td:nth-child(4)`));
        const accuracy = await page.evaluate(el => el.innerText, await page.$(`${tableSelector} > tr:nth-child(${i}) > td:nth-child(5)`));
        const powerpoints = await page.evaluate(el => el.innerText, await page.$(`${tableSelector} > tr:nth-child(${i}) > td:nth-child(6)`));
        const effect = await page.evaluate(el => el.innerText, await page.$(`${tableSelector} > tr:nth-child(${i}) > td:nth-child(7)`));
        const introGen = generationNum;

        const newMove = new Move({
            name: name,
            type: type,
            category: category,
            power: power,
            accuracy: accuracy,
            powerpoints: powerpoints,
            effect: effect,
            introGen: introGen
        });
        moveArray.push(newMove);
    }

    console.log("Gen " + generationNum + " done!");
    return moveArray;
}





async function main() {

    const puppeteerOptions = {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
        headless: true,
        // fix for two different workstation setups with different drive setups
        //executablePath: "C:/Users/Kyle/Dropbox/Projects/pokemon-scraper/node_modules/puppeteer/.local-chromium/win64-961656/chrome-win/chrome.exe",
    }
    
    const browser = await puppeteer.launch({
        puppeteerOptions
    });

    let allMoves = new Object();

    for (let i = 1; i <= 8; i++) {
        let generationMoves = await getGenMoves(browser, i);
        allMoves[`gen${i}`] = generationMoves;
    }

    console.log(allMoves);
    
    await browser.close();
}

main();