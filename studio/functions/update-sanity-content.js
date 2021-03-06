const sanityClient = require('@sanity/client');

exports.handler = (event) => {
  const mergeArrays = (arr1, arr2) => {
    const mergedArr = [];

    arr1.map((item) => {
      const foundItem = arr2.filter((player) => player._key === item._key);

      if (foundItem.length > 0) {
        mergedArr.push(foundItem[0]);
      } else {
        mergedArr.push(item);
      }
    });

    return mergedArr;
  };

  const getExpected = (a, b) => 1 / (1 + (10 ** ((b - a) / 400)));

  const findIndex = (find, array) => {
    let index = null;

    array.map((item, i) => {
      if (item._key === find) {
        index = i;
      }
    });

    return index;
  };

  const onevone = (players) => {
    const player1 = players[0];
    const player2 = players[1];
    const matchData = [
      {
        rank: player1.rank,
        difference: 0,
        name: player1.name,
        ref: player1.ref,
        score: player1.score,
        civilization: player1.civilization,
      },
      {
        rank: player2.rank,
        difference: 0,
        name: player2.name,
        ref: player2.ref,
        score: player2.score,
        civilization: player2.civilization,
      },
    ];

    const updateRating = (expected, actual, current) => {
      const newRating = Math.round(current + 32 * (actual - expected));
      return newRating;
    };

    const player1Expected = getExpected(player1.rank, player2.rank);
    const player2Expected = getExpected(player2.rank, player1.rank);

    let player1NewRank;
    let player2NewRank;

    if (player1.score < player2.score) {
      player1NewRank = updateRating(player1Expected, 1, player1.rank);
      player2NewRank = updateRating(player2Expected, 0, player2.rank);
    } else {
      player1NewRank = updateRating(player1Expected, 0, player1.rank);
      player2NewRank = updateRating(player2Expected, 1, player2.rank);
    }

    matchData[0].newRank = player1NewRank;
    matchData[1].newRank = player2NewRank;

    matchData[0].difference = player1NewRank - player1.rank;
    matchData[1].difference = player2NewRank - player2.rank;

    const seasonUpdate = [
      {
        _key: player1._key,
        rank: player1NewRank,
        _type: 'player',
        name: player1.name,
        ref: player1.ref,
        losses: player1.score > player2.score ? (player1.losses += 1) : player1.losses,
        wins: player1.score < player2.score ? (player1.wins += 1) : player1.wins,
      },
      {
        _key: player2._key,
        rank: player2NewRank,
        _type: 'player',
        name: player2.name,
        ref: player2.ref,
        losses: player1.score < player2.score ? (player2.losses += 1) : player2.losses,
        wins: player1.score > player2.score ? (player2.wins += 1) : player2.wins,
      },
    ];

    return [matchData, seasonUpdate];
  };

  const freeForAll = (players) => {
    const { length } = players;
    const gamesPlayed = length - 1;
    const matchData = [];
    const seasonUpdate = [];
    let kFactorAdjuster = (1 - gamesPlayed / 10) / 2;

    if (kFactorAdjuster < 0.4) {
      kFactorAdjuster = 0.4;
    }

    const kFactor = 32 * kFactorAdjuster;

    const updateRating = (expected, actual, current) => {
      const newRating = Math.round(current + kFactor * (actual - expected));
      return newRating;
    };

    for (let i = 0; length > i; i += 1) {
      let playerWins = players[i].wins;
      let playerLosses = players[i].wins;

      matchData.push({
        rank: players[i].rank,
        difference: 0,
        name: players[i].name,
        _key: players[i]._key,
        wins: players[i].score === 1 ? playerWins += 1 : playerWins,
        losses: players[i].score > 1 ? playerLosses += 1 : playerLosses,
        ref: players[i].ref,
        civilization: players[i].civilization,
      });
    }

    for (let i = 0; length > i; i += 1) {
      const player1 = players[i];
      const player1Index = findIndex(player1._key, matchData);

      for (let j = 0; length > j; j += 1) {
        if (j > i) {
          const player2 = players[j];
          const player2Index = findIndex(player2._key, matchData);
          const player1Expected = getExpected(player1.rank, player2.rank);
          const player2Expected = getExpected(player2.rank, player1.rank);
          let player1newRating;
          let player2newRating;

          if (player1.score < player2.score) {
            player1newRating = updateRating(player1Expected, 1, player1.rank)
              - matchData[player1Index].rank;
            player2newRating = updateRating(player2Expected, 0, player2.rank)
              - matchData[player2Index].rank;
          } else {
            player1newRating = updateRating(player1Expected, 0, player1.rank)
              - matchData[player1Index].rank;
            player2newRating = updateRating(player2Expected, 1, player2.rank)
              - matchData[player2Index].rank;
          }

          matchData[player1Index].difference += player1newRating;
          matchData[player2Index].difference += player2newRating;
        }

        if (j === gamesPlayed) {
          if (matchData[player1Index].difference > 40) {
            matchData[player1Index].difference = 40;
          }

          matchData[player1Index].newRank = matchData[player1Index].rank
            + matchData[player1Index].difference;

          seasonUpdate.push({
            _key: matchData[player1Index]._key,
            _type: 'player',
            name: matchData[player1Index].name,
            rank: matchData[player1Index].newRank,
            ref: matchData[player1Index].ref,
            losses: matchData[player1Index].losses,
            wins: matchData[player1Index].wins,
          });
        }
      }
    }

    return [matchData, seasonUpdate];
  };

  const teamGame = (teams) => {
    const { length } = teams;
    const matchData = [...teams];
    const seasonUpdate = [];
    let gamesPlayed = 0;

    for (let i = 0; length > i; i += 1) {
      const currTeam = teams[i];

      for (let j = 0; j < currTeam.length; j += 1) {
        if (i >= 1) {
          gamesPlayed += 1;
        }
      }
    }

    let kFactorAdjuster = 1 - gamesPlayed / 10;
    if (kFactorAdjuster < 0.4) {
      kFactorAdjuster = 0.4;
    }

    const kFactor = 32 * kFactorAdjuster;

    const updateRating = (expected, actual, current) => {
      const newRating = Math.round(current + kFactor * (actual - expected));
      return newRating;
    };

    for (let i = 0; length > i; i += 1) {
      const team1Score = matchData[i].score;
      const team1 = matchData[i].players;

      for (let j = 0; team1.length > j; j += 1) {
        const player1 = team1[j];
        const player1Index = findIndex(player1._key, team1);

        for (let k = i + 1; length > k; k += 1) {
          const team2Score = matchData[k].score;
          const team2 = matchData[k].players;

          for (let l = 0; team2.length > l; l += 1) {
            const player2 = team2[l];
            const player2Index = findIndex(player2._key, team2);

            const player1Expected = getExpected(player1.rank, player2.rank);
            const player2Expected = getExpected(player2.rank, player1.rank);

            let player1newRating;
            let player2newRating;

            if (team1Score < team2Score) {
              player1newRating = updateRating(
                player1Expected,
                1,
                player1.rank,
              ) - team1[player1Index].rank;
              player2newRating = updateRating(
                player2Expected,
                0,
                player2.rank,
              ) - team2[player2Index].rank;
            } else {
              player1newRating = updateRating(
                player1Expected,
                0,
                player1.rank,
              ) - team1[player1Index].rank;
              player2newRating = updateRating(
                player2Expected,
                1,
                player2.rank,
              ) - team2[player2Index].rank;
            }

            if (!team1[player1Index].difference) {
              team1[player1Index].difference = 0;
            }

            if (!team2[player2Index].difference) {
              team2[player2Index].difference = 0;
            }

            team1[player1Index].difference += player1newRating;
            team2[player2Index].difference += player2newRating;

            team1[player1Index].newRank = team1[player1Index].rank + team1[player1Index].difference;
            team2[player2Index].newRank = team2[player2Index].rank + team2[player2Index].difference;
          }
        }

        seasonUpdate.push({
          _key: team1[player1Index]._key,
          _type: 'player',
          losses: team1Score > 1 ? (team1[player1Index].losses += 1) : team1[player1Index].losses,
          name: team1[player1Index].name,
          rank: team1[player1Index].newRank,
          ref: team1[player1Index].ref,
          wins: team1Score === 1 ? (team1[player1Index].wins += 1) : team1[player1Index].wins,
        });
      }
    }

    return [matchData, seasonUpdate];
  };

  const { body } = event;

  if (body) {
    const bodyParsed = JSON.parse(body);

    if (!bodyParsed.ids || bodyParsed.ids.created.length === 0) {
      return { statusCode: 200 };
    }

    const client = sanityClient({
      projectId: 'v7sgze3m',
      dataset: 'production',
      token: process.env.SANITY_TOKEN,
      useCdn: false,
    });

    try {
      const docID = bodyParsed.ids.created.map((_id) => _id);
      const matchFetch = client.getDocument(`${docID}`);

      matchFetch.then((fetched) => {
        const { match, season } = fetched;

        if (match.twoPlayer && !match.twoPlayer.matchData) {
          const matchID = docID;
          const playerRefs = match.twoPlayer.players;
          const seasonRef = `${season._ref}`;
          const seasonInfo = client.getDocument(seasonRef);

          seasonInfo.then((fetchedSeason) => {
            const playerData = [];

            /* eslint-disable */
            playerRefs.map((item) => {
              playerData.push({
                score: item.score,
                civilization: item.civilization,
                ...fetchedSeason.players.find(
                  (itemInner) => itemInner.ref._ref === item.player._ref,
                ),
              });
            });
            /* eslint-enable */

            const matchDataObj = onevone(playerData);

            matchID
              .reduce(
                (trx, id) => trx.patch(id, (patch) => patch.setIfMissing({
                  matchData: matchDataObj[0],
                })),
                client.transaction(),
              )
              .commit()
              .catch(console.error);

            const mergedSeasonData = mergeArrays(fetchedSeason.players, matchDataObj[1]);

            client
              .patch(seasonRef)
              .set({ players: mergedSeasonData })
              .commit()
              .catch(console.error);
          });
        } else if (match.freeForAll && !match.freeForAll.matchData) {
          const matchID = docID;
          const playerRefs = match.freeForAll.players;
          const seasonRef = `${season._ref}`;
          const seasonInfo = client.getDocument(seasonRef);

          seasonInfo.then((fetchedSeason) => {
            const playerData = [];

            /* eslint-disable */
            playerRefs.map((item) => {
              playerData.push({
                score: item.score,
                ...fetchedSeason.players.find(
                  (itemInner) => itemInner.ref._ref === item.player._ref,
                ),
              });
            });
            /* eslint-enable */

            const matchDataObj = freeForAll(playerData);

            matchID
              .reduce(
                (trx, id) => trx.patch(id, (patch) => patch.setIfMissing({
                  matchData: matchDataObj[0],
                })),
                client.transaction(),
              )
              .commit()
              .catch(console.error);

            const mergedSeasonData = mergeArrays(fetchedSeason.players, matchDataObj[1]);

            client
              .patch(seasonRef)
              .set({ players: mergedSeasonData })
              .commit()
              .catch(console.error);
          });
        } else if (match.teamGame && !match.teamGame.matchData) {
          const matchID = docID;
          const playerTeams = [...match.teamGame.teams];
          const seasonRef = `${season._ref}`;
          const seasonInfo = client.getDocument(seasonRef);


          seasonInfo.then((fetchedSeason) => {
            /* eslint-disable */
            playerTeams.map((item) => {
              item.players.map((playerObj, index) => {
                item.players[index] = {
                  ...fetchedSeason.players.find(
                    (itemInner) => itemInner.ref._ref === playerObj.player._ref,
                  ),
                };
              });
            });
            /* eslint-enable */

            const matchDataObj = teamGame(playerTeams);

            matchID
              .reduce(
                (trx, id) => trx.patch(id, (patch) => patch.set({
                  matchData: matchDataObj[0],
                })),
                client.transaction(),
              )
              .commit()
              .catch(console.error);

            const mergedSeasonData = mergeArrays(fetchedSeason.players, matchDataObj[1]);

            client
              .patch(seasonRef)
              .set({ players: mergedSeasonData })
              .commit()
              .catch(console.error);
          });
        }
      });

      return {
        statusCode: 200,
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: err.toString(),
      };
    }
  }
};
