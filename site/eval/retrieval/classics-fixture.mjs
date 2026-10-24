// Fixed original benchmark corpus (snapshot b1c4782). Production catalogue growth must not change prior measurements.
export const BENCHMARK_CLASSICS = [
  {
    "id": "ex-opera",
    "kind": "example",
    "title": "The Opera Game",
    "white": "Paul Morphy",
    "black": "Duke Karl / Count Isouard",
    "date": "1858",
    "result": "1-0",
    "tags": [
      "open-games",
      "opening",
      "pin",
      "sacrifice",
      "king-attack",
      "back-rank",
      "mate"
    ],
    "about": "Development against an uncastled king: Morphy gives material to keep the lines open, and every piece joins in.",
    "moment": 19,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Paris\"]\n[Date \"1858\"]\n[White \"Paul Morphy\"]\n[Black \"Duke Karl / Count Isouard\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 {Pinning the knight, but Black soon has to give up the bishop pair.} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 {Development with a threat: Qxf7 mate is in the air.} Nf6 7. Qb3 {A double attack on f7 and b7.} Qe7 8. Nc3 c6 9. Bg5 {Every White piece is developed; Black's kingside pieces are still at home.} b5 10. Nxb5 {Morphy sacrifices to keep the lines open against the uncastled king.} cxb5 11. Bxb5+ Nbd7 12. O-O-O {The rook joins the attack on the pinned knight on d7.} Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ {A queen sacrifice that deflects the knight from d7.} Nxb8 17. Rd8# 1-0"
  },
  {
    "id": "ex-immortal",
    "kind": "example",
    "title": "The Immortal Game",
    "white": "Adolf Anderssen",
    "black": "Lionel Kieseritzky",
    "date": "1851",
    "result": "1-0",
    "tags": [
      "open-games",
      "opening",
      "sacrifice",
      "king-attack",
      "mate"
    ],
    "about": "Activity over material: White gives up a bishop, both rooks and the queen, and mates with the minor pieces.",
    "moment": 35,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"London\"]\n[Date \"1851\"]\n[White \"Adolf Anderssen\"]\n[Black \"Lionel Kieseritzky\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. f4 {The King's Gambit: a pawn for rapid development and the f-file.} exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 {Giving up the bishop to gain time against the black queen.} cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 {White ignores both rooks: development and the attack on the king matter more than material.} Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ {A final queen sacrifice: the knight on g8 must take and the bishop mates.} Nxf6 23. Be7# 1-0"
  },
  {
    "id": "cl-evergreen",
    "kind": "example",
    "title": "The Evergreen Game",
    "white": "Adolf Anderssen",
    "black": "Jean Dufresne",
    "date": "1852",
    "result": "1-0",
    "tags": [
      "open-games",
      "italian",
      "sacrifice",
      "king-attack",
      "discovered-attack",
      "mate"
    ],
    "about": "The Evans Gambit: lines opened in the centre, a quiet rook move that allows the queen to be taken, and a double check.",
    "moment": 37,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Berlin\"]\n[Date \"1852\"]\n[White \"Adolf Anderssen\"]\n[Black \"Jean Dufresne\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 {The Evans Gambit: a pawn for time and the centre.} Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 {A quiet move with a mating idea: Black may take the knight on f3 with check.} Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ {The queen sacrifice that clears the d-file.} Kxd7 22. Bf5+ {Double check.} Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0"
  },
  {
    "id": "cl-century",
    "kind": "example",
    "title": "The Game of the Century",
    "white": "Donald Byrne",
    "black": "Robert James Fischer",
    "date": "1956",
    "result": "0-1",
    "tags": [
      "grunfeld",
      "sacrifice",
      "discovered-attack",
      "king-attack",
      "calculation"
    ],
    "about": "A 13-year-old's queen sacrifice: Black gives the queen for a decisive lead in material and a king that cannot escape the checks.",
    "moment": 34,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"New York\"]\n[Date \"1956\"]\n[White \"Donald Byrne\"]\n[Black \"Robert James Fischer\"]\n[Result \"0-1\"]\n\n1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 {White's king is still in the centre, with the f1 bishop at home.} Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 {The famous queen sacrifice: the bishop takes on c4 with check, and a windmill of discovered checks follows.} 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1"
  },
  {
    "id": "cl-reti-tartakower",
    "kind": "example",
    "title": "Réti's queen sacrifice",
    "white": "Richard Réti",
    "black": "Savielly Tartakower",
    "date": "1910",
    "result": "1-0",
    "tags": [
      "caro-kann",
      "opening",
      "sacrifice",
      "mate"
    ],
    "about": "A miniature: Black's king stays in the centre with the queen chasing pawns, and a queen sacrifice ends in a double check and mate.",
    "moment": 17,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Vienna\"]\n[Date \"1910\"]\n[White \"Richard Réti\"]\n[Black \"Savielly Tartakower\"]\n[Result \"1-0\"]\n\n1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6 5. Qd3 e5 6. dxe5 Qa5+ 7. Bd2 Qxe5 8. O-O-O {The rook takes the d-file while Black has not castled.} Nxe4 9. Qd8+ {The queen sacrifice.} Kxd8 10. Bg5+ {Double check.} Kc7 11. Bd8# 1-0"
  },
  {
    "id": "cl-legal",
    "kind": "example",
    "title": "Légal's mate",
    "white": "Sire de Légal",
    "black": "Saint Brie",
    "date": "1750",
    "result": "1-0",
    "tags": [
      "open-games",
      "opening",
      "pin",
      "sacrifice",
      "mate"
    ],
    "about": "A pin that isn't one: the knight ignores the pin on f3, gives up the queen, and the minor pieces mate.",
    "moment": 9,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Paris\"]\n[Date \"1750\"]\n[White \"Sire de Légal\"]\n[Black \"Saint Brie\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Bc4 d6 3. Nf3 Bg4 4. Nc3 g6 5. Nxe5 {The knight leaves f3 although it seems pinned to the queen.} Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0"
  },
  {
    "id": "cl-lasker-thomas",
    "kind": "example",
    "title": "The king hunt",
    "white": "Edward Lasker",
    "black": "George Alan Thomas",
    "date": "1912",
    "result": "1-0",
    "tags": [
      "dutch",
      "sacrifice",
      "king-attack",
      "mate"
    ],
    "about": "A queen sacrifice on h7 drives the black king across the whole board to its death on g1.",
    "moment": 21,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"London\"]\n[Date \"1912\"]\n[White \"Edward Lasker\"]\n[Black \"George Alan Thomas\"]\n[Result \"1-0\"]\n\n1. d4 e6 2. Nf3 f5 3. Nc3 Nf6 4. Bg5 Be7 5. Bxf6 Bxf6 6. e4 fxe4 7. Nxe4 b6 8. Ne5 O-O 9. Bd3 Bb7 10. Qh5 Qe7 11. Qxh7+ {The queen sacrifice.} Kxh7 12. Nxf6+ Kh6 13. Neg4+ Kg5 14. h4+ Kf4 15. g3+ Kf3 16. Be2+ Kg2 17. Rh2+ Kg1 18. Kd2# 1-0"
  },
  {
    "id": "cl-rotlewi-rubinstein",
    "kind": "example",
    "title": "Rubinstein's Immortal",
    "white": "Georg Rotlewi",
    "black": "Akiba Rubinstein",
    "date": "1907",
    "result": "0-1",
    "tags": [
      "queens-gambit",
      "d-pawn",
      "sacrifice",
      "king-attack",
      "calculation"
    ],
    "about": "Bishops aimed at the king: Black gives the queen and a rook to open the long diagonals against White's castled king.",
    "moment": 44,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Lodz\"]\n[Date \"1907\"]\n[White \"Georg Rotlewi\"]\n[Black \"Akiba Rubinstein\"]\n[Result \"0-1\"]\n\n1. d4 d5 2. Nf3 e6 3. e3 c5 4. c4 Nc6 5. Nc3 Nf6 6. dxc5 Bxc5 7. a3 a6 8. b4 Bd6 9. Bb2 O-O 10. Qd2 Qe7 11. Bd3 dxc4 12. Bxc4 b5 13. Bd3 Rd8 14. Qe2 Bb7 15. O-O Ne5 16. Nxe5 Bxe5 17. f4 Bc7 18. e4 Rac8 19. e5 Bb6+ 20. Kh1 Ng4 {Both bishops aim at White's king.} 21. Be4 Qh4 22. g3 Rxc3 {The start of the combination.} 23. gxh4 Rd2 24. Qxd2 Bxe4+ 25. Qg2 Rh3 0-1"
  },
  {
    "id": "cl-steinitz-bardeleben",
    "kind": "example",
    "title": "Steinitz's rook dance",
    "white": "Wilhelm Steinitz",
    "black": "Curt von Bardeleben",
    "date": "1895",
    "result": "1-0",
    "tags": [
      "italian",
      "open-games",
      "iqp",
      "sacrifice",
      "king-attack"
    ],
    "about": "An isolated queen pawn pushed at the right moment, then a rook that checks on the seventh rank and cannot be taken.",
    "moment": 43,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Hastings\"]\n[Date \"1895\"]\n[White \"Wilhelm Steinitz\"]\n[Black \"Curt von Bardeleben\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 {White has an isolated queen pawn after the exchanges to come.} Bb4+ 7. Nc3 d5 8. exd5 Nxd5 9. O-O Be6 10. Bg5 Be7 11. Bxd5 Bxd5 12. Nxd5 Qxd5 13. Bxe7 Nxe7 14. Re1 f6 15. Qe2 Qd7 16. Rac1 c6 17. d5 {The isolated pawn advances to open lines against the uncastled king.} cxd5 18. Nd4 Kf7 19. Ne6 Rhc8 20. Qg4 g6 21. Ng5+ Ke8 22. Rxe7+ {The rook cannot be taken: every capture loses to a check.} Kf8 23. Rf7+ Kg8 24. Rg7+ Kh8 25. Rxh7+ 1-0"
  },
  {
    "id": "st-reti",
    "kind": "example",
    "title": "Réti's king march (study)",
    "white": "Richard Réti",
    "black": "study",
    "date": "1921",
    "result": "1/2-1/2",
    "tags": [
      "pawn-endgame",
      "king-activity",
      "endgame"
    ],
    "about": "A king can chase two goals at once: walking the diagonal, it supports its own pawn and catches the enemy one.",
    "moment": 1,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Kagans Neueste Schachnachrichten\"]\n[Date \"1921\"]\n[White \"Richard Réti\"]\n[Black \"study\"]\n[Result \"1/2-1/2\"]\n[SetUp \"1\"]\n[FEN \"7K/8/k1P5/7p/8/8/8/8 w - - 0 1\"]\n\n1. Kg7 {Towards the h-pawn and the c-pawn at the same time.} h4 2. Kf6 Kb6 3. Ke5 Kxc6 4. Kf4 {In the square of the pawn: a draw.} 1/2-1/2"
  },
  {
    "id": "st-saavedra",
    "kind": "example",
    "title": "The Saavedra position (study)",
    "white": "Fernando Saavedra",
    "black": "study",
    "date": "1895",
    "result": "1-0",
    "tags": [
      "promotion",
      "endgame",
      "calculation"
    ],
    "about": "Underpromotion: a queen would allow stalemate, a rook wins.",
    "moment": 11,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Glasgow Weekly Citizen\"]\n[Date \"1895\"]\n[White \"Fernando Saavedra\"]\n[Black \"study\"]\n[Result \"1-0\"]\n[SetUp \"1\"]\n[FEN \"8/8/1KP5/3r4/8/8/8/k7 w - - 0 1\"]\n\n1. c7 Rd6+ 2. Kb5 Rd5+ 3. Kb4 Rd4+ 4. Kb3 Rd3+ 5. Kc2 Rd4 {Rc4+ is ready: after c8=Q, Rc4+ Qxc4 is stalemate.} 6. c8=R {The rook avoids the stalemate and threatens Ra8 mate.} Ra4 7. Kb3 {Attacking the rook and threatening Rc1 mate.} 1-0"
  },
  {
    "id": "st-lucena",
    "kind": "example",
    "title": "The Lucena position",
    "white": "study",
    "black": "study",
    "date": "1497",
    "result": "1-0",
    "tags": [
      "rook-pawn-vs-rook",
      "rook-endgame",
      "endgame"
    ],
    "about": "Building a bridge: the rook shields the king from checks so the pawn can queen.",
    "moment": 3,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Lucena\"]\n[Date \"1497\"]\n[White \"study\"]\n[Black \"study\"]\n[Result \"1-0\"]\n[SetUp \"1\"]\n[FEN \"1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1\"]\n\n1. Rd1+ {Drive the defending king one file further away.} Ke7 2. Rd4 {The bridge: the rook will block the checks on the fourth rank.} Ra1 3. Kc7 Rc1+ 4. Kb6 Rb1+ 5. Kc6 Rc1+ 6. Kb5 Rb1+ 7. Rb4 1-0"
  },
  {
    "id": "st-philidor",
    "kind": "example",
    "title": "The Philidor position",
    "white": "study",
    "black": "study",
    "date": "1777",
    "result": "1/2-1/2",
    "tags": [
      "rook-pawn-vs-rook",
      "rook-endgame",
      "endgame"
    ],
    "about": "The defence: the rook holds the third rank until the pawn advances, then checks from behind.",
    "moment": 4,
    "provenance": {
      "version": 1,
      "origin": "builtin",
      "source": {
        "title": "Kibitz classics collection",
        "author": "Kibitz contributors",
        "url": "https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js"
      },
      "rights": {
        "score": "",
        "annotations": "GPL-3.0-or-later"
      }
    },
    "pgn": "[Event \"Philidor\"]\n[Date \"1777\"]\n[White \"study\"]\n[Black \"study\"]\n[Result \"1/2-1/2\"]\n[SetUp \"1\"]\n[FEN \"4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1\"]\n\n1... Rb6 {Keep the rook on the sixth rank: the white king can't come forward.} 2. e6 Rb1 {Now the pawn has left the king no shelter: check from behind.} 3. Kd6 Rd1+ 4. Ke5 Re1+ 1/2-1/2"
  }
];
