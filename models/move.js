const mongoose = require("mongoose");

const moveSchema = mongoose.Schema({
    // levelOrTM:      { type: String },
    // name:           { type: String, required: true },
    // type:           { type: String, required: true },
    // category:       { type: String, required: true },
    // power:          { type: String, required: true },
    // accuracy:       { type: String, required: true },
    // powerpoints:    { type: String, required: true },
    // effectPercent:  { type: String, required: true },
    // description:    { type: String, required: true },

    name:           { type: String, required: true },
    type:           { type: String, required: true },
    category:       { type: String, required: true },
    power:          { type: String, required: true },
    accuracy:       { type: String, required: true },
    powerpoints:    { type: String, required: true },
    effect:         { type: String, required: true },
    introGen:       { type: Number, required: true }
});

const Move = mongoose.model('Move', moveSchema);

module.exports = Move;