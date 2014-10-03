(function (globals) {
    var EVENTS = {
        START_GAME: 'gameStart',
        YOUR_DATA: 'yourData',
        YOUR_TURN: 'yourTurn',
        I_TURN: 'iTurn',
        ROUND_ENDS: 'roundEnds',
        I_EXCHANGE_CARDS: 'iExchangeCards'
    };
    var CARDS = [
        '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH', 'AH',
        '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D', 'JD', 'QD', 'KD', 'AD',
        '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '10C', 'JC', 'QC', 'KC', 'AC',
        '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS', 'AS'
    ];
    var CARD_SUITS = {
        'H': 'hearts',
        'D': 'diams',
        'S': 'spades',
        'C': 'clubs'
    };
    var TURNS = {
        BET: 'bet',
        CALL: 'call',
        PASS: 'pass',
        FOLD: 'fold',
        RAISE: 'raise'
    };
    var BETS = [1, 5, 10, 50, 100, 500];
    globals.TURNS = TURNS;
    globals.BETS = BETS;
    globals.CARD_SUITS = CARD_SUITS;
    globals.CARDS = CARDS;
    globals.EVENTS = EVENTS;
})(window);