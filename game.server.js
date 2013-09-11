/*  Copyright (c) 2013 TruongNGUYEN
    Server for projectX
    BH Licensed.
*/

  var TYPE_INVITE = "invite";
  var TYPE_FOUND_PLAYER = "foundPlayer";
  var TYPE_PLAYER_NOT_AVAILABLE = "playerNotAvailable";
  var TYPE_WELLCOME = "wellcome";
  var TYPE_RECEIVE_CONFIRM = "receiveConfirm";
  var TYPE_START_GAME = "startGame";
  var TYPE_NEXT_ROUND = "nextRound";
  var TYPE_PLAYER_ANSWER = "playerAnswer";
  var TYPE_END_GAME = "endGame";
  var TYPE_PLAYER_DISCONNECT = "playerDisconnect";
  var TYPE_PLAYER_RECONNECTED = "playerReconnect";
  var TYPE_ONLINE_PLAYERS = "onlinePlayers";
  var TYPE_CONNECTED = "userJoined";
  var TYPE_CREATE_GAME_SUCCESS = "createGameSuccess";
  var TYPE_JOIN_GAME_SUCCESS = "joinGameSuccess";
  var TYPE_JOIN_GAME_NOT_SUCCESS = "joinGameNotSuccess";
  var TYPE_PLAYER_JOIN_GAME = "playerJoinGame";
  var TYPE_PLAYER_EXIT_GAME = "playerExitGame";
  var TYPE_PALYER_READY_GAME = "readyForGame";
  var TYPE_CHECK_START_GAME = "checkStartGame";
  var TYPE_HOST_EXIT_GAME = "hostExitGame";
  var TYPE_AVAILABLE_PLAYERS = "availablePlayers";
  var TYPE_AVAILABLE_GAMES = "availableGames";
  var intervalTime = 15;
  var maxPlayerInGame = 2;
  var hasOwnProperty = Object.prototype.hasOwnProperty;

    var recordIntervals = {};
    var gameTimers = {};
    var numberOfPlayerAnswer = {};
    var clients = {}; 
    var socketsOfClients = {};
    var games = {};
    var players = {};
    var currentGameOfPlayer = {};

    var
        game_server = module.exports,
        app_server = require('./app.js'),
        verbose     = true;

    game_server.users = function(req, res) {
      var str = "";
      var i=0;
      Object.keys(players).forEach(function(userName){
          str += (i++) +" .Player: " + userName + "   .Channel: " + players[userName].appName +".           \n";
      });
      res.send(str);
    };

    game_server.sendMsgToOtherClient = function(obj) {
      var fromClient = obj.fromClient;
      var toClients = obj.toClients;
      var data = obj.msg;
      var dataToSend = {};
      dataToSend.notice = "receiveMsgFromOtherClient";
      dataToSend.fromClient = fromClient;
      dataToSend.msg = data;
      if(data.hasOwnProperty("gameId")){
        var gameId = data.gameId;
        if(games.hasOwnProperty(gameId)) {
          toClients.forEach(function(toClient){
            sendMessageToAPlayer(toClient, dataToSend);
          });
        }
      }
      else {
        toClients.forEach(function(toClient){
          sendMessageToAPlayer(toClient, dataToSend);
        });
      }
    };

    game_server.setPlayer = function(sId, data) {
      onUserConnect(sId, data);
	 	  app_server.sendToClient(sId, TYPE_CONNECTED, {"clientId" : sId});
    };

    function onUserConnect(sId, playerData) {
      var email = playerData.email;
      var i =0;
      // Does not exist ... so, proceed
      clients[email] = sId;
      if(players.hasOwnProperty(email)) {
		  try{
		  	if(currentGameOfPlayer.hasOwnProperty(email)) {
				  var gameId = currentGameOfPlayer[email];
				  var data = {};
				  data.player = playerName;
				  endWhenPlayerQuitGame( gameId, "playerQuitGame", data)
			  }
		  }
	   	catch (err) {
	   	}
        delete players[email];
      }
      console.log(JSON.stringify(playerData));
      players[email] = {"name": playerData.name, "status": playerData.status, "socketId" : sId, "channel" : playerData.channel, "email" : email};
      Object.keys(socketsOfClients).forEach(function(oldSocketId){
        if (socketsOfClients[oldSocketId] == email){
          delete socketsOfClients[oldSocketId];
        }
      });
      socketsOfClients[sId] = email;
    }

    game_server.onUserDisconnect = function(sId) {
      try{
        if(socketsOfClients.hasOwnProperty(sId)) {
          var player = socketsOfClients[sId];
    			if(currentGameOfPlayer.hasOwnProperty(player)) {
    				var gameId = currentGameOfPlayer[player];
    				if(games.hasOwnProperty(gameId)) {
              console.log("games[gameId].playing: " + games[gameId].playing  + " -- " + typeof games[gameId].playing);
              if(games[gameId].playing == false || games[gameId].playing == "false"){
                var obj = {"gameId" : gameId, 
                           "isHostPlayer":games[gameId].clientPlayers[player].isHost,
                           "player":player };
                exitWaitingGame(obj);
              }
              else {
                console.log("User disconnect when playing game");
                var data = {"player":player};
                endWhenPlayerQuitGame( gameId, "playerQuitGame", data)
              }
            }
    			}
    			delete players[socketsOfClients[sId]];
    			delete clients[socketsOfClients[sId]];
    			delete socketsOfClients[sId];
          }
        }
      catch (err) {
        console.log("ERORR onUserDisconnect: " + JSON.stringify(err));
      }
    };

    game_server.onUserQuitGame = function(sId) {
      try{
        if(socketsOfClients.hasOwnProperty(sId)) {
          if(currentGameOfPlayer.hasOwnProperty(socketsOfClients[sId])) {
            var gameId = currentGameOfPlayer[socketsOfClients[sId]];
            var data = {};
		      	data.player = socketsOfClients[sId];
            endWhenPlayerQuitGame( gameId, "playerQuitGame", data)
          }
        }
      }
      catch (err) {
        console.log("ERORR onUserQuitGame: " + JSON.stringify(err));
      }
    };


    game_server.getAvailablePlayers = function(sId, obj) {
       try{
          var availableUsers = new Array();
          var i = 0;
          Object.keys(players).forEach(function(email){
            console.log("Player: " + JSON.stringify(players[email]));
          if (players[email].appName == obj.appName && players[email].status == 1)
            if(i<=20){
               availableUsers.push(players[email]);
            }
            i++;
          });

          var dataToSend  = {"notice": TYPE_ONLINE_PLAYERS, "data":{"availablePlayers":availableUsers}};
          app_server.sendMsgToClient(sId, dataToSend);
           
        }
         catch(err) {
             console.log("Error when get getAvailablePlayers: " + JSON.stringify(err));
        }
    }; //game_server.getAvailablePlayers

    game_server.getWaitingGames = function(sId, obj) {
       try{
          var waitingGames = new Array();
          var i = 0;
          Object.keys(games).forEach(function(gameId){
            if (games[gameId].channel == obj.channel && games[gameId].playing == "false"){
              waitingGames.push(games[gameId]);
              i++;
            }
          });
          var dataToSend  = {"notice": "waitingGames", "data":{"games":waitingGames}};
          app_server.sendMsgToClient(sId, dataToSend);
           
        }
         catch(err) {
             console.log("Error when get getWaittingGames: " + JSON.stringify(err));
        }
    }; //game_server.getWaittingGames

    game_server.getPlayingGames = function(sId, obj) {
       try{
          var playingGames = new Array();
          var i = 0;
          Object.keys(games).forEach(function(gameId){
            if (games[gameId].channel == obj.channel && games[gameId].playing == "true"){
              playingGames.push(games[gameId]);
              i++;
            }
          });
          var dataToSend  = {"notice": "playingGames", "data":{"games":playingGames}};
          app_server.sendMsgToClient(sId, dataToSend);
           
        }
         catch(err) {
             console.log("Error when get getPlayingGames: " + JSON.stringify(err));
        }
    }; //game_server.getPlayingGames

    game_server.findPlayer = function(obj) {
        var dataToSend = {};
        dataToSend.notice = TYPE_FOUND_PLAYER;
        var playerName = obj.player;
        if (players.hasOwnProperty(playerName)) {
          if(playerName != obj.sender && players[playerName].status == 1) {
            dataToSend.data = {"player":playerName, "available" : true};
          }
          else {
            dataToSend.data = {"player":playerName, "available" : false};
          }  
        }
        else {
          dataToSend.data = {"player":playerName, "available" : false};
        }
        app_server.sendMsgToClient(clients[obj.sender], dataToSend);
    }; //game_server.findPlayer

    game_server.findGame = function(obj) {
        var dataToSend = {};
        for(var playerName in players) {
           if (players.hasOwnProperty(playerName)) {
             if(playerName != obj.sender && players[playerName].status ==1) {
                dataToSend.notice = TYPE_INVITE;
                dataToSend.data = obj;
                console.log('found user: ' + JSON.stringify(playerName));
                app_server.sendMsgToClient(clients[playerName], dataToSend);
                break;
             }
           }
        }
    }; //game_server.findGame

    game_server.createGame = function(obj) {
      var game = obj.game;
      var gameId = game.id;
      games[gameId] = game;
      var dataToSend = {"notice" : TYPE_CREATE_GAME_SUCCESS};
      for(var key in games[gameId].clientPlayers){
        currentGameOfPlayer[key] = gameId;
        players[key].status = 2;
        app_server.sendMsgToClient(clients[key], dataToSend);
      }

    }; //game_server.createGame

    game_server.updateGame = function(obj) {
      var newGame = obj.game;
      var gameId = newGame.id;
      delete games[gameId];
      games[gameId] = newGame;
      for(var key in games[gameId].clientPlayers) {
        if(games[gameId].clientPlayers[key].isHost == "false")
          games[gameId].clientPlayers[key].status = false;  
      }
      var dataToSend = {"notice" : "updateGame"};
      dataToSend.data = obj;
      for(var key in games[gameId].clientPlayers){
        app_server.sendMsgToClient(clients[key], dataToSend);
      }
    }; //game_server.updateGame

    game_server.joinGame = function(obj) {
      
      var gameId = obj.gameId;
      var playerJoin = obj.player;
      if(games.hasOwnProperty(gameId) && lengthOfObj(games[gameId].clientPlayers) < games[gameId].playerNumber){
        games[gameId].clientPlayers[obj.playerEmail] = playerJoin;
        var dataToSend = {"notice" : TYPE_PLAYER_JOIN_GAME};
        dataToSend.data = {};
        dataToSend.data.game = games[gameId];
        for(var key in games[gameId].clientPlayers){
          currentGameOfPlayer[key] = gameId;
          players[key].status = 2;
          app_server.sendMsgToClient(clients[key], dataToSend);
        }
      }
      else {
         console.log("games notHasOwnProperty(gameId)");
         var dataToSend = {"notice" : TYPE_JOIN_GAME_NOT_SUCCESS};
         app_server.sendMsgToClient(clients[obj.playerEmail], dataToSend);
      }
    }; //game_server.joinGame

    game_server.exitWaitingGame = function(obj) {
      exitWaitingGame(obj);
    }; //game_server.exitWaitingGame

    function exitWaitingGame(obj) {
      var gameId = obj.gameId;
      var playerExit = obj.player;
      var isHost = (obj.isHostPlayer == "true");
      if(games.hasOwnProperty(gameId)) {
        if(!isHost) {
          var dataToSend = {"notice" : TYPE_PLAYER_EXIT_GAME};
          dataToSend.data = {"player" :  games[gameId].clientPlayers[playerExit], "playerEmail" : playerExit};
          app_server.sendMsgToClient(gameId, dataToSend);
          delete games[gameId].clientPlayers[playerExit];
          delete currentGameOfPlayer[playerExit];
          players[playerExit].status = 1;
        }
        else {
          var dataToSend = {"notice" : TYPE_HOST_EXIT_GAME};
          dataToSend.data = {"player" :  games[gameId].clientPlayers[playerExit]};
          for(var email in games[gameId].clientPlayers) {
            try{
              players[email].status = 1;
              delete currentGameOfPlayer[email];
              if(email != playerExit)
                app_server.sendMsgToClient(clients[email], dataToSend);
            }
            catch(err) {
              console.log("Error: " + JSON.stringify(err));
            }
          }
          delete games[gameId];
        }

      }
      else {
         console.log("games notHasOwnProperty(gameId)");
      }
    }

    game_server.readyForGame = function(obj) {  
      var gameId = obj.gameId;
      var playerEmail = obj.player;
      var ready = (obj.ready == "true");
      if(games.hasOwnProperty(gameId)) {
        games[gameId].clientPlayers[playerEmail].status = ready;  
        var dataToSend = {"notice" : TYPE_PALYER_READY_GAME};
        dataToSend.data = obj;
        for(var email in games[gameId].clientPlayers) {
            if(email != playerEmail)
              app_server.sendMsgToClient(clients[email], dataToSend);
        }
      }
      else {
         console.log("games notHasOwnProperty(gameId)");
      }
    }; //game_server.exitWaitingGame

    game_server.checkStartGame = function(obj) {  
      var gameId = obj.gameId;
      var player = obj.player;
      games[gameId].clientPlayers[player].status = true;
      if(games.hasOwnProperty(gameId)) {
        var ready = true;
        if(lengthOfObj(games[gameId].clientPlayers) < games[gameId].playerNumber){
          ready = false;
        }
        else
        for(var playerEmail in games[gameId].clientPlayers){
          var status = games[gameId].clientPlayers[playerEmail].status;
          if(status == false || status == "false"){
            ready = false;
            break;
          }
        }
        var dataToSend = {"notice" : TYPE_CHECK_START_GAME};
        dataToSend.data = {"ready" : ready};
        app_server.sendMsgToClient(clients[player], dataToSend);
      }
      else {
         console.log("games notHasOwnProperty(gameId)");
      }
    }; //game_server.exitWaitingGame

    game_server.inviteToGame = function(sId, obj) {
      var dataToSend = {};
      var playerEmail = obj.player;
      var gameId = obj.gameId;
      if(players[playerEmail].status == 1 && games.hasOwnProperty(gameId)) {
         dataToSend.notice = TYPE_INVITE;
         dataToSend.data = obj;
         dataToSend.data.game = games[gameId];
         app_server.sendMsgToClient(clients[playerEmail], dataToSend);
      }
      else {
        dataToSend.notice = TYPE_PLAYER_NOT_AVAILABLE;
        dataToSend.data = {"player" : playerEmail};
        app_server.sendMsgToClient(sId, dataToSend);
      }
       
    }; //game_server.inviteToGame

    game_server.confirmJoinGame = function(obj) {
        var dataToSend = {};
        dataToSend.notice = "receiveConfirm"
        dataToSend.data = obj;
        app_server.sendMsgToClient(clients[obj.sender], dataToSend);
    }; //game_server.confirmJoinGame

    game_server.startGame = function(obj) {
      var gameId = obj.gameId;
  		var dataToSend = {};
      var prepareTime = obj.prepareTime;
  		dataToSend.notice = "startGame";
  		dataToSend.data = obj;
      if(games.hasOwnProperty(gameId)) {
        for(var playerEmail in games[gameId].clientPlayers){
          app_server.sendMsgToClient(clients[playerEmail], dataToSend);
        }
         console.log("xxxxx0");
        numberOfPlayerAnswer[gameId] = 0;
        games[gameId].passedRound = {};
        if(recordIntervals.hasOwnProperty(gameId)){
          try{
            clearTimeout(recordIntervals[gameId]);
            delete recordIntervals[gameId];
          }
           catch(err) {
           console.log("Err: " +JSON.stringify(err));
          }
        }
        console.log("xxxxx1: " + JSON.stringify(game[gameId]));
        if(!games[gameId].hasOwnProperty("scores"))
          games[gameId].scores = {};
        for(var playerEmail in games[gameId].clientPlayers){
          games[gameId].scores[playerEmail] = 0;
        } 
         console.log("xxxxx2");
        games[gameId].playing = "true";
        console.log("game saved with: "  + JSON.stringify(games[gameId]));
        setTimeout(function() {
          // gameTimers[gameId] = startGameTimer();
          recordIntervals[gameId] = startIntervalTimer(gameId, intervalTime);
        }, prepareTime*1000);
      }
      
    }; //game_server.confirmJoinGame

    game_server.onPlayerAnswer = function(obj) {
      onQuizAnswer(obj);
    }; //game_server.onPlayerAnswer

    function onQuizAnswer(obj) {
      var i = 0;
      var _id = obj.gameId;

      var round = obj.round;
      if(games.hasOwnProperty(_id) && (games[_id].currentRound == round)){
         numberOfPlayerAnswer[_id] = numberOfPlayerAnswer[_id]+1;
         if(games[_id].passedRound[round] != true) // undefined or false
            games[_id].passedRound[round] = false;
         try{
          if(obj.result == 'true')
             games[_id].scores[obj.player] =  games[_id].scores[obj.player] +1;
          else
             games[_id].scores[obj.player] =  games[_id].scores[obj.player] -1;
          for(var playerEmail in games[_id].clientPlayers){
            if(playerEmail != obj.player){
               var dataToSend = {};
               dataToSend.notice = obj.type;
               dataToSend.data = obj;
               sendMessageToAPlayer(playerEmail, dataToSend);
            }
          }
          if(games[_id].passedRound[round] == false && (obj.result == 'true' || numberOfPlayerAnswer[_id]>= 2)) {
            clearTimeout(recordIntervals[_id]);
            games[_id].passedRound[round] = true;
            games[_id].currentRound = games[_id].currentRound+1;
            numberOfPlayerAnswer[_id]= 0;
            if(games[_id].currentRound < games[_id].round){
              sendRequestNextRoundToAll(_id, games[_id]);
            } 
            else {
              setTimeout(function() {
                console.log("currentRound: " +games[_id].currentRound + " --- Total round: " +games[_id].round );
                endgame(_id);
              }, 2*1000);
            }
         }
        }
        catch (err) {
          console.log("Error when process player answer: " + JSON.stringify(err));
        }
      }
      else {
        console.log(" nonnnnnnnnnnnnnnnn games.hasOwnProperty(_id) && (games.currRound === round) ");
      }  
    }

    game_server.onReceiveRqEndGame = function(obj) {
      var _id = obj.gameId;
      if(games.hasOwnProperty(_id)){
        endgame(_id);
      }
    }; //game_server.onReceiveRqEndGame

    function is_empty(obj) {
    // null and undefined are empty
        if (obj == null) return true;
        // Assume if it has a length property with a non-zero value
        // that that property is correct.
        if (obj.length && obj.length > 0)    return false;
        if (obj.length === 0)  return true;
        for (var key in obj) {
            if (hasOwnProperty.call(obj, key))    return false;
        }

        return true;
    }

    function startGameTimer() {
      var count = 0;
      var gameTimer = setInterval(function(){
        console.log("Tick: " + count++);
      }, 1000);
      return gameTimer;
    }

    function startIntervalTimer(_id, timerInterval) {
       if(games.hasOwnProperty(_id)){
        var start_time = new Date();
        var count = 1;
        var interval = setTimeout(function(){
		    try{
    			games[_id].currentRound = games[_id].currentRound+1;
            if(games[_id].currentRound < games[_id].round){
              var end_time = new Date();
              var dif = end_time.getTime() - start_time.getTime();
              numberOfPlayerAnswer[_id]= 0;
              sendRequestNextRoundToAll(_id, games[_id]);
              count++;
            }
            else{
              clearTimeout(interval);
              endgame(_id);
            }
    		}
    		catch (err) {
    		}
        }, timerInterval*1000);
        return interval;
      } 
    }

    function endWhenPlayerQuitGame(_id, notice, data) {
      clearTimeout(recordIntervals[_id]);
  	  if(games.hasOwnProperty(_id)){
  		  console.log("End game! zzzzzzzzzzzzzzzzz: " +JSON.stringify(games[_id]));
  		  var dataToSend = {};
  		  dataToSend.notice = notice;
        data.scores = games[_id].scores;
  		  dataToSend.data = data;
  		  sendMessageToAll(games[_id],dataToSend);
  			try{
  			   delete recordIntervals[_id];
  			   delete numberOfPlayerAnswer[_id];
  				console.log(JSON.stringify(games));
          for(var playerEmail in games[_id].clientPlayers){
             players[playerEmail].status = 1;
             if(currentGameOfPlayer.hasOwnProperty(playerEmail)){
               delete currentGameOfPlayer[playerEmail];
             }
          }
  				delete games[_id];
  			}
  			 catch(err) {
  				 console.log("Error when delete data to endGame: " + JSON.stringify(err));
  			}
  	  }
    }

    function endgame( _id) {
      clearTimeout(recordIntervals[_id]);
      // clearInterval(gameTimers[_id]);
  	  if(games.hasOwnProperty(_id)){
  		console.log("End game! zzzzzzzzzzzzzzzzz: " +JSON.stringify(games[_id]));
  		var dataToSend = {};
  		dataToSend.notice = "endGame";
  		dataToSend.data = {"scores" : games[_id].scores};
  		sendMessageToAll(games[_id],dataToSend);
  		setTimeout(function() {
          try{
             delete recordIntervals[_id];
             // delete gameTimers[_id];
              delete numberOfPlayerAnswer[_id];
              console.log(JSON.stringify(games));
              for(var playerEmail in games[_id].clientPlayers){
                if(currentGameOfPlayer.hasOwnProperty(playerEmail)){
                   delete currentGameOfPlayer[playerEmail];
                }
                if(players[playerEmail].status  == 2 )
                 players[playerEmail].status = 1;
              }
              delete games[_id];
          }
          catch(err) {
              console.log("Error when delete data to endGame: " + JSON.stringify(err));
          } 
  		}, 3*1000); 
  	  }
    }

    function sendRequestNextRoundToAll(_id, game) {
      console.log("sendRequestNextRoundToAll");
       if(typeof game != undefined) {
          var dataToSend = {};
          dataToSend.notice = "nextRound";
          dataToSend.data = {"round" : game.currentRound, "scores" : game.scores};
          sendMessageToAll(game,dataToSend);
          console.log("game saved: "  + JSON.stringify(game));
          setTimeout(function() {
            if(recordIntervals.hasOwnProperty(_id)) {
              delete recordIntervals[_id];
            }
            recordIntervals[_id] = startIntervalTimer(_id, intervalTime);
          }, 2*1000); 
       } 
    }

    function sendMessageToAll(game, msg) {
      if(typeof game != undefined) {
        try{
          for(var playerEmail in game.clientPlayers){
            sendMessageToAPlayer(playerEmail, msg);
          }
        }
        catch (err) {
            console.log("Error when send msg to all");
        }
      } 
    }

    function sendMessageToAPlayer(playerId, msg) {
      try{
         app_server.sendMsgToClient(clients[playerId], msg);
      }
      catch (err) {
         console.log("Error when sendMessageToAPlayer " + JSON.stringify(err));
      }
    }

    function lengthOfObj(obj) {
      var length = 0;
      for(var k in obj){
        if(obj.hasOwnProperty(k))
         length++;
      }
      return length;
    }


