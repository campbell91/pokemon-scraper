const mongoose = require('mongoose');

const weaknessesSchema = mongoose.Schema({
    normal:     { type: String, required: true },
    fire:       { type: String, required: true },
    water:      { type: String, required: true },
    electric:   { type: String, required: true },
    grass:      { type: String, required: true },
    ice:        { type: String, required: true },
    fighting:   { type: String, required: true },
    poision:    { type: String, required: true },
    ground:     { type: String, required: true },
    flying:     { type: String, required: true },
    psychic:    { type: String, required: true },
    bug:        { type: String, required: true },
    rock:       { type: String, required: true },
    ghost:      { type: String, required: true },
    dragon:     { type: String, required: true },
    dark:       { type: String, required: true },
    steel:      { type: String, required: true },
    fairy:      { type: String, required: true },
});

const moveSchema = mongoose.Schema({
    levelOrTM:      { type: String },
    name:           { type: String, required: true },
    type:           { type: String, required: true },
    category:       { type: String, required: true },
    power:          { type: String, required: true },
    accuracy:       { type: String, required: true },
    powerpoints:    { type: String, required: true },
    effectPercent:  { type: String, required: true },
    description:    { type: String, required: true },
});

const movesetSchema = mongoose.Schema({
    source: { type: String }, // standard level up, BDSP TM, etc.
    set:    { type: [moveSchema], required: true },
});

const pokemonSchema = mongoose.Schema({
    name:               { type: String, required: true },
    natDexNo:           { type: String, required: true },
    types:              { type: Array, required: true },
    abilities:          { type: Array, required: true },
    weaknesses:         { type: weaknessesSchema, required: true },
    classification:     { type: String, required: true },

    movesets:           { type: [movesetSchema] },
});

const Weaknesses = mongoose.model('Weaknesses', weaknessesSchema);
const Pokemon = mongoose.model('Pokemon', pokemonSchema);
const PokemonMove = mongoose.model('PokemonMove', moveSchema);
const PokemonMoveset = mongoose.model('PokemonMoveset', movesetSchema);

module.exports = {
    Weaknesses, Pokemon, PokemonMove, PokemonMoveset
}