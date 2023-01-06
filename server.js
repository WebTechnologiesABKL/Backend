const http = require("http");
const express = require("express");
const socketIo = require("socket.io");

const SERVER_PORT = 8080;

const users = [];
function onNewWebsocketConnection(socket) {
    console.info(`Socket ${socket.id} has connected.`);
    users.push({
        socketId: socket.id,
        lastMessage: "",
        lastLocation: "",
        lastTime: new Date()
    })
    console.log(users);


    socket.on("disconnect", () => {
        console.info(`Socket ${socket.id} has disconnected.`);
        users.forEach((user, i) => {
            if(user.socketId == socket.id){
                users.splice(i, 1);
            }
        });
        console.log(users);
    });

    // echoes on the terminal every "hello" message this socket sends
    socket.on("chat", function(data){
        console.info(`Socket ${socket.id} has sent information:`);
        console.info(data);

        //interpretiere text mit RASA

        //Abfragen des wetters (wenn Wetterfrage vorhanden)

        socket.emit("chat", {
            message: 'We received your message ("' + data.message + '")'
        });
        users.forEach((user, i) => {
            if(user.socketId == socket.id){
                users[i].lastMessage = data.message;
            }
        })
    });

    // will send a message only to this socket (different than using `io.emit()`, which would broadcast it)
    socket.emit("welcome", {
        socketId: socket.id
    });
}

function startServer() {
    // create a new express app
    const app = express();
    // create http server and wrap the express app
    const server = http.createServer(app);
    // bind socket.io to that server
    const io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // will fire for every new websocket connection
    io.on("connection", onNewWebsocketConnection);

    // important! must listen from `server`, not `app`, otherwise socket.io won't function correctly
    server.listen(SERVER_PORT, () => console.info(`Listening on port ${SERVER_PORT}`));
}

startServer();