# Pokemon Scraper
Web scraper that crawls through the 8th generation Pokedex on Serebii.net using Puppeteer to build a collection of documents representing Pokemon and some basic info about each of them. They are saved to MongoDB Atlas.

## TODO:

1. Adding functionality for additional movesets requires a solution to parsing move tables that have a "form" column. Current iteration doesn't handle this case at all because the total number of TD per TR is variable based on how many variants can learn a move.

1. Idea for refactoring: scrape the Attackdex (https://www.serebii.net/attackdex-swsh/) to get a full database of all possible moves, then match them into each Pokemon's movesets by name

### StackOverflow links:
https://stackoverflow.com/questions/54150547/how-to-get-rows-from-table-with-specific-header-using-xpath
https://stackoverflow.com/questions/55485599/puppeteerjs-how-can-i-scrape-text-content-from-a-td-element-based-on-the-text
https://stackoverflow.com/questions/52919183/how-to-scrape-a-table-using-puppeteer
https://stackoverflow.com/questions/47519511/xpath-for-table-list-having-multiple-tr-and-td-find-first-element-and-click
https://stackoverflow.com/questions/12740659/downloading-images-with-node-js?answertab=modifieddesc#tab-top
https://stackoverflow.com/questions/49008008/chrome-headless-puppeteer-too-much-cpu