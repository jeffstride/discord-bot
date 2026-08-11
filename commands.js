const { command: helloCommand } = require('./commands/hello');
const { command: rollCommand } = require('./commands/roll');
const { command: remindCommand } = require('./commands/remind');

const ALL_COMMANDS = [helloCommand, rollCommand, remindCommand];

module.exports = { ALL_COMMANDS };
