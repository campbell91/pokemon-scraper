const puppeteer = require('puppeteer');
const fs = require('fs');
const { default: axios } = require('axios');
const mongoose = require("mongoose");
require('dotenv').config();
const _ = require("lodash");

const Poke = require("./models/Poke");

// https://pokemondb.net/pokedex/bulbasaur