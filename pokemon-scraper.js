const puppeteer = require('puppeteer');
const fs = require('fs');
const { default: axios } = require('axios');
const mongoose = require("mongoose");
require('dotenv').config();

const { Pokemon } = require('./models/pokemon');
const { Weaknesses } = require('./models/pokemon');
const { PokemonMove } = require('./models/pokemon');
const { PokemonMoveset }= require('./models/pokemon');

let pokedex = [];

/**
 * Handles method calls to scrape each Pokemon from the website, create a new document, add it to a collection,
 * and fetch the URL for the next call.
 * @param {puppeteer.Page} page 
 * @returns {Promise} nextPokemonUrl - represents the URL for the next iteration
 */
async function scrape(page) {
    let nameAndIdArray = await getNameAndNum(page);

    let pokemonNum = nameAndIdArray[0];
    let pokemonName = nameAndIdArray[1];

    let typesArray = await getTypes(page);

    let abilitiesArray = await getAbilities(page);

    let weaknesses = await getWeaknesses(page);

    let pokemonClassification = await getClassification(page);

    let movesets = await getMovesets(page);

    let spriteLink = await getSprite(page);
    console.log('Sprite link ' + spriteLink);

    
    let newPokemon = new Pokemon({
        name: pokemonName,
        natDexNo: pokemonNum,
        types: typesArray,
        abilities: abilitiesArray,
        weaknesses: weaknesses,
        classification: pokemonClassification,
        movesets: movesets,
    });

    let nextPokemonUrl = await getNextPokemon(page);

    //===== 2 different ways to handle scraped data:

    //pokedex.push(newPokemon);         // add the document to array in memory for testing, etc.
    newPokemon.save();                  // save document to mongodb for later access
    console.timeEnd("documentSave");

    return nextPokemonUrl;
}

/**
 * Sets up the array collection for movesets available to the current Pokemon. The names of the sets are passed to getMoves() as
 * arguments in the loop to target tables on the page.
 * @param {puppeteer.Page} page 
 * @returns {Promise} movesets - represents array of available level up movesets
 */
async function getMovesets(page) {
    let setNamesWithSource = [
        'Standard Level Up',
        'Galarian Form Level Up',
        'Alola Form Level Up',
    ]

    let movesets = [];

    for (let setName of setNamesWithSource) {
        let set = await getMoves(page, setName);
        if (set != null) movesets.push(set);
    }

    return movesets;    
}

/**
 * Parses moveset table on the page to create PokemonMove and PokemonMoveset documents.
 * @param {puppeteer.Page} page 
 * @param {string} set - name of the moveset table to parse data from
 * @returns {Promise} moveSet - represents a PokemonMoveset which contains the source of the moves and an array of those PokemonMove
 */
async function getMoves(page, set) {
    let moveSet = new PokemonMoveset({
        source: '',
        set: []
    });

    let moveTableArray;

    try {
        let moveTable = await page.waitForXPath(`//table[@class=\'dextable\']/tbody[contains(., \'${set}\')]`, {timeout: 1000});
    
        moveTableArray = await moveTable.$$eval('table tr td', tds => tds.map((td) => {
            if (td.innerText == '') {
                return td.querySelector('img').getAttribute('alt'); // status cells have no text; grab alt string from HTML tag
            }
            return td.innerText.trim();
        }));
    } catch (e) {
        if (e instanceof puppeteer.errors.TimeoutError) { // dex entry doesn't have this set, common occurrence
            return null;
        }
        console.log(e.name + ' getting moves for a set at ' + page.url());
        return null;
    }

    moveSet.source = moveTableArray[0];

    for (let i = 1; i < moveTableArray.length; i += 9) {
        let name = moveTableArray[i + 1];

        // process the status cells
        let type = moveTableArray[i + 2].replace(name + ' - ', '').replace('-type', '');
        let category = moveTableArray[i + 3].replace(name + ': ', '').replace(' Move', '');
        if (category == 'Other') {
            category = 'Status';
        }

        let newPokemonMove = new PokemonMove({
            levelOrTM:      moveTableArray[i],
            name:           name,
            type:           type,
            category:       category,
            power:          moveTableArray[i + 4],
            accuracy:       moveTableArray[i + 5],
            powerpoints:    moveTableArray[i + 6],
            effectPercent:  moveTableArray[i + 7],
            description:    moveTableArray[i + 8],
        });
        moveSet.set.push(newPokemonMove);
    }

    return moveSet;
}

/**
 * Retrieves URL for the next pass through the loop
 * @param {puppeteer.Page} page 
 * @returns {Promise} nextPokemonUrl - represents the next Pokemon's URL string
 */
async function getNextPokemon(page) {
    let nextPokemonUrl;
    try {
        let nextPokemon = await page.waitForXPath('//*[@id="rbar"]/table[@class[contains(.,\'tooltab\')]]/tbody/tr[2]/td[3]/a', {timeout: 1000});
        nextPokemonUrl = await page.evaluate(el => el.href, nextPokemon);
    } catch (e) {
        if (e instanceof puppeteer.errors.TimeoutError) {
            console.log('End of Pokedex');
            nextPokemonUrl = null;
        }
        console.log(e.name + ' getting next Pokemon URL at ' + page.url());
    }

    return nextPokemonUrl;
}

/**
 * Retrieves name and number from a table on the page
 * @param {puppeteer.Page} page 
 * @returns {Promise} nameArray - represents string array containing number and name of entry
 */
async function getNameAndNum(page) {
    let nameText;
    try {
        let name = await page.waitForSelector('#content > main > div:nth-child(2) > table:nth-child(1) > tbody > tr > td:nth-child(1) > table > tbody > tr > td:nth-child(2) > h1');
        nameText = await page.evaluate(name => name.textContent, name);
    } catch (e) {
        console.log(e.name + ' while getting name and number at ' + page.url());
        return null;
    }

    let nameArray = nameText.split(' ');
    nameArray[0] = nameArray[0].replace('#', '').trim();
    
    return nameArray;
}

/**
 * Parses the type table on the page. Pokemon with no regional variants are handled in the if statement and have no text in the table.
 * Pokemon with regional variants are handled in the else statement and have text indicating regional typing
 * @param {puppeteer.Page} page 
 * @returns {Promise} allTypes or normalTypes - objects representing all possible variants and their types for the Pokemon on the page
 */
async function getTypes(page) {
    let typeBoxText;
    try {          
        let typeBox = await page.waitForXPath(`//table[@class=\'dextable\']/tbody[contains(., \'Other Names\')]/tr[2]/td[5]`, {timeout: 1000});
        typeBoxText = await page.evaluate(el => el.textContent.trim(), typeBox);
    } catch (e) {
        console.log(e.name + ' parsing text in types box at ' + page.url());
    }

    if (typeBoxText == '') { // no regional variants, types are shown just with images in the table body
        let normalTypes = {
            Normal: []
        }
        let type1Text;
        try {
            let type1 = await page.waitForXPath('//table[@class=\'dextable\']/tbody[contains(., \'Other Names\')]/tr[2]/td[5]/a[1]/img', {timeout: 1000});
            type1Text = await page.evaluate(type1 => type1.alt, type1);
        } catch (e) {
            console.log(e.name + ' while parsing type 1 at ' + page.url());
        }
        
        type1Text = type1Text.replace('-type', '');
        normalTypes.Normal.push(type1Text);
        
        try { // type 2
            let type2 = await page.waitForXPath('//table[@class=\'dextable\']/tbody[contains(., \'Other Names\')]/tr[2]/td[5]/a[2]/img', {timeout: 1000});
            let type2Text = await page.evaluate(type2 => type2.alt, type2);
            type2Text = type2Text.replace('-type', '');
            normalTypes.Normal.push(type2Text);
        } catch (e) {
            if (!(e instanceof puppeteer.errors.TimeoutError)) {
                // there is no second type found, but this is fine and a common case
                console.log(e.name + ' while getting type 2 at ' + page.url());
                return null;
            }
        }
        return normalTypes;
    }

    else { // regional variants are present
        let allTypes = await page.evaluate(() => {
            let variantNamesElements = document.querySelectorAll('#content > main > div:nth-child(2) > table:nth-child(5) > tbody > tr:nth-child(2) > td.cen > table > tbody > tr > td:first-child');
            let variantNames = [];
            variantNamesElements.forEach(item => variantNames.push(item.innerText));
    
            let variantTypesElements = document.querySelectorAll('#content > main > div:nth-child(2) > table:nth-child(5) > tbody > tr:nth-child(2) > td.cen > table > tbody > tr > td:nth-child(2)');
            let allVariantTypes = [];
            variantTypesElements.forEach(function(td) {
                let currVariantTypes = [];
                let imgElements = td.querySelectorAll('a img');
                imgElements.forEach(img => currVariantTypes.push(img.alt.replace('-type', '')));
                allVariantTypes.push(currVariantTypes);
            });
    
            // new object using regional variant names as keys
            let typesBox = Object.fromEntries(variantNames.map((key, index) => [key, allVariantTypes[index]]));
            return typesBox;
        })
                .catch(e => {
                    console.log(e.name + ' while getting regional variant types at ' + page.url());
                    return null;
                });

        return allTypes;
    }
}

/**
 * Parses the ability table into an array containing regular and hidden abilities for all present forms
 * @param {puppeteer.Page} page 
 * @returns {Promise} allAbilities - represents an array containing objects for each form with normal and hidden abilities if present
 */
async function getAbilities(page) {
    let abilitiesText;
    try {
        let abilities = await page.waitForXPath(`//table[@class=\'dextable\']/tbody[contains(., \'Abilities\')]/tr[2]/td[1]`, {timeout: 1000});
        abilitiesText = await page.evaluate(abilities => abilities.textContent, abilities);
    } catch (e) {
        console.log(e.name + ' while getting abilities at ' + page.url());
        return null;
    }
    
    let abilitiesArray = abilitiesText
                            .trim()
                            .split('\n')
                            .map(s => s.trim());

    let index = 0;
    let variantIndices = [];
    abilitiesArray.forEach(element => { // find sections of ability string indicating regional variant-specific abilities
        if (element.includes('Form Abilities')) {
            variantIndices.push(index);
        }
        if (element.includes('Forme Ability')) {
            variantIndices.push(index);
        }
        index++;
    });

    let allAbilities = [];

    // 1+ alternative form was found (Meowth is the only instance of 3 forms)
    if (variantIndices.length > 0) {
        // for loop separates the original array into chunks starting with the alt form name by splicing at
        // the indices found in abilitiesArray
        for (let i = variantIndices.length - 1; i >= 0; i--) {
            // placeholder variant object to fill in with data
            let variant = {
                variantName: '',
                abilities: [],
                hiddenAbility: null,
            };

            let variantArray = abilitiesArray.splice(variantIndices[i]);
            
            // determine which regional variant is present
            if (variantArray[0].includes('Galarian Form Abilities:')) {
                variant.variantName = 'Galarian Form';
                variantArray[0] = variantArray[0].replace('Galarian Form Abilities:', '').trim();
            }

            if (variantArray[0].includes('Alola Form Abilities:')) {
                variant.variantName = 'Alola Form';
                variantArray[0] = variantArray[0].replace('Alola Form Abilities:', '');
            }

            if (variantArray[0].includes('Therian Forme Ability:')) {
                variant.variantName = 'Therian Forme';
                variantArray[0] = variantArray[0].replace('Therian Forme Ability:', '');
            }

            // parse out hidden ability if there is one -> it is always the last one listed per section
            let hiddenAbility = null;
            if (variantArray[variantArray.length - 1].includes('Hidden Ability:')) {
                hiddenAbility = variantArray[variantArray.length - 1].replace('Hidden Ability: ', '');
                variant.hiddenAbility = hiddenAbility;
                variantArray.pop();
            }
            variant.abilities = variantArray;

            allAbilities.push(variant);
        }
    }

    // this section handles normal form abilities for every iteration
    let hiddenAbility = null;
    if (abilitiesArray[abilitiesArray.length - 1].includes('Hidden Ability:')) {
        hiddenAbility = abilitiesArray[abilitiesArray.length - 1].replace('Hidden Ability:', '');
        abilitiesArray.pop();
    }

    let variant = {
        variantName: 'Normal',
        abilities: abilitiesArray,
        hiddenAbility: hiddenAbility,
    }    
    allAbilities.push(variant);

    return allAbilities;
}

/**
 * Parse the table containing type weaknesses into a document object
 * @param {puppeteer.Page} page 
 * @returns pokemonWeaknesses - document containing all type weaknesses
 */
async function getWeaknesses(page) {
    let weaknessesText;
    try {
        let weaknesses = await page.waitForXPath('//table[@class=\'dextable\']/tbody[contains(., \'Weakness\')]/tr[3]', {timeout: 1000});
        weaknessesText = await page.evaluate(weaknesses => weaknesses.textContent, weaknesses);
    } catch (e) {
        console.log(e.name + ' while getting weaknesses at ' + page.url());
    }
    
    // normal, fire, water, electric, grass, ice, fighting, poison, ground, flying, psychic, bug, rock, ghost, dragon, dark, steel, fairy
    weaknessesArray = weaknessesText.trim().split('\n').map(s => s.trim());
   
    let pokemonWeaknesses = new Weaknesses({
        normal:     weaknessesArray[0],
        fire:       weaknessesArray[1],
        water:      weaknessesArray[2],
        electric:   weaknessesArray[3],
        grass:      weaknessesArray[4],
        ice:        weaknessesArray[5],
        fighting:   weaknessesArray[6],
        poision:    weaknessesArray[7],
        ground:     weaknessesArray[8],
        flying:     weaknessesArray[9],
        psychic:    weaknessesArray[10],
        bug:        weaknessesArray[11],
        rock:       weaknessesArray[12],
        ghost:      weaknessesArray[13],
        dragon:     weaknessesArray[14],
        dark:       weaknessesArray[15],
        steel:      weaknessesArray[16],
        fairy:      weaknessesArray[17],
    });

    return pokemonWeaknesses;
}

/**
 * Returns the "classification" data from the page, which is a short description of the Pokemon
 * @param {puppeteer.Page} page 
 * @returns {Promise} classificationText - represents string of the classification
 */
async function getClassification(page) {
    let classificationText;
    try {
        let classification = await page.waitForXPath('//*[@id="content"]/main/div[2]/table[contains(., \'Classification\')]/tbody/tr[4]/td[1]');
        classificationText = await page.evaluate(el => el.textContent, classification);
    } catch (e) {
        console.log(e.name + ' while getting classification from ' + page.url());
        return null;
    }
    
    return classificationText;
}

/**
 * Parses the image on the page for a link to follow for downloading it and passes to downloadSprite() method
 * @param {puppeteer.Page} page 
 * @returns {Promise} spriteLinkText - represents URL which was passed to downloadSprite(), logged in scrape() func
 */
async function getSprite(page) {
    let spriteLinkText;
    try {
        let spriteLink = await page.waitForXPath('//*[@id="content"]/main/div[2]/table[contains(., \'Picture\')]/tbody/tr[2]/td/table/tbody/tr/td[1]/img', {timeout: 1000})
        spriteLinkText = await page.evaluate(el => el.src, spriteLink);
        let fileName = spriteLinkText.replace('https://www.serebii.net/swordshield/pokemon/', ''); // ${natDexNo}.png
        downloadSprite(spriteLinkText, fileName);
    } catch (e) {
        console.log(e.name + ' while getting sprite download link at ' + page.url());
        return null;
    }
    
    return spriteLinkText;
}

/**
 * Solution adapted from Grant Miller's response here: https://stackoverflow.com/questions/12740659/downloading-images-with-node-js?answertab=modifieddesc#tab-top
 * Called from getSprite method, downloads the image of the Pokemon into the images folder
 * @param {string} url - image link
 * @param {string} fileName - name to save the image as; is always the dex number 
 */
const downloadSprite = (url, fileName) => {
    axios({
        url, responseType: 'stream',
    }).then(
        response => 
            new Promise((resolve, reject) => {
                response.data
                    .pipe(fs.createWriteStream(`./images/${fileName}`))
                    .on('finish', () => resolve())
                    .on('error', e => reject(e));
            }),
    );
};

/**
 * Handles connecting to MongoDB Atlas
 */
function connectToDB() {
    mongoose.connect(process.env.MONGOOSE_CONNECTION)
        .then(() => {
            console.log('Connected to MongoDB backend');
        })
        .catch(() => {
            console.log('Connection to MongoDB failed');
        });
}

async function main() {
    connectToDB();

    // Edi Imanto's answer here: https://stackoverflow.com/questions/49008008/chrome-headless-puppeteer-too-much-cpu
    const options = {
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
        executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    }
    const browser = await puppeteer.launch({
        options
    });

    let page = await browser.newPage();
    await page.goto('https://www.serebii.net/pokedex-swsh/bulbasaur');

    // there are technically 905 different Pokemon, but with variants and regional changes the Serebii national dex for
    // gen8 has 845 entry pages
    // for (i = 0; i < 845; i++) {
    //     console.time("allData");
    //     let nextPokemonUrl = await scrape(page);
    //     await page.close();
    //     console.timeEnd("allData");

    //     if (nextPokemonUrl != null) {
    //         console.log('Next Pokemon... ' + nextPokemonUrl);
    //         console.time("nextPage");
    //         page = await browser.newPage();
    //         await page.goto(nextPokemonUrl);
    //         console.timeEnd("nextPage");
    //     }
    // }

    browser.close();
    
    mongoose.connection.close(function(){
        console.log('MongoDB disconnected');
    });
}

main();