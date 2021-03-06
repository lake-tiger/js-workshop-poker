var Players = require('./players.js');
var Deck = require('./deck.js');
var User = require('./User.js');
var handChecker = require('./handChecker.js');
var _ = require('lodash');
var constants = require('../../common/constants.js');

module.exports = function() {
    var players = new Players();
    var deck;
    var bank = 0;
    var gameState = {};

    gameState.stage = constants.STAGES.FIRST_ROUND;

    var turn = 1;

    var currentPlayerIndex;
    var currentPlayer;

    var currentTurnsMap = constants.CARD_TURNS_MAP[gameState.stage];

    var turnIndex = 0;
    var replacementsCount = 0;

    var bets = [1,1,1];

    function _addPlayers(playersArr) {
        playersArr.forEach(function(player) {
            players.add(player);
        });
    }

    function _start() {
        deck = new Deck();
        deck.shuffle();

        _ante();

        players.forEach(function(player) {
            player.hand = deck.give(5);
            //console.log(handChecker.findCombination(player.hand));
        });

        currentPlayerIndex = _.random(players.length-1);
        currentPlayer = players.getPlayers()[currentPlayerIndex];

        _.extend(gameState, {
            players: getSerialazablePlayers(players),
            bank: bank,
            turn: turn,
            currentPlayerId: currentPlayer.id,
            bets: bets
        });

        players.forEach(function(player) {
            player.socket.emit(
                constants.EVENTS.SERVER.START_GAME,
                _.extend({}, gameState, {
                    players: cutGameStateForPlayer(_.cloneDeep(gameState), player.id)
                })
            );

            player.socket.on(
                constants.EVENTS.CLIENT.I_TURN,
                _processTurn
            );

            player.socket.on(
                constants.EVENTS.CLIENT.I_EXCHANGE_CARDS,
                _processReplacements
            );

        });

        gameState.stage = constants.STAGES.FIRST_ROUND;

        currentPlayer.socket.emit(constants.EVENTS.SERVER.YOUR_TURN, {
            turnOptions: constants.CARD_TURNS_MAP[gameState.stage]
        });

    }

    function _processTurn(playerTurnData) {

        if (_.contains(constants.TURNS, playerTurnData.turn)) {

            var turnOptions;
            var bet;

            //TODO: Process turn itself here

            players.currentTurn(currentPlayerIndex, playerTurnData.turn);
            if ( (gameState.stage === constants.STAGES.FIRST_ROUND) || (gameState.stage === constants.STAGES.SECOND_ROUND) ) {
                switch ( playerTurnData.turn ) {
                    case constants.TURNS.BET:
                        bet = playerTurnData.bet;
                        bets[currentPlayerIndex] += bet;
                        players.bet(currentPlayerIndex, bet);

                        currentTurnsMap = constants.CARD_TURNS_MAP[playerTurnData.turn];

                        break;
                    case constants.TURNS.PASS:
                        bet = 0;
                        break;
                    case constants.TURNS.FOLD:
                        //Bet of fold player is 0
                        bet = 0;
                        bets[currentPlayerIndex] = 0;
                        break;
                    case constants.TURNS.RAISE:

                        bet = bets[_prevPlayer(currentPlayerIndex)] - bets[currentPlayerIndex] + playerTurnData.bet;
                        bets[currentPlayerIndex] += bet;

                        players.bet(currentPlayerIndex, bet);

                        currentTurnsMap = constants.CARD_TURNS_MAP[playerTurnData.turn];
                        break;
                    case constants.TURNS.CALL:
                        bet = 0;
                        if (bets[currentPlayerIndex] < bets[_prevPlayer(currentPlayerIndex)]) {
                            bet = bets[_prevPlayer(currentPlayerIndex)] - bets[currentPlayerIndex];
                            bets[currentPlayerIndex] += bet;
                            players.bet(currentPlayerIndex, bet);

                            currentTurnsMap = constants.CARD_TURNS_MAP[playerTurnData.turn];
                        }
                        break;
                    default:
                }

                bank += bet;

            }

            _saveLastBetState(playerTurnData);

            if (turnIndex >= players.count() - 1) {
                currentTurnsMap = constants.CARD_TURNS_MAP[constants.STAGES.SUBSTAGE_AFTER_DEALER];
            }
            turnIndex++;

            if (turnIndex >= players.count()*2 - 1) {
                turnIndex = 0;
                currentPlayerIndex = _nextPlayer(currentPlayerIndex); //Skip dealer before next stage

                gameState.stage = constants.STAGES_ORDER[constants.STAGES_ORDER.indexOf(gameState.stage) + 1];
            }

            turnOptions = currentTurnsMap;

            _.extend(gameState, {
                players: getSerialazablePlayers(players),
                bank: bank
            });

            currentPlayerIndex = _nextPlayer(currentPlayerIndex);

            //We need to skip fold players.
            if (bets[currentPlayerIndex] === 0) {
                currentPlayerIndex = _nextPlayer(currentPlayerIndex);
                if(bets[currentPlayerIndex] === 0) {
                    gameState.stage = constants.STAGES.SHOWDOWN;
                }
            }

            currentPlayer = players.getPlayers()[currentPlayerIndex];

            if ( (gameState.stage === constants.STAGES.FIRST_ROUND) || (gameState.stage === constants.STAGES.SECOND_ROUND) ) {
                currentPlayer.socket.emit(constants.EVENTS.SERVER.YOUR_TURN, {
                    turnOptions: turnOptions,
                    lastTurn: gameState.lastTurn,
                    lastBet: gameState.lastBet
                });
            } else if (gameState.stage === constants.STAGES.REPLACEMENT) {
                players.forEach(function(player) {
                    player.socket.emit(constants.EVENTS.SERVER.REPLACEMENT_TURN, {});
                });
            } else if (gameState.stage === constants.STAGES.SHOWDOWN) {

                _.extend(gameState, {
                    players: getSerialazablePlayers(players)
                });

                gameState.players = gameState.players.map(function(player) {
                    var playerWithCombination = _.extend({}, player, {combination: handChecker.findCombination(player.hand)});
                    return playerWithCombination;
                });

                var combinations = gameState.players.map(function(player) {
                    return player.combination
                });

                var winning = handChecker.findWinner( combinations );

                players.forEach(function(player) {
                    player.socket.emit(constants.EVENTS.SERVER.SHOWDOWN, {
                        winner: player.combination == winning,
                        gameState: gameState
                    });

                    User.findOneAndUpdate({_id: player.socket.request.user.id}, { coins: player.coins }, false, function() {
                        console.log('saved');
                    })

                });
            }

            players.forEach(function(player) {
                player.socket.emit(
                    constants.EVENTS.SERVER.GAME_INFO,
                    _.extend({}, gameState, {
                        players: cutGameStateForPlayer(_.cloneDeep(gameState), player.id)
                    })
                );
            });

        }

    }

    function _processReplacements( replacementData ) {

        if (replacementData.replaceCards.length) {
            var replacement = deck.give(replacementData.replaceCards.length);
            players.replaceCards(this.id, replacementData.replaceCards, replacement);
        }

        if(++replacementsCount === 3) {
            gameState.stage = constants.STAGES_ORDER[constants.STAGES_ORDER.indexOf(gameState.stage) + 1];

            _.extend(gameState, {
                players: getSerialazablePlayers(players)
            });

            players.forEach(function(player) {
                player.socket.emit(
                    constants.EVENTS.SERVER.START_GAME,
                    _.extend({}, gameState, {
                        players: cutGameStateForPlayer(_.cloneDeep(gameState), player.id)
                    })
                );
            });

            currentPlayer.socket.emit(constants.EVENTS.SERVER.YOUR_TURN, {
                turnOptions: constants.CARD_TURNS_MAP[constants.STAGES.SECOND_ROUND]
            });

            //User.findOneAndUpdate({}, { name: 'jason borne' }, options, callback)

        }

    }

    function _ante() {
        bank = players.ante(1);
    }

    function _getBank() {
        return bank;
    }

    function _getCurrentStage() {
        return gameState.stage;
    }

    function _nextPlayer(currentPlayerIndex) {
        currentPlayerIndex++;
        if (currentPlayerIndex == players.getPlayers().length) {
            currentPlayerIndex = 0;
        }

        return currentPlayerIndex;
    }

    function _prevPlayer(currentPlayerIndex) {
        currentPlayerIndex--;
        if (currentPlayerIndex == -1) {
            currentPlayerIndex = players.getPlayers().length - 1;
        }

        return currentPlayerIndex;
    }

    function _saveLastBetState(playerTurnData) {
        if ((playerTurnData.turn === constants.TURNS.BET) || (playerTurnData === constants.TURNS.RAISE)) {
            _.extend(gameState, {
                lastTurn: playerTurnData.turn,
                lastBet: playerTurnData.bet
            });
        }
    }

    return {
        addPlayers: _addPlayers,
        players: players,
        start: _start,
        getBank: _getBank,
        getCurrentStage: _getCurrentStage,
        processTurn: _processTurn,
        currentPlayerIndex: currentPlayerIndex
    }

};

function getSerialazablePlayers(players) {
    return (players
        .getPlayers()
        .map(function(item){
            return {
                name: item.name,
                id: item.id,
                coins: item.coins,
                hand: item.hand,
                currentTurn: item.currentTurn
            }
        }))
}

function cutGameStateForPlayer(gameState, playerId) {
    return gameState.players.map(function(player) {
        if (player.id !== playerId) {
            player.hand = [];
        }
        return player;
    });
}