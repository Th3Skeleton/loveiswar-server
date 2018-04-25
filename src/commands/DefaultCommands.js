const { Command, genCommand } = require("./Commands");

/**
 * @param {String} str
 * @param {String} pad
 * @param {Number} len
 */
function padRight(str, pad, len) {
    return str + new Array(Math.max(len - str.length, 0)).fill(pad).join("");
}

/**
 * @param {CommandList} list
 */
module.exports = (list) => {
    list.register(
        genCommand({
            name: "help",
            args: "",
            desc: "display all registered commands and their relevant information",
            exec: (handle, args) => {
                const list = handle.commands.list;
                const keys = Object.keys(list).sort();
                let nameLen = 4, argsLen = 10;
                for (let name in list) {
                    nameLen = Math.max(nameLen, list[name].name.length + 1);
                    argsLen = Math.max(argsLen, list[name].args.length);
                }
                handle.logger.print(
                    padRight("NAME", " ", nameLen - 1)
                  + padRight(" ARGUMENTS", " ", argsLen)
                  + "  | DESCRIPTION");
                for (let i = 0, l = keys.length; i < l; i++)
                    handle.logger.print(
                        padRight(list[keys[i]].name + " ", " ", nameLen)
                      + padRight(list[keys[i]].args, " ", argsLen)
                      + " | "
                      + list[keys[i]].description);
            }
        }),
        genCommand({
            name: "setting",
            args: "<name> [value]",
            desc: "change/print the value of a setting",
            exec: (handle, args) => {
                if (args.length < 1) return void handle.logger.print("no setting name provided");
                if (!handle.settings.hasOwnProperty(args[0]))
                    return void handle.logger.print("no such setting");
                if (args.length >= 2) {
                    handle.settings[args[0]] = eval(args.slice(1).join(" "));
                    handle.setSettings(handle.settings);
                }
                handle.logger.print(handle.settings[args[0]]);
            }
        }),
        genCommand({
            name: "stop",
            args: "",
            desc: "close the server",
            exec: (handle, args) => {
                if (!handle.stop()) handle.logger.print("failed");
            }
        }),
        genCommand({
            name: "restart",
            args: "",
            desc: "restart the server",
            exec: (handle, args) => {
                if (!handle.stop()) return void handle.logger.print("failed");
                handle.start();
            }
        }),
        genCommand({
            name: "start",
            args: "",
            desc: "start the server",
            exec: (handle, args) => {
                if (!handle.start()) handle.logger.print("failed");
            }
        }),
        genCommand({
            name: "eval",
            args: "",
            desc: "evaluate javascript code in the context of the handle and print the output",
            exec: (handle, args) => {
                handle.logger.print(
                    (function() {
                        try { return eval(args.join(" ")); }
                        catch (e) { return !e ? e : (e.toString() || e); }
                    }).bind(handle)()
                );
            }
        }),
        genCommand({
            name: "test",
            args: "",
            desc: "test command",
            exec: (handle, args) => handle.logger.print("success successful")
        }),
        genCommand({
            name: "stats",
            args: "",
            desc: "display critical information about the server",
            exec: (handle, args) => {
                const logger = handle.logger;
                if (!handle.running)
                    logger.print("not running");
                else {
                    const memory = process.memoryUsage();
                    memory.heapUsed /= 1048576;
                    memory.heapTotal /= 1048576;
                    memory.rss /= 1048576;
                    const { heapUsed, heapTotal, rss } = memory;
                    logger.print(`average tick time: ${handle.averageTickTime.toFixed(2)} ms / ${handle.tickDelay} ms`);
                    logger.print(`${heapUsed.toFixed(1)} MiB used heap / ${heapTotal.toFixed(1)} MiB total heap / ${rss.toFixed(1)} MiB allocated`);
                    logger.print(`running for ${prettyPrintTime(Math.floor((Date.now() - handle.startTime.getTime()) / 1000))}`);
                    const connections = handle.listener.connections.length;
                    const bots = handle.listener.allPlayingRouters.length - connections;
                    logger.print(`${Object.keys(handle.players).length} players, ${connections} connections, ${bots} bots`);
                    logger.print(`${Object.keys(handle.worlds).length} worlds:`);
                    for (let id in handle.worlds) {
                        const world = handle.worlds[id];
                        logger.print(`world ${id}: ${world.cells.length} cells, (${world.playerCells.length}/${world.pelletCount}/${world.virusCount}/${world.ejectedCells.length}/${world.mothercellCount})`);
                        logger.print(`    ${world.stats.external} / ${world.stats.limit} players, ${world.stats.playing} playing, ${world.stats.spectating} spectating, ${world.stats.internal} bots`);
                    }
                }
            }
        }),
        genCommand({
            name: "pause",
            args: "",
            desc: "pause the server",
            exec: (handle, args) => {
                if (!handle.running) return void handle.logger.print("handle not started");
                if (!handle.ticker.isRunning) return void handle.logger.print("not running");
                handle.ticker.stop();
            }
        }),
        genCommand({
            name: "resume",
            args: "",
            desc: "unpause the server",
            exec: (handle, args) => {
                if (!handle.running) return void handle.logger.print("handle not started");
                if (handle.ticker.isRunning) return void handle.logger.print("already running");
                handle.ticker.start();
            }
        }),
        genCommand({
            name: "mass",
            args: "<id> <mass>",
            desc: "set cell mass to all of a player's cells",
            exec: (handle, args) => {
                if (args.length === 0) return void handle.logger.print("missing player id");
                if (args.length === 1) return void handle.logger.print("missing mass input");
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for player id");
                if (!handle.players.hasOwnProperty(id))
                    return void handle.logger.print("no player has this id");
                const mass = parseFloat(args[1]);
                if (isNaN(mass)) return void handle.logger.print("invalid number for mass input");
                const player = handle.players[id];
                if (player.state !== 0) return void handle.logger.print("player is not alive");
                const l = player.ownedCells.length;
                for (let i = 0; i < l; i++) player.ownedCells[i].mass = mass;
                handle.logger.print(`player now has ${mass * l} mass`);
            }
        }),
        genCommand({
            name: "merge",
            args: "<id>",
            desc: "instantly merge a player",
            exec: (handle, args) => {
                if (args.length === 0) return void handle.logger.print("missing player id");
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for player id");
                if (!handle.players.hasOwnProperty(id))
                    return void handle.logger.print("no player has this id");
                const player = handle.players[id];
                if (player.state !== 0) return void handle.logger.print("player is not alive");
                const l = player.ownedCells.length;
                let sqSize = 0;
                for (let i = 0; i < l; i++) sqSize += player.ownedCells[i].squareSize;
                player.ownedCells[0].squareSize = sqSize;
                player.ownedCells[0].x = player.viewArea.x;
                player.ownedCells[0].y = player.viewArea.y;
                for (let i = 1; i < l; i++) player.world.removeCell(player.ownedCells[1]);
                handle.logger.print(`merged player from ${l} cells and ${Math.round(sqSize / 100)} mass`);
            }
        }),
        genCommand({
            name: "kill",
            args: "<id>",
            desc: "instantly kill a player",
            exec: (handle, args) => {
                if (args.length === 0) return void handle.logger.print("missing player id");
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for player id");
                if (!handle.players.hasOwnProperty(id))
                    return void handle.logger.print("no player has this id");
                const player = handle.players[id];
                if (player.state !== 0) return void handle.logger.print("player is not alive");
                for (let i = 0, l = player.ownedCells.length; i < l; i++)
                    player.world.removeCell(player.ownedCells[0]);
                handle.logger.print(`killed player`);
            }
        }),
        genCommand({
            name: "pop",
            args: "<id>",
            desc: "instantly pop a player's first cell",
            exec: (handle, args) => {
                if (args.length === 0) return void handle.logger.print("missing player id");
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for player id");
                if (!handle.players.hasOwnProperty(id))
                    return void handle.logger.print("no player has this id");
                const player = handle.players[id];
                if (player.state !== 0) return void handle.logger.print("player is not alive");
                player.world.popPlayerCell(player.ownedCells[0]);
                handle.logger.print(`popped player`);
            }
        }),
        genCommand({
            name: "addminion",
            args: "<id> [count=1]",
            desc: "assign minions to a player",
            exec: (handle, args) => {
                const Connection = require("../sockets/Connection");
                const Minion = require("../bots/Minion");
                if (args.length === 0) return void handle.logger.print("missing player id");
                if (args.length === 1) args[1] = "1";
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for player id");
                if (!handle.players.hasOwnProperty(id))
                    return void handle.logger.print("no player has this id");
                const count = parseInt(args[1]);
                if (isNaN(count)) return void handle.logger.print("invalid number for count");
                const player = handle.players[id];
                if (!(player.router instanceof Connection)) return void handle.logger.print("player is a bot");
                if (player.world === null) return void handle.logger.print("player is not in a world");
                for (let i = 0; i < count; i++) new Minion(player.router);
                handle.logger.print(`added ${count} minions to player`);
            }
        }),
        genCommand({
            name: "killminion",
            args: "<id> [count=1]",
            desc: "remove assigned minions from a player",
            exec: (handle, args) => {
                const Connection = require("../sockets/Connection");
                const Minion = require("../bots/Minion");
                if (args.length === 0) return void handle.logger.print("missing player id");
                if (args.length === 1) args[1] = "1";
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for player id");
                if (!handle.players.hasOwnProperty(id))
                    return void handle.logger.print("no player has this id");
                const count = parseInt(args[1]);
                if (isNaN(count)) return void handle.logger.print("invalid number for count");
                const player = handle.players[id];
                if (!(player.router instanceof Connection)) return void handle.logger.print("player is a bot");
                if (player.world === null) return void handle.logger.print("player is not in a world");
                let realCount = 0;
                for (let i = 0; i < count && player.router.minions.length > 0; i++) {
                    player.router.minions[0].close();
                    realCount++;
                }
                handle.logger.print(`removed ${realCount} minions from player`);
            }
        }),
        genCommand({
            name: "addbot",
            args: "<world id> [count=1]",
            desc: "assign player bots to a world",
            exec: (handle, args) => {
                const PlayerBot = require("../bots/PlayerBot");
                if (args.length === 0) return void handle.logger.print("missing world id");
                if (args.length === 1) args[1] = "1";
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for world id");
                if (!handle.worlds.hasOwnProperty(id))
                    return void handle.logger.print("no world has this id");
                const count = parseInt(args[1]);
                if (isNaN(count)) return void handle.logger.print("invalid number for count");
                const world = handle.worlds[id];
                for (let i = 0; i < count; i++) new PlayerBot(world);
                handle.logger.print(`added ${count} player bots to world`);
            }
        }),
        genCommand({
            name: "killbot",
            args: "<world id> [count=1]",
            desc: "remove player bots from a world",
            exec: (handle, args) => {
                const PlayerBot = require("../bots/PlayerBot");
                if (args.length === 0) return void handle.logger.print("missing world id");
                if (args.length === 1) args[1] = "1";
                const id = parseInt(args[0]);
                if (isNaN(id)) return void handle.logger.print("invalid number for world id");
                if (!handle.worlds.hasOwnProperty(id))
                    return void handle.logger.print("no world has this id");
                const count = parseInt(args[1]);
                if (isNaN(count)) return void handle.logger.print("invalid number for count");
                const world = handle.worlds[id];
                let realCount = 0;
                for (let i = 0, l = world.players.length; i < l && realCount < count; i++) {
                    if (!(world.players[i].router instanceof PlayerBot)) continue;
                    world.players[i].router.close();
                    realCount++; i--; l--;
                }
                handle.logger.print(`removed ${realCount} player bots from world`);
            }
        })
    );
};

function prettyPrintTime(seconds) {
    seconds = ~~seconds;
    var minutes = ~~(seconds / 60);
    if (minutes < 1) return seconds + " seconds";
    var hours = ~~(minutes / 60);
    if (hours < 1) return minutes + " minutes";
    var days = ~~(hours / 24);
    if (days < 1) return hours + " hours " + minutes + " minutes";
    return days + " days " + hours + " hours";
}

const { CommandList } = require("./Commands");
const ServerHandle = require("../ServerHandle");